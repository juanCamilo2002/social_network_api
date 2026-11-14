import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  createProfilePictureKey,
  parseProfilePictureKey,
} from '../profile-picture-key';
import {
  ImageContentType,
  StoredFile,
  StorageService,
} from '../storage.interface';

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
    const { key } = createProfilePictureKey(userId, contentType);

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

  async deleteProfilePicture(key: string): Promise<void> {
    if (!parseProfilePictureKey(key)) {
      throw new Error('Invalid profile picture key');
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
