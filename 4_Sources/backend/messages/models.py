from django.conf import settings
from django.db import models


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
