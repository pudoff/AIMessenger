import math

from django.conf import settings
from django.db import connection
from rest_framework import serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from config import ml_tasks
from users.permissions import is_project_admin
from .models import Message
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
        queryset = Message.objects.select_related('chat', 'sender', 'classification')
        user = self.request.user
        if not is_project_admin(user):
            queryset = queryset.filter(chat__chat_members__user=user)

        chat_id = self.request.query_params.get('chat')
        if chat_id:
            queryset = queryset.filter(chat_id=chat_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        enqueue_message_ml_tasks(message.id)

    def perform_update(self, serializer):
        old_text = serializer.instance.text
        message = serializer.save()
        if message.text != old_text:
            enqueue_message_ml_tasks(message.id)


class SemanticSearchView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            raise serializers.ValidationError({'q': 'This query parameter is required.'})

        try:
            limit = min(int(request.query_params.get('limit') or 20), 50)
        except ValueError:
            raise serializers.ValidationError({'limit': 'Limit must be an integer.'})
        queryset = Message.objects.select_related('chat', 'sender', 'classification', 'embedding')
        if not is_project_admin(request.user):
            queryset = queryset.filter(chat__chat_members__user=request.user)

        chat_id = request.query_params.get('chat')
        if chat_id:
            queryset = queryset.filter(chat_id=chat_id)
        if request.query_params.get('date_from'):
            queryset = queryset.filter(created_at__gte=request.query_params['date_from'])
        if request.query_params.get('date_to'):
            queryset = queryset.filter(created_at__lte=request.query_params['date_to'])
        if request.query_params.get('message_type'):
            queryset = queryset.filter(message_type=request.query_params['message_type'])

        queryset = queryset.filter(embedding__isnull=False).distinct()
        query_vector = self._query_embedding(query)

        if connection.vendor == 'postgresql' and CosineDistance is not None:
            rows = (
                queryset.annotate(distance=CosineDistance('embedding__vector', query_vector))
                .order_by('distance')[:limit]
            )
            results = [self._serialize_result(message, 1 - float(message.distance or 0)) for message in rows]
        else:
            scored = []
            for message in queryset[:1000]:
                scored.append((self._cosine_similarity(query_vector, message.embedding.vector), message))
            results = [
                self._serialize_result(message, score)
                for score, message in sorted(scored, key=lambda item: item[0], reverse=True)[:limit]
            ]

        return Response({'count': len(results), 'results': results}, status=status.HTTP_200_OK)

    def _query_embedding(self, query):
        try:
            return ml_tasks.embed_text(query).get(timeout=settings.ML_TASK_TIMEOUT_SECONDS)['embedding']
        except Exception:
            return fallback_embedding(query)

    @staticmethod
    def _cosine_similarity(left, right):
        if not left or not right:
            return 0.0
        numerator = sum(float(a) * float(b) for a, b in zip(left, right))
        left_norm = math.sqrt(sum(float(a) * float(a) for a in left)) or 1.0
        right_norm = math.sqrt(sum(float(b) * float(b) for b in right)) or 1.0
        return numerator / (left_norm * right_norm)

    @staticmethod
    def _serialize_result(message, score):
        classification = getattr(message, 'classification', None)
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
            'similarity_score': round(float(score), 6),
        }
