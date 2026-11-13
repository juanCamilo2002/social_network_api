import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import {
  MAX_PROFILE_PICTURE_PIXELS,
  validateProfilePicture,
} from './profile-picture.validator';
import { ImageContentType } from '../../storage/storage.interface';

interface ProcessedProfilePicture {
  content: Buffer;
  contentType: ImageContentType;
}

const outputFormats = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export async function processProfilePicture(
  content: Buffer,
): Promise<ProcessedProfilePicture> {
  const contentType = await validateProfilePicture(content);

  try {
    const processedContent = await sharp(content, {
      failOn: 'error',
      limitInputPixels: MAX_PROFILE_PICTURE_PIXELS,
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
