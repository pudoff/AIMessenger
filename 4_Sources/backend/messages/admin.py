from django.contrib import admin

from .models import Message, MessageAttachment, MessageClassification, MessageEmbedding, MessageReadReceipt


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('chat', 'sender', 'message_type', 'task_status', 'created_at')
    list_filter = ('message_type', 'task_status', 'created_at')
    search_fields = ('text', 'sender__username', 'chat__title')
    autocomplete_fields = ('chat', 'sender')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(MessageClassification)
class MessageClassificationAdmin(admin.ModelAdmin):
    list_display = ('message', 'label', 'confidence', 'classified_at')
    list_filter = ('label', 'classified_at')
    search_fields = ('message__text', 'label')
    autocomplete_fields = ('message',)
    readonly_fields = ('classified_at',)


@admin.register(MessageAttachment)
class MessageAttachmentAdmin(admin.ModelAdmin):
    list_display = ('message', 'original_name', 'content_type', 'size', 'uploaded_at')
    list_filter = ('content_type', 'uploaded_at')
    search_fields = ('original_name', 'message__text', 'message__sender__username')
    autocomplete_fields = ('message',)
    readonly_fields = ('uploaded_at',)


@admin.register(MessageEmbedding)
class MessageEmbeddingAdmin(admin.ModelAdmin):
    list_display = ('message', 'model_name', 'dimensions', 'source', 'updated_at')
    list_filter = ('source', 'model_name', 'updated_at')
    search_fields = ('message__text', 'model_name')
    autocomplete_fields = ('message',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(MessageReadReceipt)
class MessageReadReceiptAdmin(admin.ModelAdmin):
    list_display = ('chat', 'user', 'last_read_message', 'last_read_at')
    list_filter = ('last_read_at',)
    search_fields = ('chat__title', 'user__username', 'last_read_message__text')
    autocomplete_fields = ('chat', 'user', 'last_read_message')
    readonly_fields = ('last_read_at',)
