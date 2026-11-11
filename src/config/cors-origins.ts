export function parseAllowedOrigins(value: string): string[] {
  const origins = value.split(',').map((origin) => origin.trim());

  if (origins.some((origin) => origin.length === 0)) {
    throw new Error('CORS_ALLOWED_ORIGINS contains an empty origin');
  }

  for (const origin of origins) {
    let url: URL;

    try {
      url = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(
        `The CORS origin must contain only the protocol, domain, and port: ${origin}`,
      );
    }
  }

  return [...new Set(origins)];
}
