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
