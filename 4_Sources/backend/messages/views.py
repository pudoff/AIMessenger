from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from users.permissions import is_project_admin
from .classification import classify_text
from .models import Message, MessageClassification
from .permissions import CanWriteMessageInChat, IsMessageChatMember
from .serializers import MessageSerializer


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
        result = classify_text(message.text)
        MessageClassification.objects.update_or_create(
            message=message,
            defaults={
                'label': result['label'],
                'confidence': result['confidence'],
                'probabilities': result['probabilities'],
            },
        )
