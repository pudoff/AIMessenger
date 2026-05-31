import math
import re
from datetime import datetime, time

from django.conf import settings
from django.db import connection
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
            MessageAttachment.objects.create(
                message=message,
                file=uploaded_file,
                original_name=uploaded_file.name,
                content_type=getattr(uploaded_file, 'content_type', '') or '',
                size=getattr(uploaded_file, 'size', 0) or 0,
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


class SemanticSearchView(APIView):
    permission_classes = (IsAuthenticated,)
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

        queryset = queryset.filter(embedding__isnull=False).distinct()
        query_vector = self._query_embedding(query)

        if connection.vendor == 'postgresql' and CosineDistance is not None:
            rows = (
                queryset.annotate(distance=CosineDistance('embedding__vector', query_vector))
                .order_by('distance')[:limit]
            )
            results = [self._serialize_result(message, 1 - float(message.distance or 0), mode='semantic') for message in rows]
        else:
            scored = []
            for message in queryset[:1000]:
                scored.append((self._cosine_similarity(query_vector, message.embedding.vector), message))
            results = [
                self._serialize_result(message, score, mode='semantic')
                for score, message in sorted(scored, key=lambda item: item[0], reverse=True)[:limit]
            ]

        return Response({'count': len(results), 'results': results}, status=status.HTTP_200_OK)

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
    def _serialize_result(cls, message, score, mode):
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
            'search_mode': mode,
        }
