import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import {
  MAX_PROFILE_PICTURE_BYTES,
  validateProfilePicture,
} from './profile-picture.validator';

describe('validateProfilePicture', () => {
  const image = {
    create: {
      width: 10,
      height: 10,
      channels: 3 as const,
      background: '#35695e',
    },
  };

  it.each([
    ['JPEG', 'jpeg', 'image/jpeg'],
    ['PNG', 'png', 'image/png'],
    ['WebP', 'webp', 'image/webp'],
  ] as const)(
    'acepta una imagen %s válida',
    async (_description, format, expectedContentType) => {
      const content = await sharp(image).toFormat(format).toBuffer();

      await expect(validateProfilePicture(content)).resolves.toBe(
        expectedContentType,
      );
    },
  );

  it('rechaza un archivo vacío', async () => {
    await expect(validateProfilePicture(Buffer.alloc(0))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza un archivo que supera los 5 MB', async () => {
    const content = Buffer.alloc(MAX_PROFILE_PICTURE_BYTES + 1);

    await expect(validateProfilePicture(content)).rejects.toThrow(
      'Image exceeds the 5 MB limit',
    );
  });

  it('rechaza contenido que no es una imagen', async () => {
    const content = Buffer.from('esto no es una imagen');

    await expect(validateProfilePicture(content)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza un formato no permitido', async () => {
    const content = await sharp(image).gif().toBuffer();

    await expect(validateProfilePicture(content)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza una imagen truncada', async () => {
    const content = await sharp(image).png().toBuffer();
    const truncated = content.subarray(0, 20);

    await expect(validateProfilePicture(truncated)).rejects.toThrow(
      BadRequestException,
    );
  });
});
