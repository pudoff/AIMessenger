from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailConfirmationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        return f'{user.pk}{user.password}{user.is_active}{timestamp}{user.email}'


email_confirmation_token = EmailConfirmationTokenGenerator()
