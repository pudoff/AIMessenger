from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Message
from .permissions import CanWriteMessageInChat, IsMessageChatMember
from .serializers import MessageSerializer


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = (IsAuthenticated, IsMessageChatMember, CanWriteMessageInChat)

    def get_queryset(self):
        queryset = Message.objects.select_related('chat', 'sender')
        user = self.request.user
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(chat__chat_members__user=user)

        chat_id = self.request.query_params.get('chat')
        if chat_id:
            queryset = queryset.filter(chat_id=chat_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)
