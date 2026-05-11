from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, views, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from chats.models import Chat
from messages.models import Message
from .models import User
from .permissions import IsProjectAdminUser
from .serializers import CurrentUserSerializer, RegisterSerializer, UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = (IsProjectAdminUser,)

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get('role')
        status_filter = self.request.query_params.get('status')

        if role:
            queryset = queryset.filter(role=role)
        if status_filter in ('active', 'blocked', 'inactive'):
            if status_filter == 'active':
                queryset = queryset.filter(is_active=True, blocked_until__isnull=True)
            elif status_filter == 'inactive':
                queryset = queryset.filter(is_active=False)
            else:
                queryset = queryset.filter(blocked_until__gt=timezone.now())

        return queryset


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user


class AdminEventsView(views.APIView):
    permission_classes = (IsProjectAdminUser,)

    def get(self, request):
        since = timezone.now() - timedelta(days=1)
        latest_users = User.objects.order_by('-date_joined')[:5]
        latest_chats = Chat.objects.select_related('created_by').order_by('-created_at')[:5]

        return Response({
            'latest_registrations': [
                {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'date_joined': user.date_joined,
                }
                for user in latest_users
            ],
            'created_chats': [
                {
                    'id': chat.id,
                    'title': chat.title,
                    'chat_type': chat.chat_type,
                    'created_by': chat.created_by_id,
                    'created_at': chat.created_at,
                }
                for chat in latest_chats
            ],
            'messages_last_24h': Message.objects.filter(created_at__gte=since).count(),
            'active_users_last_24h': (
                User.objects.filter(messages__created_at__gte=since)
                .annotate(messages_count=Count('messages'))
                .count()
            ),
        })
