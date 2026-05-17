from django.conf import settings
from django.db import models


class Chat(models.Model):
    class ChatType(models.TextChoices):
        DIRECT = 'direct', 'Direct'
        GROUP = 'group', 'Group'
        CORPORATE = 'corporate', 'Corporate'

    title = models.CharField(max_length=255)
    chat_type = models.CharField(
        max_length=20,
        choices=ChatType.choices,
        default=ChatType.GROUP,
    )
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_chats',
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='ChatMember',
        related_name='chats',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class ChatMember(models.Model):
    class Role(models.TextChoices):
        MEMBER = 'member', 'Member'
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='chat_members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_memberships')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['chat', 'user'], name='unique_chat_member'),
        ]
        ordering = ['joined_at']

    def __str__(self):
        return f'{self.user} in {self.chat}'
