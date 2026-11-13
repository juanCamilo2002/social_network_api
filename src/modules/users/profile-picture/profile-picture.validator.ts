import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { ImageContentType } from '../../storage/storage.interface';

export const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;

export const MAX_PROFILE_PICTURE_PIXELS = 16_000_000;

const allowedFormats: Record<string, ImageContentType> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function validateProfilePicture(
  content: Buffer,
): Promise<ImageContentType> {
  if (content.length === 0) {
    throw new BadRequestException('Image is empty');
  }

  if (content.length > MAX_PROFILE_PICTURE_BYTES) {
    throw new BadRequestException('Image exceeds the 5 MB limit');
  }

  try {
    const image = sharp(content, {
      failOn: 'error',
      limitInputPixels: MAX_PROFILE_PICTURE_PIXELS,
    });

    const metadata = await image.metadata();
    const contentType = metadata.format
      ? allowedFormats[metadata.format]
      : undefined;

    if (!contentType) {
      throw new BadRequestException('Unsupported image format');
    }

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('Invalid image dimensions');
    }

    if (metadata.width * metadata.height > MAX_PROFILE_PICTURE_PIXELS) {
      throw new BadRequestException('Image dimensions are too large');
    }

    if (metadata.pages && metadata.pages > 1) {
      throw new BadRequestException('Animated images are not supported');
    }

    await image.stats();

    return contentType;
  } catch (error: unknown) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('Invalid or unsupported image');
  }
}
