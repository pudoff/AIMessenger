from urllib.parse import urljoin

from django.conf import settings


def build_public_media_url(request, path):
    if not path:
        return None
    if path.startswith(('http://', 'https://')):
        return path
    if settings.BACKEND_PUBLIC_BASE_URL:
        return urljoin(f'{settings.BACKEND_PUBLIC_BASE_URL}/', path.lstrip('/'))
    return request.build_absolute_uri(path) if request else path
