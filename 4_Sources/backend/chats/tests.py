from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from messages.models import Message, MessageReadReceipt
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

        self.chat = Chat.objects.create(title='Team chat', chat_type=Chat.ChatType.GROUP, created_by=self.owner)
        ChatMember.objects.create(chat=self.chat, user=self.owner, role=ChatMember.Role.OWNER)
        ChatMember.objects.create(chat=self.chat, user=self.member, role=ChatMember.Role.MEMBER)

        self.foreign_chat = Chat.objects.create(title='Foreign chat', chat_type=Chat.ChatType.CORPORATE, created_by=self.outsider)
        ChatMember.objects.create(chat=self.foreign_chat, user=self.outsider, role=ChatMember.Role.OWNER)

    def test_anonymous_user_cannot_list_chats(self):
        response = self.client.get(reverse('chat-list'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_sees_only_own_chats(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('chat-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = results(response)[0]
        self.assertEqual(item['id'], self.chat.id)
        self.assertEqual(item['chat_type'], Chat.ChatType.GROUP)
        self.assertIn('members', item)
        self.assertIn('last_message', item)

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

    def test_chats_can_be_filtered_by_type(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('chat-list'), {'type': Chat.ChatType.GROUP})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in results(response)], [self.chat.id])

    def test_direct_chat_adds_both_members_and_prevents_duplicate_pair(self):
        self.client.force_authenticate(self.member)

        first_response = self.client.post(
            reverse('chat-list'),
            {'chat_type': Chat.ChatType.DIRECT, 'direct_user_id': self.outsider.id},
            format='json',
        )
        second_response = self.client.post(
            reverse('chat-list'),
            {'chat_type': Chat.ChatType.DIRECT, 'direct_user_id': self.outsider.id},
            format='json',
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        chat = Chat.objects.get(id=first_response.json()['id'])
        self.assertEqual(chat.chat_type, Chat.ChatType.DIRECT)
        self.assertTrue(ChatMember.objects.filter(chat=chat, user=self.member, role=ChatMember.Role.OWNER).exists())
        self.assertTrue(ChatMember.objects.filter(chat=chat, user=self.outsider, role=ChatMember.Role.MEMBER).exists())
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_group_chat_creator_can_add_participants_on_create(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse('chat-list'),
            {
                'title': 'New group',
                'chat_type': Chat.ChatType.CORPORATE,
                'description': 'Demo',
                'participant_ids': [self.member.id, self.outsider.id],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        chat = Chat.objects.get(id=response.json()['id'])
        self.assertEqual(chat.created_by, self.owner)
        self.assertEqual(chat.chat_type, Chat.ChatType.CORPORATE)
        self.assertEqual(chat.chat_members.count(), 3)

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

    def test_owner_can_delete_group_chat(self):
        self.client.force_authenticate(self.owner)

        response = self.client.delete(reverse('chat-detail', args=[self.chat.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Chat.objects.filter(id=self.chat.id).exists())

    def test_role_admin_can_see_and_update_any_chat(self):
        admin = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        self.client.force_authenticate(admin)

        list_response = self.client.get(reverse('chat-list'))
        update_response = self.client.patch(
            reverse('chat-detail', args=[self.foreign_chat.id]),
            {'title': 'Changed by role admin'},
            format='json',
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            sorted(item['id'] for item in results(list_response)),
            sorted([self.chat.id, self.foreign_chat.id]),
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.foreign_chat.refresh_from_db()
        self.assertEqual(self.foreign_chat.title, 'Changed by role admin')

    def test_chat_list_returns_unread_count(self):
        Message.objects.create(chat=self.chat, sender=self.owner, text='Unread for member')
        Message.objects.create(chat=self.chat, sender=self.member, text='Own message is not unread')
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('chat-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = results(response)[0]
        self.assertEqual(item['unread_count'], 1)
        self.assertIsNone(item['last_read_message'])
        self.assertIsNone(item['last_read_at'])

    def test_mark_read_endpoint_resets_unread_count(self):
        first_message = Message.objects.create(chat=self.chat, sender=self.owner, text='Unread')
        self.client.force_authenticate(self.member)

        mark_response = self.client.post(reverse('chat-mark-read', args=[self.chat.id]), format='json')
        list_response = self.client.get(reverse('chat-list'))

        self.assertEqual(mark_response.status_code, status.HTTP_200_OK)
        self.assertEqual(mark_response.json()['chat'], self.chat.id)
        self.assertEqual(mark_response.json()['last_read_message'], first_message.id)
        self.assertEqual(results(list_response)[0]['unread_count'], 0)
        self.assertTrue(
            MessageReadReceipt.objects.filter(
                chat=self.chat,
                user=self.member,
                last_read_message=first_message,
            ).exists()
        )

    def test_mark_read_rejects_message_from_another_chat(self):
        foreign_message = Message.objects.create(chat=self.foreign_chat, sender=self.outsider, text='Hidden')
        self.client.force_authenticate(self.member)

        response = self.client.post(
            reverse('chat-mark-read', args=[self.chat.id]),
            {'last_message_id': foreign_message.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('last_message_id', response.json()['field_errors'])

    def test_user_cannot_mark_foreign_chat_read(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(reverse('chat-mark-read', args=[self.foreign_chat.id]), format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_read_updates_chat_and_message_read_fields(self):
        message = Message.objects.create(chat=self.chat, sender=self.owner, text='Read receipt check')
        self.client.force_authenticate(self.member)

        mark_response = self.client.post(
            reverse('chat-mark-read', args=[self.chat.id]),
            {'last_message_id': message.id},
            format='json',
        )
        chats_response = self.client.get(reverse('chat-list'))
        messages_response = self.client.get(reverse('message-list'), {'chat': self.chat.id})

        self.assertEqual(mark_response.status_code, status.HTTP_200_OK)
        chat_data = results(chats_response)[0]
        message_data = results(messages_response)[0]
        self.assertEqual(chat_data['unread_count'], 0)
        self.assertEqual(chat_data['last_read_message'], message.id)
        self.assertIsNotNone(chat_data['last_read_at'])
        self.assertTrue(message_data['is_read'])
        self.assertEqual(message_data['read_by_count'], 1)

    def test_mark_read_with_stale_message_keeps_newer_messages_unread(self):
        first_message = Message.objects.create(chat=self.chat, sender=self.owner, text='First')
        second_message = Message.objects.create(chat=self.chat, sender=self.owner, text='Second')
        self.client.force_authenticate(self.member)

        mark_response = self.client.post(
            reverse('chat-mark-read', args=[self.chat.id]),
            {'last_message_id': first_message.id},
            format='json',
        )
        chats_response = self.client.get(reverse('chat-list'))
        messages_response = self.client.get(reverse('message-list'), {'chat': self.chat.id})

        self.assertEqual(mark_response.status_code, status.HTTP_200_OK)
        self.assertEqual(results(chats_response)[0]['unread_count'], 1)
        message_rows = results(messages_response)
        self.assertTrue(message_rows[0]['is_read'])
        self.assertFalse(message_rows[1]['is_read'])

        self.client.post(
            reverse('chat-mark-read', args=[self.chat.id]),
            {'last_message_id': second_message.id},
            format='json',
        )
        stale_response = self.client.post(
            reverse('chat-mark-read', args=[self.chat.id]),
            {'last_message_id': first_message.id},
            format='json',
        )
        receipt = MessageReadReceipt.objects.get(chat=self.chat, user=self.member)

        self.assertEqual(stale_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt.last_read_message, second_message)


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

    def test_role_admin_can_add_chat_member_without_chat_membership(self):
        admin = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        self.client.force_authenticate(admin)

        response = self.client.post(
            reverse('chat-member-list'),
            {'chat': self.chat.id, 'user': self.new_user.id, 'role': ChatMember.Role.MEMBER},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ChatMember.objects.filter(chat=self.chat, user=self.new_user).exists())

    def test_owner_can_remove_member(self):
        self.client.force_authenticate(self.owner)

        response = self.client.delete(reverse('chat-member-detail', args=[self.member_record.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ChatMember.objects.filter(id=self.member_record.id).exists())

    def test_member_cannot_remove_another_member(self):
        self.client.force_authenticate(self.member)

        response = self.client.delete(reverse('chat-member-detail', args=[self.owner_record.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(ChatMember.objects.filter(id=self.owner_record.id).exists())

    def test_last_owner_cannot_be_removed(self):
        self.client.force_authenticate(self.owner)

        response = self.client.delete(reverse('chat-member-detail', args=[self.owner_record.id]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(ChatMember.objects.filter(id=self.owner_record.id).exists())
