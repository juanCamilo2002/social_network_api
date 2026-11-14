import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import {
  MAX_PROFILE_IMAGE_PIXELS,
  validateProfileImage,
} from './profile-image.validator';
import { ImageContentType } from '../../storage/storage.interface';

interface ProcessedProfileImage {
  content: Buffer;
  contentType: ImageContentType;
}

const outputFormats = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export async function processProfileImage(
  content: Buffer,
): Promise<ProcessedProfileImage> {
  const contentType = await validateProfileImage(content);

  try {
    const processedContent = await sharp(content, {
      failOn: 'error',
      limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
    })
      .autoOrient()
      .toFormat(outputFormats[contentType])
      .toBuffer();

    return {
      content: processedContent,
      contentType,
    };
  } catch {
    throw new BadRequestException('Could not process image');
  }
}
