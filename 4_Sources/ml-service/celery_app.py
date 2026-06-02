import os

from celery import Celery


app = Celery(
    "ml_service",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"),
    include=["tasks"],
)

app.conf.update(
    task_default_queue=os.getenv("CELERY_QUEUE", "ml"),
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Yekaterinburg",
    enable_utc=True,
    task_time_limit=int(os.getenv("CELERY_TASK_TIME_LIMIT", os.getenv("ML_CELERY_TASK_TIME_LIMIT", "300"))),
    task_soft_time_limit=int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", os.getenv("ML_CELERY_TASK_SOFT_TIME_LIMIT", "240"))),
    worker_prefetch_multiplier=int(os.getenv("CELERY_WORKER_PREFETCH_MULTIPLIER", os.getenv("ML_CELERY_WORKER_PREFETCH_MULTIPLIER", "1"))),
)
