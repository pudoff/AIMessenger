from django.db import transaction
from django.db.models import Prefetch
from rest_framework import serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from messages.models import Message
from users.permissions import is_project_admin
from .models import Chat, ChatMember
from .permissions import IsChatMember, IsChatMemberRecordVisible, IsChatOwnerOrAdminForUnsafe
from .serializers import ChatMemberSerializer, ChatSerializer


class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = (IsAuthenticated, IsChatMember, IsChatOwnerOrAdminForUnsafe)

    def get_queryset(self):
        last_message_queryset = Message.objects.select_related('sender').order_by('-created_at')[:1]
        queryset = Chat.objects.select_related('created_by').prefetch_related(
            'chat_members__user',
            Prefetch('messages', queryset=last_message_queryset, to_attr='last_prefetched_messages'),
        )
        user = self.request.user
        if not is_project_admin(user):
            queryset = queryset.filter(chat_members__user=user)

        chat_type = self.request.query_params.get('type')
        if chat_type:
            queryset = queryset.filter(chat_type=chat_type)

        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        chat = self._create_chat(serializer)
        output = self.get_serializer(chat)
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    @transaction.atomic
    def _create_chat(self, serializer):
        data = serializer.validated_data
        chat_type = data.get('chat_type', Chat.ChatType.GROUP)
        participant_ids = data.pop('participant_ids', [])
        direct_user_id = data.pop('direct_user_id', None)

        if chat_type == Chat.ChatType.DIRECT:
            if direct_user_id == self.request.user.id:
                raise serializers.ValidationError({'direct_user_id': 'Direct chat with yourself is not allowed.'})

            existing = (
                Chat.objects.filter(chat_type=Chat.ChatType.DIRECT, chat_members__user=self.request.user)
                .filter(chat_members__user_id=direct_user_id)
                .distinct()
                .first()
            )
            if existing:
                raise serializers.ValidationError({'direct_user_id': 'Direct chat for this user pair already exists.'})

            title = data.get('title') or f'Direct chat {self.request.user.id}-{direct_user_id}'
            chat = Chat.objects.create(
                title=title,
                chat_type=chat_type,
                description=data.get('description', ''),
                created_by=self.request.user,
            )
            ChatMember.objects.create(chat=chat, user=self.request.user, role=ChatMember.Role.OWNER)
            ChatMember.objects.create(chat=chat, user_id=direct_user_id, role=ChatMember.Role.MEMBER)
            return chat

        chat = Chat.objects.create(
            title=data['title'],
            chat_type=chat_type,
            description=data.get('description', ''),
            created_by=self.request.user,
        )
        ChatMember.objects.create(chat=chat, user=self.request.user, role=ChatMember.Role.OWNER)
        for user_id in set(participant_ids):
            if user_id != self.request.user.id:
                ChatMember.objects.get_or_create(chat=chat, user_id=user_id, defaults={'role': ChatMember.Role.MEMBER})
        return chat


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
