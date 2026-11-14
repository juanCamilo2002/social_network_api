import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

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

export class S3StorageService implements StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

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

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      }),
    );

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

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
