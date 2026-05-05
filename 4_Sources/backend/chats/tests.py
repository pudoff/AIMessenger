from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User
from .models import Chat, ChatMember


def results(response):
    data = response.json()
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class ChatAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.member = User.objects.create_user(username='member', password='pass')
        self.outsider = User.objects.create_user(username='outsider', password='pass')

        self.chat = Chat.objects.create(title='Team chat')
        ChatMember.objects.create(chat=self.chat, user=self.owner, role=ChatMember.Role.OWNER)
        ChatMember.objects.create(chat=self.chat, user=self.member, role=ChatMember.Role.MEMBER)

        self.foreign_chat = Chat.objects.create(title='Foreign chat')
        ChatMember.objects.create(chat=self.foreign_chat, user=self.outsider, role=ChatMember.Role.OWNER)

    def test_anonymous_user_cannot_list_chats(self):
        response = self.client.get(reverse('chat-list'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_sees_only_own_chats(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('chat-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in results(response)], [self.chat.id])

    def test_foreign_chat_detail_is_hidden(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('chat-detail', args=[self.foreign_chat.id]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_chat_creator_becomes_owner(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(reverse('chat-list'), {'title': 'New chat'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        chat_id = response.json()['id']
        self.assertTrue(
            ChatMember.objects.filter(
                chat_id=chat_id,
                user=self.member,
                role=ChatMember.Role.OWNER,
            ).exists()
        )

    def test_member_cannot_update_chat(self):
        self.client.force_authenticate(self.member)

        response = self.client.patch(
            reverse('chat-detail', args=[self.chat.id]),
            {'title': 'Changed by member'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_update_chat(self):
        self.client.force_authenticate(self.owner)

        response = self.client.patch(
            reverse('chat-detail', args=[self.chat.id]),
            {'title': 'Changed by owner'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.chat.refresh_from_db()
        self.assertEqual(self.chat.title, 'Changed by owner')


class ChatMemberAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.member = User.objects.create_user(username='member', password='pass')
        self.new_user = User.objects.create_user(username='new_user', password='pass')
        self.outsider = User.objects.create_user(username='outsider', password='pass')

        self.chat = Chat.objects.create(title='Team chat')
        self.owner_record = ChatMember.objects.create(
            chat=self.chat,
            user=self.owner,
            role=ChatMember.Role.OWNER,
        )
        self.member_record = ChatMember.objects.create(
            chat=self.chat,
            user=self.member,
            role=ChatMember.Role.MEMBER,
        )

        self.foreign_chat = Chat.objects.create(title='Foreign chat')
        ChatMember.objects.create(chat=self.foreign_chat, user=self.outsider, role=ChatMember.Role.OWNER)

    def test_user_sees_only_members_from_own_chats(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('chat-member-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            sorted(item['id'] for item in results(response)),
            sorted([self.owner_record.id, self.member_record.id]),
        )

    def test_chat_member_list_can_be_filtered_by_chat(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('chat-member-list'), {'chat': self.chat.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(item['chat'] == self.chat.id for item in results(response)))

    def test_member_cannot_add_chat_member(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(
            reverse('chat-member-list'),
            {'chat': self.chat.id, 'user': self.new_user.id, 'role': ChatMember.Role.MEMBER},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_add_chat_member(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse('chat-member-list'),
            {'chat': self.chat.id, 'user': self.new_user.id, 'role': ChatMember.Role.MEMBER},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ChatMember.objects.filter(chat=self.chat, user=self.new_user).exists())
