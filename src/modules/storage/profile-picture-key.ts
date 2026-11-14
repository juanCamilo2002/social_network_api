import { isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';

import type { ImageContentType } from './storage.interface';

export interface ProfilePictureKeyParts {
  userId: string;
  fileName: string;
}

const extensions: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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

export function createProfilePictureKey(
  userId: string,
  contentType: ImageContentType,
): { key: string; fileName: string } {
  if (!isUUID(userId)) {
    throw new Error('Invalid user ID');
  }

  const extension = Object.hasOwn(extensions, contentType)
    ? extensions[contentType]
    : undefined;

  if (!extension) {
    throw new Error('Unsupported image content type');
  }

  const fileName = `${randomUUID()}.${extension}`;

  return {
    key: `profile-pictures/${userId}/${fileName}`,
    fileName,
  };
}
