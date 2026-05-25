from typing import Any

from django.conf import settings

try:
    from celery import Celery
except ImportError:
    Celery = None


if Celery is not None:
    app = Celery("backend_ml_client")
    app.conf.update(
        broker_url=settings.CELERY_BROKER_URL,
        result_backend=settings.CELERY_RESULT_BACKEND,
        task_default_queue=settings.ML_CELERY_QUEUE,
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
    )
else:
    app = None


def classify_message(message: str) -> Any:
    if app is None:
        raise RuntimeError("Celery is not installed")
    return app.send_task(
        "ml_service.classify_message",
        args=[message],
        queue=settings.ML_CELERY_QUEUE,
    )


def classify_messages(messages: list[str]) -> Any:
    if app is None:
        raise RuntimeError("Celery is not installed")
    return app.send_task(
        "ml_service.classify_messages",
        args=[messages],
        queue=settings.ML_CELERY_QUEUE,
    )


def embed_text(text: str) -> Any:
    if app is None:
        raise RuntimeError("Celery is not installed")
    return app.send_task(
        "ml_service.embed_text",
        args=[text],
        queue=settings.ML_CELERY_QUEUE,
    )


def embed_texts(texts: list[str]) -> Any:
    if app is None:
        raise RuntimeError("Celery is not installed")
    return app.send_task(
        "ml_service.embed_texts",
        args=[texts],
        queue=settings.ML_CELERY_QUEUE,
    )
