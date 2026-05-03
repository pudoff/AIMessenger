from rest_framework import serializers

from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = (
            'id',
            'chat',
            'sender',
            'sender_username',
            'text',
            'message_type',
            'task_status',
            'analyst_notes',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'sender', 'created_at', 'updated_at')
