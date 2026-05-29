#!/bin/sh
set -e

exec celery \
    -A celery_app:app \
    worker \
    --loglevel="${CELERY_LOG_LEVEL:-info}" \
    --queues="${CELERY_QUEUE:-ml}" \
    --hostname="${CELERY_WORKER_NAME:-ml-worker}@%h"
