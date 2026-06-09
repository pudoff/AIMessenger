import math
import logging
import os
import re
from difflib import SequenceMatcher
from datetime import datetime, time

from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from config import ml_tasks
from users.permissions import is_project_admin
from .models import Message, MessageAttachment, MessageClassification, MessageReadReceipt
from .permissions import CanWriteMessageInChat, IsMessageChatMember
from .serializers import MessageSerializer
from .tasks import enqueue_message_ml_tasks, fallback_embedding

try:
    from pgvector.django import CosineDistance
except ImportError:
    CosineDistance = None

logger = logging.getLogger(__name__)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = (IsAuthenticated, IsMessageChatMember, CanWriteMessageInChat)

    def get_queryset(self):
        queryset = Message.objects.select_related('chat', 'sender', 'classification').prefetch_related('attachments')
        user = self.request.user
        if not is_project_admin(user):
            queryset = queryset.filter(chat__chat_members__user=user)

        chat_id = self.request.query_params.get('chat')
        if chat_id:
            queryset = queryset.filter(chat_id=chat_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        self._save_attachments(message)
        self._mark_classification_pending(message)
        MessageReadReceipt.objects.update_or_create(
            chat=message.chat,
            user=self.request.user,
            defaults={
                'last_read_message': message,
                'last_read_at': timezone.now(),
            },
        )
        enqueue_message_ml_tasks(message.id)

    def perform_update(self, serializer):
        old_text = serializer.instance.text
        message = serializer.save()
        if message.text != old_text:
            self._mark_classification_pending(message)
            enqueue_message_ml_tasks(message.id)

    def _save_attachments(self, message):
        for uploaded_file in self.request.FILES.getlist('attachments'):
            attachment = MessageAttachment.objects.create(
                message=message,
                file=uploaded_file,
                original_name=uploaded_file.name,
                content_type=getattr(uploaded_file, 'content_type', '') or '',
                size=getattr(uploaded_file, 'size', 0) or 0,
            )
            self._log_attachment_saved(attachment)

    @staticmethod
    def _log_attachment_saved(attachment):
        file_path = ''
        file_exists = None

        try:
            file_path = attachment.file.path
            file_exists = os.path.exists(file_path)
        except (NotImplementedError, ValueError, OSError) as exc:
            logger.warning(
                "Attachment path check failed: attachment_id=%s message_id=%s file_name=%s error=%s",
                attachment.id,
                attachment.message_id,
                attachment.file.name if attachment.file else '',
                exc,
            )

        logger.info(
            "Attachment saved: attachment_id=%s message_id=%s chat_id=%s original_name=%s "
            "file_name=%s file_path=%s file_exists=%s media_root=%s file_url=%s size=%s content_type=%s",
            attachment.id,
            attachment.message_id,
            attachment.message.chat_id,
            attachment.original_name,
            attachment.file.name if attachment.file else '',
            file_path,
            file_exists,
            settings.MEDIA_ROOT,
            attachment.file.url if attachment.file else '',
            attachment.size,
            attachment.content_type,
        )

        if file_exists is False:
            logger.warning(
                "Attachment database row was created but file is missing on disk: "
                "attachment_id=%s file_name=%s expected_path=%s media_root=%s",
                attachment.id,
                attachment.file.name if attachment.file else '',
                file_path,
                settings.MEDIA_ROOT,
            )

    @staticmethod
    def _mark_classification_pending(message):
        MessageClassification.objects.update_or_create(
            message=message,
            defaults={
                'label': None,
                'confidence': 0,
                'probabilities': {},
                'status': MessageClassification.Status.PENDING,
                'error_message': '',
                'source': MessageClassification.Source.ML_WORKER,
                'needs_review': False,
                'classified_at': timezone.now(),
            },
        )


class MessageAttachmentDownloadView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        try:
            attachment = MessageAttachment.objects.select_related(
                'message',
                'message__chat',
            ).get(pk=pk)
        except MessageAttachment.DoesNotExist:
            raise Http404('Файл не найден.')

        chat = attachment.message.chat
        if not is_project_admin(request.user) and not chat.chat_members.filter(user=request.user).exists():
            return Response({'detail': 'У вас нет прав для скачивания этого файла.'}, status=status.HTTP_403_FORBIDDEN)

        if not attachment.file:
            raise Http404('Файл не найден.')

        try:
            file_handle = attachment.file.open('rb')
        except (FileNotFoundError, OSError, ValueError):
            logger.warning(
                "Attachment download requested but file is missing: attachment_id=%s file_name=%s media_root=%s",
                attachment.id,
                attachment.file.name if attachment.file else '',
                settings.MEDIA_ROOT,
            )
            raise Http404('Файл не найден.')

        response = FileResponse(file_handle, as_attachment=True, filename=attachment.original_name)
        if attachment.content_type:
            response['Content-Type'] = attachment.content_type
        return response


class SemanticSearchView(APIView):
    permission_classes = (IsAuthenticated,)
    FUZZY_SCORE_THRESHOLD = 0.72
    FUZZY_TOKEN_THRESHOLD = 0.72
    CATEGORY_INTENTS = {
        'question': {'вопрос', 'вопросы', 'questions', 'question'},
        'task': {'задача', 'задачи', 'поручение', 'поручения', 'tasks', 'task'},
        'offtopic': {'токсичность', 'токсичные', 'токсичные сообщения', 'оффтоп', 'offtopic', 'toxic'},
    }

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            raise serializers.ValidationError({'q': 'This query parameter is required.'})

        limit = self._parse_limit(request.query_params.get('limit'))
        chat_id = self._parse_int_param(request.query_params.get('chat'), 'chat')
        date_from = self._parse_datetime_param(request.query_params.get('date_from'), 'date_from')
        date_to = self._parse_datetime_param(request.query_params.get('date_to'), 'date_to', end_of_day=True)
        message_type = self._parse_message_type(request.query_params.get('message_type'))
        category_intent = self._parse_category_intent(query)

        queryset = Message.objects.select_related('chat', 'sender', 'classification', 'embedding')
        if not is_project_admin(request.user):
            queryset = queryset.filter(chat__chat_members__user=request.user)

        if chat_id is not None:
            queryset = queryset.filter(chat_id=chat_id)
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)
        if message_type:
            queryset = queryset.filter(message_type=message_type)

        if category_intent:
            results = self._category_results(queryset, category_intent, limit)
            return Response({'count': len(results), 'results': results}, status=status.HTTP_200_OK)

        queryset = queryset.distinct()
        fuzzy_results = self._fuzzy_results(queryset, query, limit)

        semantic_queryset = queryset.filter(embedding__isnull=False).distinct()
        query_vector = self._query_embedding(query)

        if connection.vendor == 'postgresql' and CosineDistance is not None:
            rows = (
                semantic_queryset.annotate(distance=CosineDistance('embedding__vector', query_vector))
                .order_by('distance')[:limit]
            )
            semantic_results = [self._serialize_result(message, 1 - float(message.distance or 0), mode='semantic') for message in rows]
        else:
            scored = []
            for message in semantic_queryset[:1000]:
                scored.append((self._cosine_similarity(query_vector, message.embedding.vector), message))
            semantic_results = [
                self._serialize_result(message, score, mode='semantic')
                for score, message in sorted(scored, key=lambda item: item[0], reverse=True)[:limit]
            ]

        results = self._merge_search_results(fuzzy_results, semantic_results, limit)
        return Response({'count': len(results), 'results': results}, status=status.HTTP_200_OK)

    @classmethod
    def _fuzzy_results(cls, queryset, query, limit):
        scored = []
        for message in queryset.order_by('-created_at')[:1000]:
            score, matched_terms = cls._fuzzy_text_score(query, message.text)
            if score >= cls.FUZZY_SCORE_THRESHOLD:
                scored.append((score, message.created_at, message.id, message, matched_terms))

        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return [
            cls._serialize_result(message, score, mode='fuzzy', lexical_score=score, matched_terms=matched_terms)
            for score, _created_at, _message_id, message, matched_terms in scored[:limit]
        ]

    @classmethod
    def _fuzzy_text_score(cls, query, text):
        query_norm = cls._normalize_search_text(query)
        text_norm = cls._normalize_search_text(text)
        if not query_norm or not text_norm:
            return 0.0, []

        if query_norm in text_norm:
            return 1.0, cls._matched_terms(query_norm.split(), text_norm.split())

        query_tokens = query_norm.split()
        text_tokens = text_norm.split()
        if not query_tokens or not text_tokens:
            return 0.0, []

        phrase_score = cls._best_window_similarity(query_tokens, text_tokens)
        token_scores = []
        matched_terms = []
        for query_token in query_tokens:
            best_score = 0.0
            best_token = ''
            for text_token in text_tokens:
                score = SequenceMatcher(None, query_token, text_token).ratio()
                if score > best_score:
                    best_score = score
                    best_token = text_token
            token_scores.append(best_score)
            if best_score >= cls.FUZZY_TOKEN_THRESHOLD and best_token:
                matched_terms.append(best_token)

        token_average = sum(token_scores) / len(token_scores)
        coverage = len(matched_terms) / len(query_tokens)
        score = max(phrase_score, token_average * (0.72 + 0.28 * coverage))

        if len(query_norm) <= 4 and score < 0.86:
            return 0.0, []

        return score, sorted(set(matched_terms), key=matched_terms.index)

    @staticmethod
    def _normalize_search_text(value):
        normalized = (value or '').lower().replace('ё', 'е')
        normalized = re.sub(r'[^0-9a-zа-я]+', ' ', normalized)
        return re.sub(r'\s+', ' ', normalized).strip()

    @staticmethod
    def _best_window_similarity(query_tokens, text_tokens):
        window_size = len(query_tokens)
        query_phrase = ' '.join(query_tokens)
        if window_size >= len(text_tokens):
            return SequenceMatcher(None, query_phrase, ' '.join(text_tokens)).ratio()

        best_score = 0.0
        for index in range(0, len(text_tokens) - window_size + 1):
            candidate = ' '.join(text_tokens[index:index + window_size])
            best_score = max(best_score, SequenceMatcher(None, query_phrase, candidate).ratio())
        return best_score

    @classmethod
    def _matched_terms(cls, query_tokens, text_tokens):
        terms = []
        for query_token in query_tokens:
            for text_token in text_tokens:
                if query_token == text_token:
                    terms.append(text_token)
                    break
        return terms

    @staticmethod
    def _merge_search_results(primary_results, secondary_results, limit):
        merged = []
        seen_message_ids = set()
        for result in [*primary_results, *secondary_results]:
            message_id = result['message_id']
            if message_id in seen_message_ids:
                continue
            merged.append(result)
            seen_message_ids.add(message_id)
            if len(merged) >= limit:
                break
        return merged

    def _query_embedding(self, query):
        try:
            return ml_tasks.embed_text(query).get(timeout=settings.SEMANTIC_SEARCH_ML_TIMEOUT_SECONDS)['embedding']
        except Exception:
            return fallback_embedding(query)

    @staticmethod
    def _parse_limit(raw_limit):
        try:
            limit = int(raw_limit or 20)
        except (TypeError, ValueError):
            raise serializers.ValidationError({'limit': 'Limit must be an integer.'})
        if limit < 1:
            raise serializers.ValidationError({'limit': 'Limit must be greater than zero.'})
        return min(limit, 50)

    @staticmethod
    def _parse_int_param(raw_value, field_name):
        if raw_value in (None, ''):
            return None
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            raise serializers.ValidationError({field_name: 'Value must be an integer.'})
        if value < 1:
            raise serializers.ValidationError({field_name: 'Value must be greater than zero.'})
        return value

    @staticmethod
    def _parse_datetime_param(raw_value, field_name, end_of_day=False):
        if not raw_value:
            return None

        parsed = parse_datetime(raw_value)
        if parsed is None:
            parsed_date = parse_date(raw_value)
            if parsed_date is None:
                raise serializers.ValidationError({field_name: 'Use ISO date or datetime format.'})
            parsed = datetime.combine(parsed_date, time.max if end_of_day else time.min)

        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    @staticmethod
    def _parse_message_type(raw_value):
        if not raw_value:
            return None
        if raw_value not in Message.MessageType.values:
            allowed = ', '.join(Message.MessageType.values)
            raise serializers.ValidationError({'message_type': f'Allowed values: {allowed}.'})
        return raw_value

    @classmethod
    def _parse_category_intent(cls, query):
        normalized = query.lower().replace('ё', 'е').strip()
        normalized = re.sub(r'\s+', ' ', normalized)
        for label, aliases in cls.CATEGORY_INTENTS.items():
            normalized_aliases = {alias.replace('ё', 'е') for alias in aliases}
            if normalized in normalized_aliases:
                return label
        return None

    def _category_results(self, queryset, category_intent, limit):
        if category_intent == 'question':
            queryset = queryset.filter(
                Q(classification__label='question') | Q(message_type=Message.MessageType.QUESTION)
            )
        elif category_intent == 'task':
            queryset = queryset.filter(
                Q(classification__label='task') | Q(message_type=Message.MessageType.TASK)
            )
        elif category_intent == 'offtopic':
            queryset = queryset.filter(classification__label__in=('offtopic', 'toxic'))

        rows = queryset.distinct().order_by('-created_at')[:limit]
        return [
            self._serialize_result(message, 1.0, mode='classification')
            for message in rows
        ]

    @staticmethod
    def _cosine_similarity(left, right):
        if not left or not right:
            return 0.0
        numerator = sum(float(a) * float(b) for a, b in zip(left, right))
        left_norm = math.sqrt(sum(float(a) * float(a) for a in left)) or 1.0
        right_norm = math.sqrt(sum(float(b) * float(b) for b in right)) or 1.0
        return numerator / (left_norm * right_norm)

    @staticmethod
    def _normalize_similarity_score(score):
        return max(0.0, min(1.0, float(score)))

    @classmethod
    def _serialize_result(cls, message, score, mode, lexical_score=0.0, matched_terms=None):
        classification = getattr(message, 'classification', None)
        raw_score = float(score)
        return {
            'message_id': message.id,
            'chat_id': message.chat_id,
            'chat_title': message.chat.title,
            'sender': {
                'id': message.sender_id,
                'username': message.sender.username,
            },
            'text': message.text,
            'message_type': message.message_type,
            'created_at': message.created_at,
            'classification': classification.label if classification else None,
            'similarity_score': round(cls._normalize_similarity_score(raw_score), 6),
            'raw_similarity_score': round(raw_score, 6),
            'lexical_score': round(cls._normalize_similarity_score(lexical_score), 6),
            'matched_terms': matched_terms or [],
            'search_mode': mode,
        }
