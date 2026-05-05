from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from chats.models import Chat, ChatMember
from users.models import User
from .models import Message


def results(response):
    data = response.json()
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class MessageAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.member = User.objects.create_user(username='member', password='pass')
        self.outsider = User.objects.create_user(username='outsider', password='pass')

        self.chat = Chat.objects.create(title='Team chat')
        ChatMember.objects.create(chat=self.chat, user=self.owner, role=ChatMember.Role.OWNER)
        ChatMember.objects.create(chat=self.chat, user=self.member, role=ChatMember.Role.MEMBER)

        self.foreign_chat = Chat.objects.create(title='Foreign chat')
        ChatMember.objects.create(chat=self.foreign_chat, user=self.outsider, role=ChatMember.Role.OWNER)

        self.message = Message.objects.create(chat=self.chat, sender=self.owner, text='Visible')
        self.foreign_message = Message.objects.create(
            chat=self.foreign_chat,
            sender=self.outsider,
            text='Hidden',
        )

    def test_anonymous_user_cannot_list_messages(self):
        response = self.client.get(reverse('message-list'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_sees_only_messages_from_own_chats(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('message-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in results(response)], [self.message.id])

    def test_messages_can_be_filtered_by_chat(self):
        Message.objects.create(chat=self.chat, sender=self.member, text='Second')
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('message-list'), {'chat': self.chat.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(results(response)), 2)
        self.assertTrue(all(item['chat'] == self.chat.id for item in results(response)))

    def test_foreign_message_detail_is_hidden(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('message-detail', args=[self.foreign_message.id]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_write_to_foreign_chat(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(
            reverse('message-list'),
            {'chat': self.foreign_chat.id, 'text': 'Nope'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sender_is_taken_from_request_user(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(
            reverse('message-list'),
            {'chat': self.chat.id, 'sender': self.owner.id, 'text': 'From current user'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Message.objects.get(id=response.json()['id'])
        self.assertEqual(created.sender, self.member)

    def test_task_status_is_allowed_only_for_task_messages(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(
            reverse('message-list'),
            {
                'chat': self.chat.id,
                'text': 'Regular message',
                'message_type': Message.MessageType.DEFAULT,
                'task_status': Message.TaskStatus.TODO,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('task_status', response.json())

    def test_author_can_update_own_message(self):
        self.client.force_authenticate(self.owner)

        response = self.client.patch(
            reverse('message-detail', args=[self.message.id]),
            {'text': 'Updated'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.message.refresh_from_db()
        self.assertEqual(self.message.text, 'Updated')

    def test_member_cannot_update_other_user_message(self):
        self.client.force_authenticate(self.member)

        response = self.client.patch(
            reverse('message-detail', args=[self.message.id]),
            {'text': 'Changed by member'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
