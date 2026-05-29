from rest_framework import serializers

from users.models import User
from users.permissions import is_project_admin
from users.serializers import PublicUserSerializer
from .models import Chat, ChatMember


class ChatMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_detail = PublicUserSerializer(source='user', read_only=True)

    class Meta:
        model = ChatMember
        fields = ('id', 'chat', 'user', 'username', 'user_detail', 'role', 'joined_at')
        read_only_fields = ('id', 'joined_at')

    def validate_chat(self, chat):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and not is_project_admin(user):
            if not chat.chat_members.filter(
                user=user,
                role__in=(ChatMember.Role.OWNER, ChatMember.Role.ADMIN),
            ).exists():
                raise serializers.ValidationError('Управлять участниками может только владелец или админ чата.')
        return chat


class ChatSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(source='members.count', read_only=True)
    members = ChatMemberSerializer(source='chat_members', many=True, read_only=True)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    direct_user_id = serializers.IntegerField(write_only=True, required=False)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = (
            'id',
            'title',
            'chat_type',
            'description',
            'created_by',
            'members_count',
            'members',
            'participant_ids',
            'direct_user_id',
            'last_message',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'members_count', 'members', 'last_message', 'created_at', 'updated_at')
        extra_kwargs = {'title': {'required': False}}

    def get_last_message(self, obj):
        message = getattr(obj, 'last_prefetched_message', None)
        if message is None:
            message = obj.messages.select_related('sender').order_by('-created_at').first()
        if message is None:
            return None
        return {
            'id': message.id,
            'text': message.text,
            'sender': message.sender_id,
            'sender_username': message.sender.username,
            'message_type': message.message_type,
            'task_status': message.task_status,
            'created_at': message.created_at,
        }

    def validate(self, attrs):
        chat_type = attrs.get('chat_type', getattr(self.instance, 'chat_type', Chat.ChatType.GROUP))
        direct_user_id = attrs.get('direct_user_id')

        if chat_type == Chat.ChatType.DIRECT and not self.instance and not direct_user_id:
            raise serializers.ValidationError({'direct_user_id': 'Укажите пользователя для личного чата.'})
        if direct_user_id and not User.objects.filter(id=direct_user_id).exists():
            raise serializers.ValidationError({'direct_user_id': 'Пользователь не найден.'})

        participant_ids = attrs.get('participant_ids') or []
        if participant_ids:
            existing_ids = set(User.objects.filter(id__in=participant_ids).values_list('id', flat=True))
            missing_ids = sorted(set(participant_ids) - existing_ids)
            if missing_ids:
                raise serializers.ValidationError({
                    'participant_ids': f'Пользователи не найдены: {missing_ids}'
                })

        if chat_type != Chat.ChatType.DIRECT and not self.instance and not attrs.get('title'):
            raise serializers.ValidationError({'title': 'Название обязательно для групповых и корпоративных чатов.'})

        return attrs
