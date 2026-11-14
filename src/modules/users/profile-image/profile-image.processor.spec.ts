import sharp from 'sharp';

import { processProfileImage } from './profile-image.processor';

describe('processProfileImage', () => {
  it('aplica la orientación y elimina los metadatos EXIF', async () => {
    const original = await sharp({
      create: {
        width: 12,
        height: 6,
        channels: 3,
        background: '#35695e',
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const originalMetadata = await sharp(original).metadata();

    expect(originalMetadata.orientation).toBe(6);
    expect(originalMetadata.exif).toBeDefined();

    const processed = await processProfileImage(original);
    const resultMetadata = await sharp(processed.content).metadata();

    expect(processed.contentType).toBe('image/jpeg');
    expect(resultMetadata.format).toBe('jpeg');

    // La orientación 6 rota visualmente la imagen 90 grados.
    expect(resultMetadata.width).toBe(6);
    expect(resultMetadata.height).toBe(12);

    expect(resultMetadata.exif).toBeUndefined();
    expect(resultMetadata.orientation).toBeUndefined();
    expect(resultMetadata.xmp).toBeUndefined();
    expect(resultMetadata.iptc).toBeUndefined();
  });

  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ] as const)(
    'conserva el formato %s y las dimensiones de una imagen sin orientación',
    async (format, expectedContentType) => {
      const original = await sharp({
        create: {
          width: 12,
          height: 6,
          channels: 3,
          background: '#35695e',
        },
      })
        .toFormat(format)
        .toBuffer();

      const processed = await processProfileImage(original);
      const metadata = await sharp(processed.content).metadata();

      expect(processed.contentType).toBe(expectedContentType);
      expect(metadata.format).toBe(format);
      expect(metadata.width).toBe(12);
      expect(metadata.height).toBe(6);
    },
  );

  it('rechaza contenido que no es una imagen válida', async () => {
    await expect(
      processProfileImage(Buffer.from('no es una imagen')),
    ).rejects.toThrow();
  });

  it('procesa una imagen válida de más de 5 millones de píxeles', async () => {
    const original = await sharp({
      create: {
        width: 2300,
        height: 2300,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    const processed = await processProfileImage(original);
    const metadata = await sharp(processed.content).metadata();

    expect(metadata.width).toBe(2300);
    expect(metadata.height).toBe(2300);
  });
});
