import { parseProfileImageKey } from '../../storage/profile-image-key';
import type { ProfileImageKind } from '../../storage/profile-image-key';

/** Converts a managed key to a public URL, preserving existing values. */
export function profileImageUrl(
  value: string | null,
  publicMediaBaseUrl: string,
  kind: ProfileImageKind,
): string | null {
  if (value === null || !parseProfileImageKey(value, kind)) {
    return value;
  }

  return new URL(value, publicMediaBaseUrl).toString();
}
