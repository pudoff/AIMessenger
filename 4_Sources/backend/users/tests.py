import os
from io import StringIO
from unittest.mock import patch

from django.core.management import CommandError, call_command
from django.test import TestCase
from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


class AuthApiTests(APITestCase):
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
        self.assertNotIn('password', data)
        user = User.objects.get(username='demo')
        self.assertTrue(user.check_password('StrongPassword123'))
        self.assertIsNotNone(user.user_agreement_accepted_at)
        self.assertIsNotNone(user.privacy_policy_accepted_at)

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
