from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            'Messenger profile',
            {
                'fields': (
                    'role',
                    'birth_date',
                    'phone_number',
                    'accepted_user_agreement',
                    'accepted_privacy_policy',
                    'user_agreement_accepted_at',
                    'privacy_policy_accepted_at',
                    'blocked_until',
                )
            },
        ),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            'Messenger profile',
            {
                'fields': (
                    'role',
                    'birth_date',
                    'phone_number',
                    'accepted_user_agreement',
                    'accepted_privacy_policy',
                )
            },
        ),
    )
    list_display = ('username', 'email', 'phone_number', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active', 'accepted_user_agreement', 'accepted_privacy_policy')
    readonly_fields = ('user_agreement_accepted_at', 'privacy_policy_accepted_at')
