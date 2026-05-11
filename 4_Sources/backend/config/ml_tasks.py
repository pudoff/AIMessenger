from typing import Any

from celery import Celery
from django.conf import settings


app = Celery("backend_ml_client")
app.conf.update(
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_default_queue=settings.ML_CELERY_QUEUE,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
)


def classify_message(message: str) -> Any:
    return app.send_task(
        "ml_service.classify_message",
        args=[message],
        queue=settings.ML_CELERY_QUEUE,
    )


def classify_messages(messages: list[str]) -> Any:
    return app.send_task(
        "ml_service.classify_messages",
        args=[messages],
        queue=settings.ML_CELERY_QUEUE,
    )
