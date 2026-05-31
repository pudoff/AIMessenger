from urllib.parse import urlparse
import socket

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Smoke-check Redis broker connectivity and optional Celery worker availability."

    def handle(self, *args, **options):
        self._check_redis(settings.CELERY_BROKER_URL)
        self.stdout.write(self.style.SUCCESS("Redis broker ping: OK"))

        try:
            from config.celery import app
            inspector = app.control.inspect(timeout=2)
            workers = inspector.ping() or {}
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"Celery inspect skipped: {exc}"))
            return

        if not workers:
            raise CommandError("No Celery workers responded to inspect ping.")
        self.stdout.write(self.style.SUCCESS(f"Celery workers: {', '.join(workers.keys())}"))

    @staticmethod
    def _check_redis(url):
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=3) as connection:
            connection.sendall(b"*1\r\n$4\r\nPING\r\n")
            response = connection.recv(16)
        if not response.startswith(b"+PONG"):
            raise CommandError(f"Unexpected Redis response: {response!r}")
