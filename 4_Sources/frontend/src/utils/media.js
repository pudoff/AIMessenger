import { API_BASE } from '../api/config';

const INTERNAL_HOSTS = new Set(['backend', 'localhost', '127.0.0.1']);

function getApiOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return new URL(API_BASE, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function resolveMediaUrl(rawUrl) {
  if (!rawUrl) {
    return '';
  }

  if (typeof window === 'undefined') {
    return rawUrl;
  }

  try {
    const apiOrigin = getApiOrigin();
    const parsedUrl = new URL(rawUrl, window.location.origin);
    const isMediaPath = parsedUrl.pathname.startsWith('/media/');

    const shouldUseApiOrigin = rawUrl.startsWith('/')
      || parsedUrl.hostname === window.location.hostname
      || (INTERNAL_HOSTS.has(parsedUrl.hostname) && !INTERNAL_HOSTS.has(window.location.hostname));

    if (isMediaPath && shouldUseApiOrigin) {
      return `${apiOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    if (window.location.protocol === 'https:' && parsedUrl.protocol === 'http:') {
      parsedUrl.protocol = 'https:';
    }

    return parsedUrl.href;
  } catch {
    return rawUrl;
  }
}
