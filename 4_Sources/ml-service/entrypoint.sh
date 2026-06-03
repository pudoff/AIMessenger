#!/bin/sh
set -e

exec celery \
    -A celery_app:app \
    worker \
    --loglevel="${CELERY_LOG_LEVEL:-info}" \
    --queues="${CELERY_QUEUE:-ml}" \
    --hostname="${CELERY_WORKER_NAME:-ml-worker}@%h" \
    --concurrency="${CELERY_WORKER_CONCURRENCY:-${ML_CELERY_WORKER_CONCURRENCY:-2}}" \
    --prefetch-multiplier="${CELERY_WORKER_PREFETCH_MULTIPLIER:-${ML_CELERY_WORKER_PREFETCH_MULTIPLIER:-1}}" \
    --max-tasks-per-child="${CELERY_WORKER_MAX_TASKS_PER_CHILD:-${ML_CELERY_WORKER_MAX_TASKS_PER_CHILD:-100}}"
