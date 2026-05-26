from rest_framework import serializers

from chats.models import ChatMember
from users.permissions import is_project_admin
from .models import Message, MessageClassification


class MessageClassificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageClassification
        fields = (
            'label',
            'confidence',
            'probabilities',
            'status',
            'error_message',
            'source',
            'needs_review',
            'classified_at',
        )
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    classification = MessageClassificationSerializer(read_only=True)

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
            'classification',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'sender', 'sender_username', 'classification', 'created_at', 'updated_at')

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        chat = attrs.get('chat') or getattr(self.instance, 'chat', None)
        message_type = attrs.get(
            'message_type',
            getattr(self.instance, 'message_type', Message.MessageType.DEFAULT),
        )
        task_status = attrs.get(
            'task_status',
            getattr(self.instance, 'task_status', Message.TaskStatus.NONE),
        )

        if chat and user and user.is_authenticated and not is_project_admin(user):
            if not ChatMember.objects.filter(chat=chat, user=user).exists():
                raise serializers.ValidationError({'chat': 'Вы не состоите в этом чате.'})

        if message_type != Message.MessageType.TASK and task_status != Message.TaskStatus.NONE:
            raise serializers.ValidationError({
                'task_status': 'Статус задачи можно указывать только для сообщений типа task.'
            })

        return attrs
