import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import {
  ImageContentType,
  StoredFile,
  StorageService,
} from '../storage.interface';

import {
  createProfileImageKey,
  parseProfileImageKey,
  ProfileImageKind,
} from '../profile-image-key';

export class LocalStorageService implements StorageService {
  private readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = resolve(rootDirectory);
  }

  async saveProfilePicture(
    userId: string,
    content: Buffer,
    contentType: ImageContentType,
  ): Promise<StoredFile> {
    return this.saveImage(userId, content, contentType, 'picture');
  }

  async saveProfileBanner(
    userId: string,
    content: Buffer,
    contentType: ImageContentType,
  ): Promise<StoredFile> {
    return this.saveImage(userId, content, contentType, 'banner');
  }

  async deleteProfilePicture(key: string): Promise<void> {
    return this.deleteImage(key, 'picture');
  }

  async deleteProfileBanner(key: string): Promise<void> {
    return this.deleteImage(key, 'banner');
  }

  private async saveImage(
    userId: string,
    content: Buffer,
    contentType: ImageContentType,
    kind: ProfileImageKind,
  ): Promise<StoredFile> {
    const { key } = createProfileImageKey(userId, contentType, kind);

    // The key is generated on the server based on the UUID and the validated extension.
    const filePath = join(this.rootDirectory, ...key.split('/'));

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, { flag: 'wx' });

    return { key };
  }

  private async deleteImage(
    key: string,
    kind: ProfileImageKind,
  ): Promise<void> {
    if (!parseProfileImageKey(key, kind)) {
      throw new Error(
        kind === 'picture'
          ? 'Invalid profile picture key'
          : 'Invalid profile banner key',
      );
    }

    const filePath = join(this.rootDirectory, ...key.split('/'));

    try {
      await unlink(filePath);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }

      throw error;
    }
  }
}
