from django.conf import settings
from django.db import models
from django.utils import timezone

try:
    from pgvector.django import HnswIndex, VectorField
except ImportError:
    HnswIndex = None

    class VectorField(models.JSONField):
        def __init__(self, *args, dimensions=None, **kwargs):
            self.dimensions = dimensions
            super().__init__(*args, **kwargs)

        def deconstruct(self):
            name, path, args, kwargs = super().deconstruct()
            kwargs.pop("dimensions", None)
            return name, "django.db.models.JSONField", args, kwargs


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
    text = models.TextField(blank=True)
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


class MessageAttachment(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file = models.FileField(upload_to='message_attachments/%Y/%m/%d/')
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at', 'id']

    def __str__(self):
        return self.original_name


class MessageClassification(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    class Source(models.TextChoices):
        MOCK = 'mock', 'Mock'
        ML_WORKER = 'ml_worker', 'ML worker'
        FALLBACK = 'fallback', 'Fallback'

    message = models.OneToOneField(
        Message,
        on_delete=models.CASCADE,
        related_name='classification',
    )
    label = models.CharField(max_length=50, blank=True, null=True)
    confidence = models.FloatField(default=0)
    probabilities = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.ML_WORKER)
    needs_review = models.BooleanField(default=False)
    classified_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-classified_at']

    def __str__(self):
        return f'{self.message_id}: {self.label} ({self.confidence:.2f})'


class MessageEmbedding(models.Model):
    message = models.OneToOneField(
        Message,
        on_delete=models.CASCADE,
        related_name='embedding',
    )
    vector = VectorField(dimensions=getattr(settings, 'EMBEDDING_DIMENSIONS', 384))
    text_hash = models.CharField(max_length=64, db_index=True)
    model_name = models.CharField(max_length=255)
    dimensions = models.PositiveIntegerField(default=getattr(settings, 'EMBEDDING_DIMENSIONS', 384))
    source = models.CharField(max_length=20, default='ml_worker')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = (
            [
                HnswIndex(
                name='message_embedding_hnsw_idx',
                fields=['vector'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
                ),
            ]
            if HnswIndex is not None
            else []
        )

    def __str__(self):
        return f'{self.message_id}: {self.model_name}'


class MessageReadReceipt(models.Model):
    chat = models.ForeignKey(
        'chats.Chat',
        on_delete=models.CASCADE,
        related_name='read_receipts',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='message_read_receipts',
    )
    last_read_message = models.ForeignKey(
        Message,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='read_receipts',
    )
    last_read_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-last_read_at']
        constraints = [
            models.UniqueConstraint(fields=['chat', 'user'], name='unique_chat_read_receipt'),
        ]
        indexes = [
            models.Index(fields=['chat', 'user']),
            models.Index(fields=['user', 'last_read_at']),
        ]

    def __str__(self):
        return f'{self.user} read {self.chat} at {self.last_read_at:%Y-%m-%d %H:%M:%S}'
