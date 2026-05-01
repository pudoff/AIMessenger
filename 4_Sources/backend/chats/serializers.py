from rest_framework import serializers

from .models import Chat, ChatMember


class ChatMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ChatMember
        fields = ('id', 'chat', 'user', 'username', 'role', 'joined_at')
        read_only_fields = ('id', 'joined_at')


class ChatSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(source='members.count', read_only=True)

    class Meta:
        model = Chat
        fields = ('id', 'title', 'members_count', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')
