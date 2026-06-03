from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from chats.models import ChatMember
from config.media import build_public_media_url
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
    sender_avatar_url = serializers.SerializerMethodField()
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
            'sender_avatar_url',
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
            'sender_avatar_url',
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
            url = build_public_media_url(request, url, attachment.uploaded_at.timestamp())
            attachments.append({
                'id': attachment.id,
                'url': url,
                'original_name': attachment.original_name,
                'content_type': attachment.content_type,
                'size': attachment.size,
                'uploaded_at': attachment.uploaded_at,
            })
        return attachments

    def get_sender_avatar_url(self, obj):
        request = self.context.get('request')
        avatar = getattr(obj.sender, 'avatar', None)
        if not avatar:
            return None
        try:
            cache_key = avatar.storage.get_modified_time(avatar.name).timestamp()
        except (OSError, ValueError, ObjectDoesNotExist):
            cache_key = avatar.name
        return build_public_media_url(request, avatar.url, cache_key)

    def get_is_read(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False

        if obj.sender_id == user.id:
            return MessageReadReceipt.objects.filter(
                chat=obj.chat,
                last_read_message__created_at__gte=obj.created_at,
            ).exclude(user=user).exists()

        return MessageReadReceipt.objects.filter(
            chat=obj.chat,
            user=user,
            last_read_message__created_at__gte=obj.created_at,
        ).exists()

    def get_read_by_count(self, obj):
        return MessageReadReceipt.objects.filter(
            chat=obj.chat,
            last_read_message__created_at__gte=obj.created_at,
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
        self._validate_attachments(files)

        if message_type != Message.MessageType.TASK and task_status != Message.TaskStatus.NONE:
            raise serializers.ValidationError({
                'task_status': 'Статус задачи можно указывать только для сообщений типа task.'
            })

        return attrs

    @staticmethod
    def _validate_attachments(files):
        if len(files) > settings.MAX_ATTACHMENTS_PER_MESSAGE:
            raise serializers.ValidationError({
                'attachments': f'Можно прикрепить не более {settings.MAX_ATTACHMENTS_PER_MESSAGE} файлов.'
            })

        allowed_types = set(settings.ALLOWED_ATTACHMENT_CONTENT_TYPES)
        for uploaded_file in files:
            if uploaded_file.size > settings.MAX_UPLOAD_SIZE_BYTES:
                max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
                raise serializers.ValidationError({
                    'attachments': f'Файл {uploaded_file.name} превышает лимит {max_mb} МБ.'
                })

            content_type = getattr(uploaded_file, 'content_type', '') or ''
            if allowed_types and content_type not in allowed_types:
                raise serializers.ValidationError({
                    'attachments': f'Тип файла {content_type or "unknown"} не разрешен.'
                })
