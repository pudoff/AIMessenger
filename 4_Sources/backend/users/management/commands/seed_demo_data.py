from django.core.management.base import BaseCommand

from chats.models import Chat, ChatMember
from messages.models import Message, MessageClassification
from users.models import User


PASSWORD = 'DemoPassword123'


class Command(BaseCommand):
    help = 'Create idempotent demo users, chats, memberships and messages for frontend review.'

    def handle(self, *args, **options):
        users = {
            'admin': self._user('admin', User.Role.ADMIN, is_staff=True, is_superuser=True),
            'user1': self._user('user1', User.Role.USER),
            'user2': self._user('user2', User.Role.USER),
            'analyst': self._user('analyst', User.Role.ADMIN, is_staff=True),
        }

        direct_1 = self._chat(
            'Direct: user1 and user2',
            Chat.ChatType.DIRECT,
            users['user1'],
            'Demo direct chat',
        )
        self._member(direct_1, users['user1'], ChatMember.Role.OWNER)
        self._member(direct_1, users['user2'], ChatMember.Role.MEMBER)

        direct_2 = self._chat(
            'Direct: admin and analyst',
            Chat.ChatType.DIRECT,
            users['admin'],
            'Admin direct chat',
        )
        self._member(direct_2, users['admin'], ChatMember.Role.OWNER)
        self._member(direct_2, users['analyst'], ChatMember.Role.MEMBER)

        corporate = self._chat(
            'AIMessenger corporate',
            Chat.ChatType.CORPORATE,
            users['admin'],
            'Corporate demo space',
        )
        self._member(corporate, users['admin'], ChatMember.Role.OWNER)
        self._member(corporate, users['analyst'], ChatMember.Role.ADMIN)
        self._member(corporate, users['user1'], ChatMember.Role.MEMBER)
        self._member(corporate, users['user2'], ChatMember.Role.MEMBER)

        group = self._chat(
            'Sprint planning',
            Chat.ChatType.GROUP,
            users['analyst'],
            'Group chat for sprint demo',
        )
        self._member(group, users['analyst'], ChatMember.Role.OWNER)
        self._member(group, users['user1'], ChatMember.Role.ADMIN)
        self._member(group, users['user2'], ChatMember.Role.MEMBER)

        self._message(direct_1, users['user1'], 'Привет, как дела?', Message.MessageType.QUESTION)
        self._message(direct_1, users['user2'], 'Все хорошо, проверяю frontend.', Message.MessageType.DEFAULT)
        self._message(
            corporate,
            users['admin'],
            'Нужно подготовить демо к показу.',
            Message.MessageType.TASK,
            Message.TaskStatus.TODO,
        )
        self._message(group, users['analyst'], 'Какие риски по API-контракту?', Message.MessageType.QUESTION)
        self._message(group, users['user1'], 'Добавил фильтры и тесты.', Message.MessageType.DEFAULT)

        self.stdout.write(self.style.SUCCESS('Demo data is ready. Users password: DemoPassword123'))

    def _user(self, username, role, is_staff=False, is_superuser=False):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': f'{username}@example.com',
                'first_name': username.capitalize(),
                'last_name': 'Demo',
                'role': role,
                'is_staff': is_staff,
                'is_superuser': is_superuser,
                'accepted_user_agreement': True,
                'accepted_privacy_policy': True,
            },
        )
        changed = False
        for field, value in (
            ('email', f'{username}@example.com'),
            ('role', role),
            ('is_staff', is_staff),
            ('is_superuser', is_superuser),
            ('accepted_user_agreement', True),
            ('accepted_privacy_policy', True),
        ):
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed = True
        if created or not user.has_usable_password():
            user.set_password(PASSWORD)
            changed = True
        if changed:
            user.save()
        return user

    def _chat(self, title, chat_type, created_by, description):
        chat, created = Chat.objects.get_or_create(
            title=title,
            defaults={
                'chat_type': chat_type,
                'created_by': created_by,
                'description': description,
            },
        )
        changed = False
        for field, value in (('chat_type', chat_type), ('created_by', created_by), ('description', description)):
            if getattr(chat, field) != value:
                setattr(chat, field, value)
                changed = True
        if changed:
            chat.save()
        return chat

    def _member(self, chat, user, role):
        member, created = ChatMember.objects.get_or_create(chat=chat, user=user, defaults={'role': role})
        if member.role != role:
            member.role = role
            member.save(update_fields=['role'])
        return member

    def _message(self, chat, sender, text, message_type, task_status=Message.TaskStatus.NONE):
        message, created = Message.objects.get_or_create(
            chat=chat,
            sender=sender,
            text=text,
            defaults={'message_type': message_type, 'task_status': task_status},
        )
        changed = False
        for field, value in (('message_type', message_type), ('task_status', task_status)):
            if getattr(message, field) != value:
                setattr(message, field, value)
                changed = True
        if changed:
            message.save()
        MessageClassification.objects.get_or_create(
            message=message,
            defaults={
                'label': message_type,
                'confidence': 0.75,
                'probabilities': {message_type: 0.75},
            },
        )
        return message
