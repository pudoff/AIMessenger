from rest_framework import permissions

from chats.models import ChatMember


class IsMessageChatMember(permissions.BasePermission):
    """Allow message access only to participants of the related chat."""

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True
        return obj.chat.chat_members.filter(user=request.user).exists()


class CanWriteMessageInChat(permissions.BasePermission):
    """
    Allow creating messages only in chats where the user is a member.
    Allow editing/deleting only own messages or messages in chats where the user is owner/admin.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_staff or request.user.is_superuser:
            return True

        chat_id = request.data.get('chat')
        if not chat_id:
            return True

        return ChatMember.objects.filter(chat_id=chat_id, user=request.user).exists()

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_staff or request.user.is_superuser:
            return True
        if obj.sender_id == request.user.id:
            return True

        return obj.chat.chat_members.filter(
            user=request.user,
            role__in=(ChatMember.Role.OWNER, ChatMember.Role.ADMIN),
        ).exists()
