import hashlib
import logging
import math
import random

try:
    from celery import shared_task
    from celery.exceptions import CeleryError, TimeoutError
    from celery.result import allow_join_result
except ImportError:
    class CeleryError(Exception):
        pass

    class TimeoutError(Exception):
        pass

    class _EagerTask:
        max_retries = 3

        class Request:
            retries = 0

        request = Request()

        def __init__(self, func):
            self.func = func
            self.__name__ = func.__name__

        def __call__(self, *args, **kwargs):
            return self.func(self, *args, **kwargs)

        def run(self, *args, **kwargs):
            return self.func(self, *args, **kwargs)

        def apply_async(self, args=None, kwargs=None):
            return self.run(*(args or []), **(kwargs or {}))

        def retry(self, exc=None, countdown=None):
            raise exc or CeleryError("retry")

    def shared_task(*decorator_args, **decorator_kwargs):
        def decorator(func):
            return _EagerTask(func)

        return decorator

    class allow_join_result:
        def __enter__(self):
            return None

        def __exit__(self, exc_type, exc, traceback):
            return False
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from config import ml_tasks
from .classification import classify_text, postprocess_classification_result
from .models import Message, MessageClassification, MessageEmbedding


logger = logging.getLogger(__name__)


def text_hash(text):
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def fallback_embedding(text, dimensions=None):
    dimensions = dimensions or settings.EMBEDDING_DIMENSIONS
    seed = int(hashlib.sha256((text or "").encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)
    vector = [rng.uniform(-1.0, 1.0) for _ in range(dimensions)]
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def enqueue_message_ml_tasks(message_id):
    transaction.on_commit(lambda: _enqueue_after_commit(message_id))


def _enqueue_after_commit(message_id):
    try:
        classify_message_task.apply_async(args=[message_id])
    except Exception as exc:
        logger.exception("Failed to enqueue message classification task for message %s.", message_id)
        _mark_classification_enqueue_failed(message_id, exc)

    try:
        build_message_embedding_task.apply_async(args=[message_id])
    except Exception:
        logger.exception("Failed to enqueue message embedding task for message %s.", message_id)


def _mark_classification_enqueue_failed(message_id, exc):
    try:
        message = Message.objects.get(pk=message_id)
    except Message.DoesNotExist:
        return

    MessageClassification.objects.update_or_create(
        message=message,
        defaults={
            "label": None,
            "confidence": 0,
            "probabilities": {},
            "status": MessageClassification.Status.FAILED,
            "error_message": f"Failed to enqueue classification task: {exc}",
            "source": MessageClassification.Source.ML_WORKER,
            "needs_review": True,
            "classified_at": timezone.now(),
        },
    )


@shared_task(bind=True, max_retries=3, queue=getattr(settings, "BACKEND_CELERY_QUEUE", "backend"))
def classify_message_task(self, message_id):
    try:
        message = Message.objects.get(pk=message_id)
    except Message.DoesNotExist:
        return {"status": "missing", "message_id": message_id}

    MessageClassification.objects.update_or_create(
        message=message,
        defaults={
            "label": None,
            "confidence": 0,
            "probabilities": {},
            "status": MessageClassification.Status.PENDING,
            "error_message": "",
            "source": MessageClassification.Source.ML_WORKER,
            "needs_review": False,
            "classified_at": timezone.now(),
        },
    )

    try:
        async_result = ml_tasks.classify_message(message.text)
        with allow_join_result():
            result = async_result.get(timeout=settings.ML_TASK_TIMEOUT_SECONDS)
        source = MessageClassification.Source.ML_WORKER
    except (CeleryError, TimeoutError) as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)
        logger.warning(
            "ML classification task failed after retries for message %s. Falling back to local classifier.",
            message_id,
            exc_info=True,
        )
        result = classify_text(message.text)
        source = MessageClassification.Source.FALLBACK
        error_message = str(exc)
    except Exception as exc:
        logger.exception("ML classification task failed for message %s. Falling back to local classifier.", message_id)
        result = classify_text(message.text)
        source = MessageClassification.Source.FALLBACK
        error_message = str(exc)
    else:
        error_message = ""

    result = postprocess_classification_result(message.text, result)
    probabilities = result.get("probabilities") or {}
    confidence = float(result.get("confidence") or result.get("max_probability") or 0)
    label = result.get("class_name") or result.get("label")
    needs_review = bool(result.get("needs_review")) or confidence < settings.ML_CONFIDENCE_THRESHOLD
    if needs_review:
        label = "needs_review"

    classification, _ = MessageClassification.objects.update_or_create(
        message=message,
        defaults={
            "label": label,
            "confidence": confidence,
            "probabilities": probabilities,
            "status": MessageClassification.Status.COMPLETED,
            "error_message": error_message,
            "source": source,
            "needs_review": needs_review,
            "classified_at": timezone.now(),
        },
    )
    return {"status": classification.status, "message_id": message_id, "label": classification.label}


@shared_task(bind=True, max_retries=3, queue=getattr(settings, "BACKEND_CELERY_QUEUE", "backend"))
def build_message_embedding_task(self, message_id):
    try:
        message = Message.objects.get(pk=message_id)
    except Message.DoesNotExist:
        return {"status": "missing", "message_id": message_id}

    current_hash = text_hash(message.text)
    existing = MessageEmbedding.objects.filter(message=message, text_hash=current_hash).first()
    if existing:
        return {"status": "skipped", "message_id": message_id}

    try:
        async_result = ml_tasks.embed_text(message.text)
        with allow_join_result():
            result = async_result.get(timeout=settings.ML_TASK_TIMEOUT_SECONDS)
        vector = result["embedding"]
        model_name = result.get("model_name", "unknown")
        source = "ml_worker"
    except (CeleryError, TimeoutError) as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)
        logger.warning(
            "ML embedding task failed after retries for message %s. Falling back to hash embedding.",
            message_id,
            exc_info=True,
        )
        vector = fallback_embedding(message.text)
        model_name = "fallback-hash-embedding"
        source = "fallback"
    except Exception:
        logger.exception("ML embedding task failed for message %s. Falling back to hash embedding.", message_id)
        vector = fallback_embedding(message.text)
        model_name = "fallback-hash-embedding"
        source = "fallback"

    embedding, _ = MessageEmbedding.objects.update_or_create(
        message=message,
        defaults={
            "vector": vector,
            "text_hash": current_hash,
            "model_name": model_name,
            "dimensions": len(vector),
            "source": source,
        },
    )
    return {"status": "completed", "message_id": message_id, "embedding_id": embedding.id}
