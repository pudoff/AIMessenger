from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.db.models import Count
from django.db.models import Q
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.encoding import force_bytes, force_str
from django.utils.html import format_html
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils import timezone
from rest_framework import generics, views, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers, status

from chats.models import Chat, ChatMember
from messages.models import Message
from .models import Contact, User
from .permissions import IsProjectAdminUser, is_project_admin
from .serializers import AdminEmailBroadcastSerializer, ContactSerializer, CurrentUserSerializer, PasswordResetConfirmSerializer, PasswordResetRequestSerializer, PublicUserSerializer, RegisterSerializer, UserSerializer
from .tokens import email_confirmation_token


def frontend_url(path):
    if path.startswith(('http://', 'https://')):
        return path
    return f'{settings.FRONTEND_BASE_URL}{path}'


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
            raise serializers.ValidationError({'role': 'Недопустимая роль участника чата.'})

        try:
            chat = Chat.objects.get(id=chat_id)
        except (Chat.DoesNotExist, TypeError, ValueError):
            raise serializers.ValidationError({'chat': 'Чат не найден.'})

        if chat.chat_type not in (Chat.ChatType.GROUP, Chat.ChatType.CORPORATE):
            raise serializers.ValidationError({'chat': 'Контакты можно добавлять только в групповые или корпоративные чаты.'})

        if not is_project_admin(request.user) and not chat.chat_members.filter(
            user=request.user,
            role__in=(ChatMember.Role.OWNER, ChatMember.Role.ADMIN),
        ).exists():
            raise PermissionDenied('У вас нет прав добавлять участников в этот чат.')

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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user = serializer.save()
            self.send_confirmation_email(request, user)

        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                **serializer.data,
                'detail': 'Письмо для подтверждения регистрации отправлено на email.',
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def send_confirmation_email(self, request, user):
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_confirmation_token.make_token(user)
        path = reverse('api-register-confirm', kwargs={'uidb64': uidb64, 'token': token})
        confirmation_url = request.build_absolute_uri(path)

        plain_message = (
            'Добрый день!\n\n'
            'Для завершения регистрации в мессенджере "Наш Слон" перейдите по ссылке: '
            f'зарегистрироваться ({confirmation_url})\n\n'
            'Если это не вы, просто удалите сообщение.'
        )
        html_message = format_html(
            '<p>Добрый день!</p>'
            '<p>Для завершения регистрации в мессенджере "Наш Слон" перейдите по ссылке: '
            '<a href="{}">зарегистрироваться</a></p>'
            '<p>Если это не вы, просто удалите сообщение.</p>',
            confirmation_url,
        )

        send_mail(
            subject='Подтверждение регистрации в мессенджере "Наш Слон"',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
            html_message=html_message,
        )


class ConfirmRegistrationView(views.APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request, uidb64, token):
        user = self.get_user(uidb64)
        if user and email_confirmation_token.check_token(user, token):
            if not user.is_active:
                user.is_active = True
                user.save(update_fields=['is_active'])
            return redirect(frontend_url(settings.REGISTRATION_CONFIRM_REDIRECT_PATH))

        return redirect(frontend_url(settings.REGISTRATION_CONFIRM_INVALID_REDIRECT_PATH))

    @staticmethod
    def get_user(uidb64):
        try:
            user_id = force_str(urlsafe_base64_decode(uidb64))
            return User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return None


class PasswordResetRequestView(views.APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            self.send_reset_email(request, user)

        return Response({
            'detail': 'Если пользователь с таким email существует, письмо для восстановления пароля будет отправлено.',
        })

    def send_reset_email(self, request, user):
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_path = settings.PASSWORD_RESET_FRONTEND_PATH.format(uidb64=uidb64, token=token)
        reset_url = frontend_url(reset_path)

        plain_message = (
            'Добрый день!\n\n'
            'Для восстановления доступа к мессенджеру "Наш Слон" перейдите по ссылке: '
            f'восстановить доступ ({reset_url})\n\n'
            'Если это не вы, просто удалите сообщение.'
        )
        html_message = format_html(
            '<p>Добрый день!</p>'
            '<p>Для восстановления доступа к мессенджеру "Наш Слон" перейдите по ссылке: '
            '<a href="{}">восстановить доступ</a></p>'
            '<p>Если это не вы, просто удалите сообщение.</p>',
            reset_url,
        )

        send_mail(
            subject='Восстановление доступа к мессенджеру "Наш Слон"',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
            html_message=html_message,
        )


class PasswordResetConfirmView(views.APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Ваш пароль успешно изменен.'})


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



class AdminEmailBroadcastView(views.APIView):
    permission_classes = (IsProjectAdminUser,)

    def post(self, request):
        serializer = AdminEmailBroadcastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipients = serializer.get_recipients()
        if not recipients:
            raise serializers.ValidationError({'recipients': 'Нет получателей с e-mail адресами.'})

        sent_count = send_mail(
            subject=serializer.validated_data['subject'],
            message=serializer.validated_data['message'],
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
        return Response({
            'sent_count': sent_count,
            'recipients': recipients,
        })
