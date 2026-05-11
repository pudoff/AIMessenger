from django.contrib import admin

from .models import Message, MessageClassification


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
