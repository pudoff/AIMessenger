import logging

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.http import Http404
from django.utils._os import safe_join
from django.views.static import serve

logger = logging.getLogger(__name__)


def serve_media_file(request, path):
    """Serve media files with diagnostics for production deployments."""

    try:
        resolved_path = safe_join(settings.MEDIA_ROOT, path)
    except SuspiciousFileOperation:
        logger.warning(
            "Media request rejected: path=%s media_root=%s remote_addr=%s",
            path,
            settings.MEDIA_ROOT,
            request.META.get("REMOTE_ADDR"),
        )
        raise

    try:
        return serve(request, path, document_root=settings.MEDIA_ROOT)
    except Http404:
        logger.warning(
            "Media file not found: path=%s resolved_path=%s media_root=%s "
            "serve_media_files=%s backend_public_base_url=%s method=%s remote_addr=%s",
            path,
            resolved_path,
            settings.MEDIA_ROOT,
            settings.SERVE_MEDIA_FILES,
            settings.BACKEND_PUBLIC_BASE_URL,
            request.method,
            request.META.get("REMOTE_ADDR"),
        )
        raise
