import os


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

try:
    from celery import Celery
except ImportError:
    class _FallbackApp:
        def config_from_object(self, *args, **kwargs):
            return None

        def autodiscover_tasks(self):
            return None

    app = _FallbackApp()
else:
    app = Celery("backend")
    app.config_from_object("django.conf:settings", namespace="CELERY")
    app.autodiscover_tasks()
