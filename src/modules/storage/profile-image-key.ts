import { randomUUID } from 'node:crypto';

import { isUUID } from 'class-validator';

import type { ImageContentType } from './storage.interface';

export type ProfileImageKind = 'picture' | 'banner';

export interface ProfileImageKeyParts {
  userId: string;
  fileName: string;
}

const prefixes: Record<ProfileImageKind, string> = {
  picture: 'profile-pictures',
  banner: 'profile-banners',
};

const extensions: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function parseProfileImageKey(
  key: string,
  kind: ProfileImageKind,
): ProfileImageKeyParts | null {
  const parts = key.split('/');

  if (parts.length !== 3 || parts[0] !== prefixes[kind]) {
    return null;
  }

  const [, userId, fileName] = parts;
  const match = /^([0-9a-f-]+)\.(jpg|png|webp)$/i.exec(fileName);

  if (!isUUID(userId) || !match || !isUUID(match[1])) {
    return null;
  }

  return { userId, fileName };
}

export function createProfileImageKey(
  userId: string,
  contentType: ImageContentType,
  kind: ProfileImageKind,
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
    key: `${prefixes[kind]}/${userId}/${fileName}`,
    fileName,
  };
}
