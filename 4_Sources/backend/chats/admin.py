from django.contrib import admin

from .models import Chat, ChatMember


class ChatMemberInline(admin.TabularInline):
    model = ChatMember
    extra = 1
    autocomplete_fields = ('user',)


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at', 'updated_at')
    search_fields = ('title',)
    inlines = (ChatMemberInline,)


@admin.register(ChatMember)
class ChatMemberAdmin(admin.ModelAdmin):
    list_display = ('chat', 'user', 'role', 'joined_at')
    list_filter = ('role',)
    search_fields = ('chat__title', 'user__username', 'user__email')
    autocomplete_fields = ('chat', 'user')
