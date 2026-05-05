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
        user = User.objects.create_user(username='role_admin', password='pass', role=User.Role.ADMIN)
        self.client.force_authenticate(user)

        response = self.client.get(reverse('user-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_drf_login_redirects_to_api_root(self):
        self.assertEqual(settings.LOGIN_REDIRECT_URL, '/api/')

        User.objects.create_user(username='demo', password='StrongPassword123')

        response = self.client.post(
            '/api/auth/login/',
            {'username': 'demo', 'password': 'StrongPassword123'},
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(response['Location'], '/api/')

    def test_cors_preflight_allows_local_frontend_authorization_header(self):
        response = self.client.options(
            reverse('api-me'),
            HTTP_ORIGIN='http://localhost:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['access-control-allow-origin'], 'http://localhost:5173')
        self.assertIn('authorization', response['access-control-allow-headers'].lower())
