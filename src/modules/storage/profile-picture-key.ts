import { isUUID } from 'class-validator';

export interface ProfilePictureKeyParts {
  userId: string;
  fileName: string;
}

/**
 * Interprets only keys generated for profile photos.
 * Returns null when the key does not have the expected format.
 */
export function parseProfilePictureKey(
  key: string,
): ProfilePictureKeyParts | null {
  const parts = key.split('/');

  if (parts.length !== 3 || parts[0] !== 'profile-pictures') {
    return null;
  }

  const [, userId, fileName] = parts;
  const match = /^([0-9a-f-]+)\.(jpg|png|webp)$/i.exec(fileName);

  if (!isUUID(userId) || !match || !isUUID(match[1])) {
    return null;
  }

  return { userId, fileName };
}
