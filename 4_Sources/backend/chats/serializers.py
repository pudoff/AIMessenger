from rest_framework import serializers

from .models import Chat, ChatMember


class ChatMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ChatMember
        fields = ('id', 'chat', 'user', 'username', 'role', 'joined_at')
        read_only_fields = ('id', 'joined_at')

    def validate_chat(self, chat):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and not (user.is_staff or user.is_superuser):
            if not chat.chat_members.filter(
                user=user,
                role__in=(ChatMember.Role.OWNER, ChatMember.Role.ADMIN),
            ).exists():
                raise serializers.ValidationError('Управлять участниками может только владелец или админ чата.')
        return chat


class ChatSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(source='members.count', read_only=True)

    class Meta:
        model = Chat
        fields = ('id', 'title', 'members_count', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')
