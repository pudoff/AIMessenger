from unittest.mock import patch
from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from chats.models import Chat, ChatMember
from users.models import User
from .models import Message, MessageClassification, MessageEmbedding
from .tasks import build_message_embedding_task, classify_message_task, fallback_embedding, text_hash


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

        with patch('messages.tasks.classify_message_task.apply_async') as classify_task, patch('messages.tasks.build_message_embedding_task.apply_async') as embedding_task:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('message-list'),
                    {'chat': self.chat.id, 'sender': self.owner.id, 'text': 'From current user'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Message.objects.get(id=response.json()['id'])
        self.assertEqual(created.sender, self.member)
        self.assertIn('classification', response.json())
        self.assertIsNone(response.json()['classification'])
        classify_task.assert_called_once()
        embedding_task.assert_called_once()

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
        self.assertIn('task_status', response.json()['field_errors'])

    def test_role_admin_can_see_and_update_any_message(self):
        admin = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        self.client.force_authenticate(admin)

        list_response = self.client.get(reverse('message-list'))
        update_response = self.client.patch(
            reverse('message-detail', args=[self.foreign_message.id]),
            {'text': 'Updated by role admin'},
            format='json',
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item['id'] for item in results(list_response)],
            [self.message.id, self.foreign_message.id],
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.foreign_message.refresh_from_db()
        self.assertEqual(self.foreign_message.text, 'Updated by role admin')

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

    def test_text_update_queues_ml_tasks(self):
        self.client.force_authenticate(self.owner)

        with patch('messages.tasks.classify_message_task.apply_async') as classify_task, patch('messages.tasks.build_message_embedding_task.apply_async') as embedding_task:
            with self.captureOnCommitCallbacks(execute=True):
                create_response = self.client.post(
                    reverse('message-list'),
                    {'chat': self.chat.id, 'text': 'Hello'},
                    format='json',
                )
            message_id = create_response.json()['id']
            with self.captureOnCommitCallbacks(execute=True):
                update_response = self.client.patch(
                    reverse('message-detail', args=[message_id]),
                    {'text': 'Please prepare report'},
                    format='json',
                )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(classify_task.call_count, 2)
        self.assertEqual(embedding_task.call_count, 2)

    def test_ml_worker_error_does_not_break_message_creation(self):
        self.client.force_authenticate(self.owner)

        with patch('messages.tasks.classify_message_task.apply_async', side_effect=Exception('redis down')):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('message-list'),
                    {'chat': self.chat.id, 'text': 'Still saved'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Message.objects.filter(text='Still saved').exists())

    def test_classification_task_is_idempotent(self):
        with patch('config.ml_tasks.classify_message') as ml_task:
            ml_task.return_value.get.return_value = {
                'label': 'task',
                'confidence': 0.95,
                'probabilities': {'task': 0.95},
            }

            classify_message_task.run(self.message.id)
            classify_message_task.run(self.message.id)

        self.assertEqual(MessageClassification.objects.filter(message=self.message).count(), 1)

    def test_embedding_task_is_idempotent(self):
        with patch('config.ml_tasks.embed_text') as ml_task:
            ml_task.return_value.get.return_value = {
                'embedding': fallback_embedding(self.message.text),
                'model_name': 'test-model',
                'dimensions': 384,
            }

            build_message_embedding_task.run(self.message.id)
            build_message_embedding_task.run(self.message.id)

        self.assertEqual(MessageEmbedding.objects.filter(message=self.message).count(), 1)

    def test_rebuild_command_creates_embeddings_for_old_messages(self):
        with patch('config.ml_tasks.embed_text') as ml_task:
            ml_task.return_value.get.return_value = {
                'embedding': fallback_embedding(self.message.text),
                'model_name': 'test-model',
                'dimensions': 384,
            }

            call_command('rebuild_message_embeddings', '--sync', stdout=StringIO())

        self.assertTrue(MessageEmbedding.objects.filter(message=self.message, text_hash=text_hash(self.message.text)).exists())


class SemanticSearchTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.member = User.objects.create_user(username='member', password='pass')
        self.outsider = User.objects.create_user(username='outsider', password='pass')
        self.admin = User.objects.create_user(username='admin', password='pass', role=User.Role.ADMIN)

        self.chat = Chat.objects.create(title='Team chat')
        ChatMember.objects.create(chat=self.chat, user=self.owner, role=ChatMember.Role.OWNER)
        ChatMember.objects.create(chat=self.chat, user=self.member, role=ChatMember.Role.MEMBER)
        self.foreign_chat = Chat.objects.create(title='Foreign chat')
        ChatMember.objects.create(chat=self.foreign_chat, user=self.outsider, role=ChatMember.Role.OWNER)

        self.visible = Message.objects.create(chat=self.chat, sender=self.owner, text='Sprint deadline report')
        self.hidden = Message.objects.create(chat=self.foreign_chat, sender=self.outsider, text='Secret roadmap')
        self.no_embedding = Message.objects.create(chat=self.chat, sender=self.member, text='No embedding yet')
        MessageEmbedding.objects.create(
            message=self.visible,
            vector=fallback_embedding(self.visible.text),
            text_hash=text_hash(self.visible.text),
            model_name='test',
            dimensions=384,
        )
        MessageEmbedding.objects.create(
            message=self.hidden,
            vector=fallback_embedding(self.hidden.text),
            text_hash=text_hash(self.hidden.text),
            model_name='test',
            dimensions=384,
        )

    def test_user_does_not_get_semantic_results_from_foreign_chats(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'deadline'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['message_id'] for item in response.json()['results']], [self.visible.id])

    def test_admin_gets_results_from_different_chats(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'roadmap', 'limit': 10})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            sorted(item['message_id'] for item in response.json()['results']),
            sorted([self.visible.id, self.hidden.id]),
        )

    def test_message_without_embedding_does_not_break_search(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'anything'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(self.no_embedding.id, [item['message_id'] for item in response.json()['results']])
