from django.contrib import admin

from .models import Chat, ChatMember


class ChatMemberInline(admin.TabularInline):
    model = ChatMember
    extra = 1
    autocomplete_fields = ('user',)


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ('title', 'chat_type', 'created_by', 'created_at', 'updated_at')
    list_filter = ('chat_type', 'created_at')
    search_fields = ('title',)
    autocomplete_fields = ('created_by',)
    inlines = (ChatMemberInline,)


@admin.register(ChatMember)
class ChatMemberAdmin(admin.ModelAdmin):
    list_display = ('chat', 'user', 'role', 'joined_at')
    list_filter = ('role',)
    search_fields = ('chat__title', 'user__username', 'user__email')
    autocomplete_fields = ('chat', 'user')
