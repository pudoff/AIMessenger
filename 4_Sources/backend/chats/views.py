from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from users.permissions import is_project_admin
from .models import Chat, ChatMember
from .permissions import IsChatMember, IsChatMemberRecordVisible, IsChatOwnerOrAdminForUnsafe
from .serializers import ChatMemberSerializer, ChatSerializer


class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = (IsAuthenticated, IsChatMember, IsChatOwnerOrAdminForUnsafe)

    def get_queryset(self):
        queryset = Chat.objects.prefetch_related('chat_members')
        user = self.request.user
        if is_project_admin(user):
            return queryset
        return queryset.filter(chat_members__user=user).distinct()

    def perform_create(self, serializer):
        chat = serializer.save()
        ChatMember.objects.get_or_create(
            chat=chat,
            user=self.request.user,
            defaults={'role': ChatMember.Role.OWNER},
        )


class ChatMemberViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMemberSerializer
    permission_classes = (IsAuthenticated, IsChatMemberRecordVisible, IsChatOwnerOrAdminForUnsafe)

    def get_queryset(self):
        queryset = ChatMember.objects.select_related('chat', 'user')
        user = self.request.user
        if is_project_admin(user):
            filtered_queryset = queryset
        else:
            filtered_queryset = queryset.filter(chat__chat_members__user=user)

        chat_id = self.request.query_params.get('chat')
        if chat_id:
            filtered_queryset = filtered_queryset.filter(chat_id=chat_id)

        return filtered_queryset.distinct()
