from django.conf import settings
from django.db import models
from django.utils import timezone


class Message(models.Model):
    class MessageType(models.TextChoices):
        QUESTION = 'question', 'Question'
        TASK = 'task', 'Task'
        DEFAULT = 'default', 'Default'

    class TaskStatus(models.TextChoices):
        NONE = 'none', 'None'
        TODO = 'todo', 'Todo'
        IN_PROGRESS = 'in_progress', 'In progress'
        DONE = 'done', 'Done'

    chat = models.ForeignKey('chats.Chat', on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages')
    text = models.TextField()
    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.DEFAULT,
    )
    task_status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.NONE,
    )
    analyst_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender}: {self.text[:50]}'


class MessageClassification(models.Model):
    message = models.OneToOneField(
        Message,
        on_delete=models.CASCADE,
        related_name='classification',
    )
    label = models.CharField(max_length=50)
    confidence = models.FloatField(default=0)
    probabilities = models.JSONField(default=dict, blank=True)
    classified_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-classified_at']

    def __str__(self):
        return f'{self.message_id}: {self.label} ({self.confidence:.2f})'
