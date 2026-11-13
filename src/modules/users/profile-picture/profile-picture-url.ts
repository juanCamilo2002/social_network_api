import { parseProfilePictureKey } from '../../storage/profile-picture-key';

/**
 * Converts a managed profile picture key to a public URL.
 * Existing values are returned unchanged.
 */
export function profilePictureUrl(
  value: string | null,
  publicMediaBaseUrl: string,
): string | null {
  if (value === null) {
    return null;
  }

  if (!parseProfilePictureKey(value)) {
    return value;
  }

  // An absolute URL ending in "/" is expected, for example:
  // http://localhost:3000/media/
  return new URL(value, publicMediaBaseUrl).toString();
}
