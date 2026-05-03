from django.contrib import admin

from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('chat', 'sender', 'message_type', 'task_status', 'created_at')
    list_filter = ('message_type', 'task_status', 'created_at')
    search_fields = ('text', 'sender__username', 'chat__title')
    autocomplete_fields = ('chat', 'sender')
    readonly_fields = ('created_at', 'updated_at')
