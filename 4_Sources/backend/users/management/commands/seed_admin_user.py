import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Seed admin user from ADMIN_USER and ADMIN_PASSWORD environment variables"

    def handle(self, *args, **options):
        admin_username = os.getenv("ADMIN_USER")
        admin_password = os.getenv("ADMIN_PASSWORD")

        if not admin_username and not admin_password:
            self.stdout.write("Admin seed skipped: ADMIN_USER and ADMIN_PASSWORD arСe not set.")
            return

        if not admin_username or not admin_password:
            raise CommandError("ADMIN_USER and ADMIN_PASSWORD must be set together.")

        User = get_user_model()
        if User.objects.filter(username=admin_username).exists():
            self.stdout.write(f"Admin user {admin_username} already exists.")
            return

        User.objects.create_superuser(username=admin_username, password=admin_password)
        self.stdout.write(self.style.SUCCESS(f"Admin user {admin_username} created."))
