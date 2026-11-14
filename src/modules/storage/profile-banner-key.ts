import {
  createProfileImageKey,
  parseProfileImageKey,
} from './profile-image-key';
import type { ProfileImageKeyParts } from './profile-image-key';
import type { ImageContentType } from './storage.interface';

export type ProfileBannerKeyParts = ProfileImageKeyParts;

export function parseProfileBannerKey(
  key: string,
): ProfileBannerKeyParts | null {
  return parseProfileImageKey(key, 'banner');
}

export function createProfileBannerKey(
  userId: string,
  contentType: ImageContentType,
): { key: string; fileName: string } {
  return createProfileImageKey(userId, contentType, 'banner');
}
