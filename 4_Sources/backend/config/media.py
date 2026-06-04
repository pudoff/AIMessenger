from urllib.parse import urlencode, urljoin, urlsplit, urlunsplit

from django.conf import settings


def build_public_media_url(request, path, cache_key=None):
    if not path:
        return None
    if path.startswith(('http://', 'https://')):
        url = path
    elif settings.BACKEND_PUBLIC_BASE_URL:
        url = urljoin(f'{settings.BACKEND_PUBLIC_BASE_URL}/', path.lstrip('/'))
    else:
        url = request.build_absolute_uri(path) if request else path
    if cache_key is None:
        return url
    parts = urlsplit(url)
    query = f'{parts.query}&{urlencode({"v": cache_key})}' if parts.query else urlencode({'v': cache_key})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))
