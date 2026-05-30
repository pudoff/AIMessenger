from rest_framework import serializers

from chats.models import ChatMember
from users.permissions import is_project_admin
from .models import Message, MessageClassification, MessageReadReceipt


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
    attachments = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    read_by_count = serializers.SerializerMethodField()

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
            'attachments',
            'is_read',
            'read_by_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'sender',
            'sender_username',
            'classification',
            'attachments',
            'is_read',
            'read_by_count',
            'created_at',
            'updated_at',
        )
        extra_kwargs = {'text': {'required': False, 'allow_blank': True}}

    def get_attachments(self, obj):
        request = self.context.get('request')
        attachments = []
        for attachment in obj.attachments.all():
            url = attachment.file.url if attachment.file else ''
            if request and url:
                url = request.build_absolute_uri(url)
            attachments.append({
                'id': attachment.id,
                'url': url,
                'original_name': attachment.original_name,
                'content_type': attachment.content_type,
                'size': attachment.size,
                'uploaded_at': attachment.uploaded_at,
            })
        return attachments

    def get_is_read(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False

        if obj.sender_id == user.id:
            return MessageReadReceipt.objects.filter(
                chat=obj.chat,
                last_read_at__gte=obj.created_at,
            ).exclude(user=user).exists()

        return MessageReadReceipt.objects.filter(
            chat=obj.chat,
            user=user,
            last_read_at__gte=obj.created_at,
        ).exists()

    def get_read_by_count(self, obj):
        return MessageReadReceipt.objects.filter(
            chat=obj.chat,
            last_read_at__gte=obj.created_at,
        ).exclude(user=obj.sender).count()

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

        files = request.FILES.getlist('attachments') if request else []
        text = attrs.get('text', getattr(self.instance, 'text', ''))
        if not (text or '').strip() and not files:
            raise serializers.ValidationError({'text': 'Введите текст или прикрепите файл.'})

        if message_type != Message.MessageType.TASK and task_status != Message.TaskStatus.NONE:
            raise serializers.ValidationError({
                'task_status': 'Статус задачи можно указывать только для сообщений типа task.'
            })

        return attrs
