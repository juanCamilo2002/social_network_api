import { parseProfileBannerKey } from '../../storage/profile-banner-key';

export function profileBannerUrl(
  value: string | null,
  publicMediaBaseUrl: string,
): string | null {
  if (value === null) {
    return null;
  }

  // Conserva los valores anteriores que no sean claves de banner.
  if (!parseProfileBannerKey(value)) {
    return value;
  }

  return new URL(value, publicMediaBaseUrl).toString();
}
