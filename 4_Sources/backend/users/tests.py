import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from django.conf import settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.authtoken.models import Token
from rest_framework import status
from rest_framework.test import APITestCase

from chats.models import Chat, ChatMember
from messages.models import Message
from .models import Contact, User
from .tokens import email_confirmation_token


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='notify@nash-slon.local',
    FRONTEND_BASE_URL='http://frontend.test',
)
class AuthApiTests(APITestCase):
    def test_api_root_is_available_for_authenticated_user(self):
        user = User.objects.create_user(username='demo', password='pass')
        self.client.force_authenticate(user)

        response = self.client.get('/api/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('chats', response.json())

    def test_user_can_register(self):
        response = self.client.post(
            reverse('api-register'),
            {
                'username': 'demo',
                'password': 'StrongPassword123',
                'email': 'demo@example.com',
                'first_name': 'Demo',
                'last_name': 'User',
                'birth_date': '1995-05-04',
                'phone_number': '+79990000001',
                'accepted_user_agreement': True,
                'accepted_privacy_policy': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['username'], 'demo')
        self.assertEqual(data['role'], User.Role.USER)
        self.assertEqual(data['birth_date'], '1995-05-04')
        self.assertEqual(data['phone_number'], '+79990000001')
        self.assertTrue(data['accepted_user_agreement'])
        self.assertTrue(data['accepted_privacy_policy'])
        self.assertEqual(data['detail'], 'Письмо для подтверждения регистрации отправлено на email.')
        self.assertNotIn('password', data)
        user = User.objects.get(username='demo')
        self.assertTrue(user.check_password('StrongPassword123'))
        self.assertFalse(user.is_active)
        self.assertIsNotNone(user.user_agreement_accepted_at)
        self.assertIsNotNone(user.privacy_policy_accepted_at)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['demo@example.com'])
        self.assertIn('Подтверждение регистрации', mail.outbox[0].subject)
        self.assertIn('/api/register/confirm/', mail.outbox[0].body)
        self.assertIn('зарегистрироваться', mail.outbox[0].alternatives[0][0])

    def test_user_can_confirm_registration_by_email_link(self):
        user = User.objects.create_user(
            username='demo',
            password='StrongPassword123',
            email='demo@example.com',
            is_active=False,
        )
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_confirmation_token.make_token(user)

        response = self.client.get(
            reverse('api-register-confirm', kwargs={'uidb64': uidb64, 'token': token})
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(response['Location'], 'http://frontend.test/register?registration=confirmed')
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertFalse(email_confirmation_token.check_token(user, token))

    def test_invalid_registration_confirmation_redirects_to_register_page(self):
        user = User.objects.create_user(
            username='demo',
            password='StrongPassword123',
            email='demo@example.com',
            is_active=False,
        )
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

        response = self.client.get(
            reverse('api-register-confirm', kwargs={'uidb64': uidb64, 'token': 'bad-token'})
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(response['Location'], 'http://frontend.test/register?registration=invalid')
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_password_reset_request_sends_email_for_active_user(self):
        user = User.objects.create_user(
            username='demo',
            password='OldPassword123',
            email='demo@example.com',
            is_active=True,
        )

        response = self.client.post(
            reverse('api-password-reset'),
            {'email': 'demo@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [user.email])
        self.assertIn('Восстановление доступа', mail.outbox[0].subject)
        self.assertIn('/reset-password/', mail.outbox[0].body)
        self.assertIn('восстановить доступ', mail.outbox[0].alternatives[0][0])

    def test_password_reset_request_does_not_disclose_unknown_email(self):
        response = self.client.post(
            reverse('api-password-reset'),
            {'email': 'missing@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_user_can_reset_password_with_valid_token(self):
        user = User.objects.create_user(
            username='demo',
            password='OldPassword123',
            email='demo@example.com',
            is_active=True,
        )
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        response = self.client.post(
            reverse('api-password-reset-confirm'),
            {
                'uidb64': uidb64,
                'token': token,
                'password': 'NewPassword123',
                'confirm_password': 'NewPassword123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['detail'], 'Ваш пароль успешно изменен.')
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPassword123'))
        self.assertFalse(default_token_generator.check_token(user, token))

    def test_password_reset_rejects_invalid_token(self):
        user = User.objects.create_user(
            username='demo',
            password='OldPassword123',
            email='demo@example.com',
            is_active=True,
        )
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

        response = self.client.post(
            reverse('api-password-reset-confirm'),
            {
                'uidb64': uidb64,
                'token': 'bad-token',
                'password': 'NewPassword123',
                'confirm_password': 'NewPassword123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertTrue(user.check_password('OldPassword123'))

    def test_password_reset_requires_matching_passwords(self):
        user = User.objects.create_user(
            username='demo',
            password='OldPassword123',
            email='demo@example.com',
            is_active=True,
        )
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        response = self.client.post(
            reverse('api-password-reset-confirm'),
            {
                'uidb64': uidb64,
                'token': token,
                'password': 'NewPassword123',
                'confirm_password': 'AnotherPassword123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.json())

    def test_user_can_login_with_token_endpoint(self):
        user = User.objects.create_user(username='demo', password='StrongPassword123')

        response = self.client.post(
            reverse('api-token-auth'),
            {'username': 'demo', 'password': 'StrongPassword123'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['token'], Token.objects.get(user=user).key)

    def test_me_accepts_token_authentication(self):
        user = User.objects.create_user(username='demo', password='StrongPassword123')
        token = Token.objects.create(user=user)

        response = self.client.get(reverse('api-me'), HTTP_AUTHORIZATION=f'Token {token.key}')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['username'], 'demo')

    def test_invalid_token_is_rejected(self):
        response = self.client.get(reverse('api-me'), HTTP_AUTHORIZATION='Token invalid-token')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_cannot_register_without_required_profile_fields(self):
        response = self.client.post(
            reverse('api-register'),
            {
                'username': 'demo',
                'password': 'StrongPassword123',
                'email': 'demo@example.com',
                'first_name': 'Demo',
                'last_name': 'User',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('birth_date', response.json())
        self.assertIn('phone_number', response.json())
        self.assertIn('accepted_user_agreement', response.json())
        self.assertIn('accepted_privacy_policy', response.json())

    def test_user_must_accept_legal_documents_to_register(self):
        response = self.client.post(
            reverse('api-register'),
            {
                'username': 'demo',
                'password': 'StrongPassword123',
                'email': 'demo@example.com',
                'first_name': 'Demo',
                'last_name': 'User',
                'birth_date': '1995-05-04',
                'phone_number': '+79990000001',
                'accepted_user_agreement': False,
                'accepted_privacy_policy': False,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('accepted_user_agreement', response.json())
        self.assertIn('accepted_privacy_policy', response.json())

    def test_current_user_endpoint_returns_frontend_profile(self):
        user = User.objects.create_user(
            username='demo',
            password='pass',
            email='demo@example.com',
            first_name='Demo',
            last_name='User',
            birth_date='1995-05-04',
            phone_number='+79990000001',
            accepted_user_agreement=True,
            accepted_privacy_policy=True,
        )
        self.client.force_authenticate(user)

        response = self.client.get(reverse('api-me'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                'id': user.id,
                'username': 'demo',
                'email': 'demo@example.com',
                'first_name': 'Demo',
                'last_name': 'User',
                'birth_date': '1995-05-04',
                'phone_number': '+79990000001',
                'accepted_user_agreement': True,
                'accepted_privacy_policy': True,
                'role': User.Role.USER,
            },
        )

    def test_regular_user_cannot_access_admin_users_endpoint(self):
        user = User.objects.create_user(username='demo', password='pass')
        self.client.force_authenticate(user)

        response = self.client.get(reverse('user-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_admin_can_access_admin_users_endpoint(self):
        admin = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        regular_user = User.objects.create_user(username='regular', password='pass')
        self.client.force_authenticate(admin)

        response = self.client.get(reverse('user-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item['id'] for item in response.json()['results']],
            [admin.id, regular_user.id],
        )

    def test_role_admin_can_filter_and_block_users(self):
        admin = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        regular_user = User.objects.create_user(username='regular', password='pass')
        self.client.force_authenticate(admin)

        list_response = self.client.get(reverse('user-list'), {'role': User.Role.USER, 'status': 'active'})
        patch_response = self.client.patch(
            reverse('user-detail', args=[regular_user.id]),
            {'is_active': False, 'role': User.Role.ADMIN},
            format='json',
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in list_response.json()['results']], [regular_user.id])
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        regular_user.refresh_from_db()
        self.assertFalse(regular_user.is_active)
        self.assertEqual(regular_user.role, User.Role.ADMIN)

    def test_regular_user_cannot_access_admin_events(self):
        user = User.objects.create_user(username='demo', password='pass')
        self.client.force_authenticate(user)

        response = self.client.get(reverse('api-admin-events'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_admin_can_access_admin_events(self):
        admin = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        self.client.force_authenticate(admin)

        response = self.client.get(reverse('api-admin-events'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('latest_registrations', response.json())
        self.assertIn('messages_last_24h', response.json())


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='notify@nash-slon.local',
)
class AdminEmailBroadcastTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        self.user = User.objects.create_user(username='demo', password='pass', email='demo@example.com')

    def test_regular_user_cannot_send_admin_email_broadcast(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse('api-admin-email-broadcast'),
            {'subject': 'Новости', 'message': 'Текст письма'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_admin_can_send_email_broadcast(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse('api-admin-email-broadcast'),
            {
                'subject': 'Итоги недели',
                'message': 'Краткие итоги проекта.',
                'user_ids': [self.user.id],
                'emails': ['external@example.com'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['sent_count'], 1)
        self.assertEqual(
            sorted(response.json()['recipients']),
            ['demo@example.com', 'external@example.com'],
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, 'Итоги недели')


class ContactApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass', email='owner@example.com')
        self.contact = User.objects.create_user(
            username='contact',
            password='pass',
            email='contact@example.com',
            first_name='Contact',
        )
        self.other = User.objects.create_user(username='other', password='pass', email='other@example.com')

    def test_user_can_search_other_active_users(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get(reverse('user-search-list'), {'q': 'cont'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.json()['results']], [self.contact.id])

    def test_user_can_add_contact_and_sees_only_own_contacts(self):
        Contact.objects.create(owner=self.other, contact=self.owner)
        self.client.force_authenticate(self.owner)

        create_response = self.client.post(
            reverse('contact-list'),
            {'contact': self.contact.id},
            format='json',
        )
        list_response = self.client.get(reverse('contact-list'))

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.json()['owner'], self.owner.id)
        self.assertEqual(create_response.json()['contact_detail']['username'], 'contact')
        self.assertEqual([item['contact'] for item in list_response.json()['results']], [self.contact.id])

    def test_user_cannot_add_self_or_duplicate_contact(self):
        self.client.force_authenticate(self.owner)

        self_response = self.client.post(reverse('contact-list'), {'contact': self.owner.id}, format='json')
        first_response = self.client.post(reverse('contact-list'), {'contact': self.contact.id}, format='json')
        duplicate_response = self.client.post(reverse('contact-list'), {'contact': self.contact.id}, format='json')

        self.assertEqual(self_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_contact_action_creates_or_reuses_direct_chat(self):
        contact = Contact.objects.create(owner=self.owner, contact=self.contact)
        self.client.force_authenticate(self.owner)

        first_response = self.client.post(reverse('contact-direct-chat', args=[contact.id]), {}, format='json')
        second_response = self.client.post(reverse('contact-direct-chat', args=[contact.id]), {}, format='json')

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first_response.json()['created'])
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertFalse(second_response.json()['created'])
        self.assertEqual(first_response.json()['chat'], second_response.json()['chat'])

    def test_contact_can_be_added_to_group_chat_by_owner(self):
        contact = Contact.objects.create(owner=self.owner, contact=self.contact)
        chat = Chat.objects.create(title='Group', chat_type=Chat.ChatType.GROUP, created_by=self.owner)
        ChatMember.objects.create(chat=chat, user=self.owner, role=ChatMember.Role.OWNER)
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse('contact-add-to-chat', args=[contact.id]),
            {'chat': chat.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ChatMember.objects.filter(chat=chat, user=self.contact).exists())


class SeedAdminUserCommandTests(TestCase):
    def test_creates_admin_from_env_when_missing(self):
        with patch.dict(
            os.environ,
            {"ADMIN_USER": "admin", "ADMIN_PASSWORD": "StrongPassword123"},
            clear=False,
        ):
            call_command("seed_admin_user", stdout=StringIO())

        user = User.objects.get(username="admin")
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertTrue(user.check_password("StrongPassword123"))

    def test_does_not_update_existing_user(self):
        existing_user = User.objects.create_user(username="admin", password="OldPassword123")

        with patch.dict(
            os.environ,
            {"ADMIN_USER": "admin", "ADMIN_PASSWORD": "NewPassword123"},
            clear=False,
        ):
            call_command("seed_admin_user", stdout=StringIO())

        self.assertEqual(User.objects.count(), 1)
        existing_user.refresh_from_db()
        self.assertFalse(existing_user.is_superuser)
        self.assertFalse(existing_user.is_staff)
        self.assertTrue(existing_user.check_password("OldPassword123"))

    def test_skips_when_admin_env_is_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            call_command("seed_admin_user", stdout=StringIO())

        self.assertFalse(User.objects.exists())

    def test_requires_username_and_password_together(self):
        with patch.dict(os.environ, {"ADMIN_USER": "admin"}, clear=True):
            with self.assertRaises(CommandError):
                call_command("seed_admin_user", stdout=StringIO())


class SeedDemoDataCommandTests(TestCase):
    def test_seed_demo_data_is_idempotent(self):
        call_command('seed_demo_data', stdout=StringIO())
        first_counts = (
            User.objects.count(),
            Chat.objects.count(),
            ChatMember.objects.count(),
            Message.objects.count(),
        )

        call_command('seed_demo_data', stdout=StringIO())

        self.assertEqual(
            first_counts,
            (
                User.objects.count(),
                Chat.objects.count(),
                ChatMember.objects.count(),
                Message.objects.count(),
            ),
        )
        self.assertTrue(User.objects.filter(username='admin', role=User.Role.ADMIN).exists())
        self.assertTrue(Chat.objects.filter(chat_type=Chat.ChatType.DIRECT).exists())
        self.assertTrue(Chat.objects.filter(chat_type=Chat.ChatType.CORPORATE).exists())
        self.assertTrue(Message.objects.filter(message_type=Message.MessageType.TASK).exists())
