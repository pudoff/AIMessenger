from unittest.mock import patch
from io import StringIO
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.urls import reverse
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from chats.models import Chat, ChatMember
from users.models import User
from .classification import _mock_predict
from .models import Message, MessageAttachment, MessageClassification, MessageEmbedding, MessageReadReceipt
from .tasks import build_message_embedding_task, classify_message_task, fallback_embedding, text_hash
from .views import SemanticSearchView


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

    def test_message_response_contains_read_state(self):
        self.client.force_authenticate(self.member)

        unread_response = self.client.get(reverse('message-list'), {'chat': self.chat.id})
        MessageReadReceipt.objects.create(
            chat=self.chat,
            user=self.member,
            last_read_message=self.message,
            last_read_at=timezone.now(),
        )
        read_response = self.client.get(reverse('message-list'), {'chat': self.chat.id})

        self.assertEqual(unread_response.status_code, status.HTTP_200_OK)
        self.assertFalse(results(unread_response)[0]['is_read'])
        self.assertEqual(results(unread_response)[0]['read_by_count'], 0)
        self.assertTrue(results(read_response)[0]['is_read'])

    def test_sender_sees_message_read_by_other_member(self):
        MessageReadReceipt.objects.create(
            chat=self.chat,
            user=self.member,
            last_read_message=self.message,
            last_read_at=timezone.now(),
        )
        self.client.force_authenticate(self.owner)

        response = self.client.get(reverse('message-detail', args=[self.message.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['is_read'])
        self.assertEqual(response.json()['read_by_count'], 1)

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

    @override_settings(MESSAGE_MAX_LENGTH=10)
    def test_message_text_has_max_length(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(
            reverse('message-list'),
            {'chat': self.chat.id, 'text': 'x' * 11},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.json().get('field_errors') or response.json()
        self.assertIn('text', errors)

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
        self.assertEqual(response.json()['classification']['status'], MessageClassification.Status.PENDING)
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

    def test_author_can_delete_own_message(self):
        self.client.force_authenticate(self.owner)

        response = self.client.delete(reverse('message-detail', args=[self.message.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Message.objects.filter(id=self.message.id).exists())

    def test_member_cannot_delete_other_user_message(self):
        self.client.force_authenticate(self.member)

        response = self.client.delete(reverse('message-detail', args=[self.message.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Message.objects.filter(id=self.message.id).exists())

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

        with patch('messages.tasks.logger.exception'), patch(
            'messages.tasks.classify_message_task.apply_async',
            side_effect=Exception('redis down'),
        ), patch('messages.tasks.build_message_embedding_task.apply_async'):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('message-list'),
                    {'chat': self.chat.id, 'text': 'Still saved'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Message.objects.filter(text='Still saved').exists())

    def test_classification_enqueue_failure_marks_message_for_review(self):
        self.client.force_authenticate(self.owner)

        with patch('messages.tasks.logger.exception'), patch(
            'messages.tasks.classify_message_task.apply_async',
            side_effect=Exception('redis down'),
        ), patch('messages.tasks.build_message_embedding_task.apply_async'):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('message-list'),
                    {'chat': self.chat.id, 'text': 'Still saved with failed queue'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get(text='Still saved with failed queue')
        classification = MessageClassification.objects.get(message=message)
        self.assertEqual(classification.status, MessageClassification.Status.FAILED)
        self.assertTrue(classification.needs_review)
        self.assertIn('redis down', classification.error_message)

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

    def test_message_create_then_classification_task_creates_full_classification(self):
        self.client.force_authenticate(self.member)

        with patch('messages.tasks.build_message_embedding_task.apply_async'):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('message-list'),
                    {'chat': self.chat.id, 'text': 'Нужно подготовить отчет к дедлайну'},
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get(id=response.json()['id'])

        with patch('config.ml_tasks.classify_message') as ml_task:
            ml_task.return_value.get.return_value = {
                'label': 'task',
                'confidence': 0.91,
                'probabilities': {'task': 0.91, 'default': 0.09},
            }
            classify_message_task.run(message.id)

        classification = MessageClassification.objects.get(message=message)
        self.assertEqual(classification.label, 'task')
        self.assertEqual(classification.status, MessageClassification.Status.COMPLETED)
        self.assertEqual(classification.source, MessageClassification.Source.ML_WORKER)
        self.assertFalse(classification.needs_review)
        self.assertGreater(classification.confidence, 0.9)

    @override_settings(ML_TASK_TIMEOUT_SECONDS=0)
    def test_fallback_classifier_detects_basic_task_phrase(self):
        with patch('config.ml_tasks.classify_message', side_effect=Exception('ml offline')):
            classify_message_task.run(self.message.id)

        classification = MessageClassification.objects.get(message=self.message)
        self.assertEqual(classification.label, 'default')

        self.message.text = 'Сделай задачу по демо'
        self.message.save(update_fields=['text'])
        with patch('config.ml_tasks.classify_message', side_effect=Exception('ml offline')):
            classify_message_task.run(self.message.id)

        classification.refresh_from_db()
        self.assertEqual(classification.label, 'task')
        self.assertEqual(classification.status, MessageClassification.Status.COMPLETED)
        self.assertEqual(classification.source, MessageClassification.Source.FALLBACK)
        self.assertFalse(classification.needs_review)

    def test_local_fallback_detects_imperative_and_toxicity(self):
        task_result = _mock_predict('Людочка, принеси мне чай')
        toxic_result = _mock_predict('ты дурак')

        self.assertEqual(task_result['label'], 'task')
        self.assertEqual(toxic_result['label'], 'offtopic')

    def test_local_fallback_treats_greeting_as_default(self):
        for text in ('Добрый день!', 'Здравствуйте', 'Привет всем!'):
            with self.subTest(text=text):
                result = _mock_predict(text)

                self.assertEqual(result['label'], 'default')

    def test_local_fallback_sends_low_quality_text_to_review(self):
        for text, reason in (
            ('Lorem ipsum dolor sit amet', 'lorem_ipsum'),
            ('лоивамдо', 'gibberish'),
            ('яывлмвлмыот', 'gibberish'),
        ):
            with self.subTest(text=text):
                result = _mock_predict(text)

                self.assertEqual(result['label'], 'needs_review')
                self.assertTrue(result['needs_review'])
                self.assertEqual(result['review_reason'], reason)

    def test_local_fallback_does_not_mark_pangram_as_question(self):
        result = _mock_predict('съешь ещё этих мягких французских булок')

        self.assertEqual(result['label'], 'default')

    def test_message_create_accepts_attachment(self):
        self.client.force_authenticate(self.member)
        uploaded = SimpleUploadedFile('note.txt', b'hello file', content_type='text/plain')

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('messages.tasks.classify_message_task.apply_async'), patch('messages.tasks.build_message_embedding_task.apply_async'):
                    with self.captureOnCommitCallbacks(execute=True):
                        response = self.client.post(
                            reverse('message-list'),
                            {'chat': self.chat.id, 'text': '', 'attachments': [uploaded]},
                            format='multipart',
                        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get(id=response.json()['id'])
        attachment = MessageAttachment.objects.get(message=message)
        self.assertEqual(attachment.original_name, 'note.txt')
        self.assertEqual(response.json()['attachments'][0]['original_name'], 'note.txt')

    def test_message_attachment_uses_public_media_base_url(self):
        self.client.force_authenticate(self.member)
        uploaded = SimpleUploadedFile('image.png', b'png bytes', content_type='image/png')

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, BACKEND_PUBLIC_BASE_URL='https://api.example.test'):
                with patch('messages.tasks.classify_message_task.apply_async'), patch('messages.tasks.build_message_embedding_task.apply_async'):
                    with self.captureOnCommitCallbacks(execute=True):
                        response = self.client.post(
                            reverse('message-list'),
                            {'chat': self.chat.id, 'text': '', 'attachments': [uploaded]},
                            format='multipart',
                        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        attachment_url = response.json()['attachments'][0]['url']
        self.assertTrue(attachment_url.startswith('https://api.example.test/media/message_attachments/'))

    def test_message_attachment_can_be_downloaded_by_chat_member(self):
        self.client.force_authenticate(self.member)
        uploaded = SimpleUploadedFile('note.txt', b'hello file', content_type='text/plain')

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('messages.tasks.classify_message_task.apply_async'), patch('messages.tasks.build_message_embedding_task.apply_async'):
                    with self.captureOnCommitCallbacks(execute=True):
                        create_response = self.client.post(
                            reverse('message-list'),
                            {'chat': self.chat.id, 'text': '', 'attachments': [uploaded]},
                            format='multipart',
                        )

                attachment = MessageAttachment.objects.get(message_id=create_response.json()['id'])
                response = self.client.get(reverse('api-message-attachment-download', args=[attachment.id]))
                content = b''.join(response.streaming_content)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertEqual(content, b'hello file')

    def test_message_attachment_download_is_forbidden_for_non_member(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                attachment = MessageAttachment.objects.create(
                    message=self.message,
                    file=SimpleUploadedFile('note.txt', b'hello file', content_type='text/plain'),
                    original_name='note.txt',
                    content_type='text/plain',
                    size=10,
                )
                self.client.force_authenticate(self.outsider)

                response = self.client.get(reverse('api-message-attachment-download', args=[attachment.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_message_attachment_size_limit_is_validated(self):
        self.client.force_authenticate(self.member)
        uploaded = SimpleUploadedFile('large.txt', b'hello file', content_type='text/plain')

        with override_settings(MAX_UPLOAD_SIZE_BYTES=4):
            response = self.client.post(
                reverse('message-list'),
                {'chat': self.chat.id, 'text': '', 'attachments': [uploaded]},
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('attachments', response.json()['field_errors'])

    def test_classification_task_clears_stale_values_while_pending(self):
        MessageClassification.objects.create(
            message=self.message,
            label='task',
            confidence=0.95,
            probabilities={'task': 0.95},
            status=MessageClassification.Status.COMPLETED,
            needs_review=True,
        )

        def assert_pending_state(timeout):
            classification = MessageClassification.objects.get(message=self.message)
            self.assertIsNone(classification.label)
            self.assertEqual(classification.confidence, 0)
            self.assertEqual(classification.probabilities, {})
            self.assertFalse(classification.needs_review)
            self.assertEqual(classification.status, MessageClassification.Status.PENDING)
            return {
                'label': 'default',
                'confidence': 0.9,
                'probabilities': {'default': 0.9},
            }

        with patch('config.ml_tasks.classify_message') as ml_task:
            ml_task.return_value.get.side_effect = assert_pending_state

            classify_message_task.run(self.message.id)

        classification = MessageClassification.objects.get(message=self.message)
        self.assertEqual(classification.status, MessageClassification.Status.COMPLETED)
        self.assertEqual(classification.label, 'default')

    def test_classification_task_postprocesses_low_quality_ml_result(self):
        self.message.text = 'Lorem ipsum dolor sit amet'
        self.message.save(update_fields=['text'])

        with patch('config.ml_tasks.classify_message') as ml_task:
            ml_task.return_value.get.return_value = {
                'label': 'task',
                'class_name': 'task',
                'confidence': 0.98,
                'probabilities': {'task': 0.98},
            }

            classify_message_task.run(self.message.id)

        classification = MessageClassification.objects.get(message=self.message)
        self.assertEqual(classification.label, 'needs_review')
        self.assertTrue(classification.needs_review)

    def test_classification_task_postprocesses_question_without_question_signal(self):
        self.message.text = 'съешь ещё этих мягких французских булок'
        self.message.save(update_fields=['text'])

        with patch('config.ml_tasks.classify_message') as ml_task:
            ml_task.return_value.get.return_value = {
                'label': 'question',
                'class_name': 'question',
                'confidence': 0.98,
                'probabilities': {'question': 0.98},
            }

            classify_message_task.run(self.message.id)

        classification = MessageClassification.objects.get(message=self.message)
        self.assertEqual(classification.label, 'default')
        self.assertFalse(classification.needs_review)

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

    def test_fuzzy_search_finds_word_with_one_typo_without_embedding(self):
        message = Message.objects.create(chat=self.chat, sender=self.owner, text='Обсудим новый мессенджер')
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'мессенжнр', 'chat': self.chat.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['results'][0]
        self.assertEqual(result['message_id'], message.id)
        self.assertEqual(result['search_mode'], 'fuzzy')
        self.assertGreaterEqual(result['similarity_score'], SemanticSearchView.FUZZY_SCORE_THRESHOLD)
        self.assertIn('мессенджер', result['matched_terms'])

    def test_fuzzy_search_finds_phrase_with_two_typos(self):
        message = Message.objects.create(chat=self.chat, sender=self.owner, text='Привет, как дела?')
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'првет как дела', 'chat': self.chat.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['results'][0]
        self.assertEqual(result['message_id'], message.id)
        self.assertEqual(result['search_mode'], 'fuzzy')
        self.assertGreaterEqual(result['similarity_score'], SemanticSearchView.FUZZY_SCORE_THRESHOLD)

    def test_fuzzy_search_does_not_match_unrelated_mention(self):
        target = Message.objects.create(chat=self.chat, sender=self.owner, text='Это тестовое сообщение')
        mention = Message.objects.create(chat=self.chat, sender=self.owner, text='@ivanov')
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'тстово', 'chat': self.chat.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item['message_id'] for item in response.json()['results'] if item['search_mode'] == 'fuzzy']
        self.assertIn(target.id, ids)
        self.assertNotIn(mention.id, ids)

    def test_category_query_returns_classified_questions_without_embedding(self):
        question = Message.objects.create(chat=self.chat, sender=self.owner, text='Как дела?')
        task = Message.objects.create(chat=self.chat, sender=self.owner, text='Людочка, принеси мне чай')
        MessageClassification.objects.create(message=question, label='question', confidence=0.9)
        MessageClassification.objects.create(message=task, label='task', confidence=0.9)
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'вопросы', 'chat': self.chat.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json()['results']
        self.assertEqual([item['message_id'] for item in results], [question.id])
        self.assertEqual(results[0]['search_mode'], 'classification')
        self.assertEqual(results[0]['similarity_score'], 1.0)

    def test_similarity_score_is_clamped_for_display(self):
        self.assertEqual(SemanticSearchView._normalize_similarity_score(-0.25), 0.0)
        self.assertEqual(SemanticSearchView._normalize_similarity_score(1.25), 1.0)

    def test_semantic_search_rejects_invalid_limit(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'deadline', 'limit': '-1'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('limit', response.json()['field_errors'])

    def test_semantic_search_rejects_invalid_chat_id(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'deadline', 'chat': 'abc'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('chat', response.json()['field_errors'])

    def test_semantic_search_rejects_invalid_message_type(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'deadline', 'message_type': 'unknown'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('message_type', response.json()['field_errors'])

    def test_semantic_search_rejects_invalid_date(self):
        self.client.force_authenticate(self.member)

        response = self.client.get(reverse('api-search-semantic'), {'q': 'deadline', 'date_from': 'not-a-date'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('date_from', response.json()['field_errors'])
