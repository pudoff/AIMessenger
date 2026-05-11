from datetime import timedelta

from django.db.models import Count
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, views, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers, status

from chats.models import Chat, ChatMember
from messages.models import Message
from .models import Contact, User
from .permissions import IsProjectAdminUser, is_project_admin
from .serializers import ContactSerializer, CurrentUserSerializer, PublicUserSerializer, RegisterSerializer, UserSerializer


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


class UserSearchViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PublicUserSerializer

    def get_queryset(self):
        queryset = User.objects.filter(is_active=True).order_by('username')
        user = self.request.user
        if user.is_authenticated:
            queryset = queryset.exclude(id=user.id)

        query = self.request.query_params.get('q')
        if query:
            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(phone_number__icontains=query)
            )

        return queryset


class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer

    def get_queryset(self):
        queryset = Contact.objects.select_related('owner', 'contact')
        if is_project_admin(self.request.user):
            return queryset
        return queryset.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], url_path='direct-chat')
    def direct_chat(self, request, pk=None):
        contact = self.get_object().contact
        existing = (
            Chat.objects.filter(chat_type=Chat.ChatType.DIRECT, chat_members__user=request.user)
            .filter(chat_members__user=contact)
            .distinct()
            .first()
        )
        if existing:
            return Response({'chat': existing.id, 'created': False}, status=status.HTTP_200_OK)

        chat = Chat.objects.create(
            title=f'Direct chat {request.user.id}-{contact.id}',
            chat_type=Chat.ChatType.DIRECT,
            created_by=request.user,
        )
        ChatMember.objects.create(chat=chat, user=request.user, role=ChatMember.Role.OWNER)
        ChatMember.objects.create(chat=chat, user=contact, role=ChatMember.Role.MEMBER)
        return Response({'chat': chat.id, 'created': True}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-to-chat')
    def add_to_chat(self, request, pk=None):
        contact = self.get_object().contact
        chat_id = request.data.get('chat')
        role = request.data.get('role', ChatMember.Role.MEMBER)

        if role not in ChatMember.Role.values:
            raise serializers.ValidationError({'role': 'Invalid chat member role.'})

        try:
            chat = Chat.objects.get(id=chat_id)
        except (Chat.DoesNotExist, TypeError, ValueError):
            raise serializers.ValidationError({'chat': 'Chat does not exist.'})

        if chat.chat_type not in (Chat.ChatType.GROUP, Chat.ChatType.CORPORATE):
            raise serializers.ValidationError({'chat': 'Contacts can be added only to group or corporate chats.'})

        if not is_project_admin(request.user) and not chat.chat_members.filter(
            user=request.user,
            role__in=(ChatMember.Role.OWNER, ChatMember.Role.ADMIN),
        ).exists():
            return Response(
                {'detail': 'You do not have permission to add members to this chat.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        member, created = ChatMember.objects.get_or_create(
            chat=chat,
            user=contact,
            defaults={'role': role},
        )
        return Response(
            {'chat_member': member.id, 'created': created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


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
