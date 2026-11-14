import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  ImageContentType,
  StoredFile,
  StorageService,
} from '../storage.interface';

import {
  parseProfilePictureKey,
  createProfilePictureKey,
} from '../profile-picture-key';

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
    const { key, fileName } = createProfilePictureKey(userId, contentType);

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
