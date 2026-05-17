from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ADMIN = 'admin', 'Admin'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.USER,
    )
    birth_date = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=32, unique=True, null=True, blank=True)
    accepted_user_agreement = models.BooleanField(default=False)
    accepted_privacy_policy = models.BooleanField(default=False)
    user_agreement_accepted_at = models.DateTimeField(null=True, blank=True)
    privacy_policy_accepted_at = models.DateTimeField(null=True, blank=True)
    blocked_until = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.is_superuser or self.is_staff:
            self.role = self.Role.ADMIN
        now = timezone.now()
        if self.accepted_user_agreement and self.user_agreement_accepted_at is None:
            self.user_agreement_accepted_at = now
        if self.accepted_privacy_policy and self.privacy_policy_accepted_at is None:
            self.privacy_policy_accepted_at = now
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username


class Contact(models.Model):
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='contacts',
    )
    contact = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='in_contact_lists',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['owner', 'contact'], name='unique_user_contact'),
            models.CheckConstraint(
                condition=~models.Q(owner=models.F('contact')),
                name='prevent_self_contact',
            ),
        ]
        ordering = ['contact__username']

    def __str__(self):
        return f'{self.owner} -> {self.contact}'
