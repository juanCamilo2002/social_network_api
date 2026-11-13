import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { isUUID } from 'class-validator';

import {
  ImageContentType,
  StoredFile,
  StorageService,
} from '../storage.interface';

import { parseProfilePictureKey } from '../profile-picture-key';

const extensions: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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
    if (!isUUID(userId)) {
      throw new Error('Invalid user ID');
    }

    const extension = extensions[contentType];

    if (!extension) {
      throw new Error('Unsupported image content type');
    }

    const fileName = `${randomUUID()}.${extension}`;

    const key = `profile-pictures/${userId}/${fileName}`;
    const directory = join(this.rootDirectory, 'profile-pictures', userId);
    const filePath = join(directory, fileName);

    await mkdir(directory, { recursive: true });

    await writeFile(filePath, content, { flag: 'wx' });

    return { key };
  }

  async deleteProfilePicture(key: string): Promise<void> {
    const parsed = parseProfilePictureKey(key);

    if (!parsed) {
      throw new Error('Invalid profile picture key');
    }

    const { userId, fileName } = parsed;

    const filePath = join(
      this.rootDirectory,
      'profile-pictures',
      userId,
      fileName,
    );

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
