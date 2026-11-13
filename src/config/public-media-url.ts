export function parsePublicMediaUrl(value: string): string {
  if (value !== value.trim()) {
    throw new Error(
      'PUBLIC_MEDIA_BASE_URL must not contain surrounding spaces',
    );
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('PUBLIC_MEDIA_BASE_URL must be an absolute URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PUBLIC_MEDIA_BASE_URL must use HTTP or HTTPS');
  }

  if (url.username || url.password) {
    throw new Error('PUBLIC_MEDIA_BASE_URL must not contain credentials');
  }

  if (url.search || url.hash) {
    throw new Error(
      'PUBLIC_MEDIA_BASE_URL must not contain a query or fragment',
    );
  }

  if (!url.pathname.endsWith('/')) {
    throw new Error('PUBLIC_MEDIA_BASE_URL must end with "/"');
  }

  return url.toString();
}
