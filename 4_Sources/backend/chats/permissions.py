from rest_framework import permissions

from .models import ChatMember


class IsChatMember(permissions.BasePermission):
    """Allow access only to users that participate in the chat."""

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True
        return obj.chat_members.filter(user=request.user).exists()


class IsChatMemberRecordVisible(permissions.BasePermission):
    """Allow users to see only membership records from their chats."""

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True
        return obj.chat.chat_members.filter(user=request.user).exists()


class IsChatOwnerOrAdminForUnsafe(permissions.BasePermission):
    """Restrict chat/member mutations to chat owner/admin or Django staff."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_staff or request.user.is_superuser:
            return True

        chat_id = request.data.get('chat') or view.kwargs.get('chat_pk')
        if not chat_id:
            return True

        return ChatMember.objects.filter(
            chat_id=chat_id,
            user=request.user,
            role__in=(ChatMember.Role.OWNER, ChatMember.Role.ADMIN),
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_staff or request.user.is_superuser:
            return True

        chat = getattr(obj, 'chat', obj)
        return chat.chat_members.filter(
            user=request.user,
            role__in=(ChatMember.Role.OWNER, ChatMember.Role.ADMIN),
        ).exists()
