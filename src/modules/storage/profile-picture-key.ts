import {
  createProfileImageKey,
  parseProfileImageKey,
} from './profile-image-key';
import type { ProfileImageKeyParts } from './profile-image-key';
import type { ImageContentType } from './storage.interface';

export type ProfilePictureKeyParts = ProfileImageKeyParts;

/**
 * Interprets only keys generated for profile photos.
 * Returns null when the key does not have the expected format.
 */
export function parseProfilePictureKey(
  key: string,
): ProfilePictureKeyParts | null {
  return parseProfileImageKey(key, 'picture');
}

export function createProfilePictureKey(
  userId: string,
  contentType: ImageContentType,
): { key: string; fileName: string } {
  return createProfileImageKey(userId, contentType, 'picture');
}
