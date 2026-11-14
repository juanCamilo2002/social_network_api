import { randomUUID } from 'node:crypto';

import {
  createProfileBannerKey,
  parseProfileBannerKey,
} from './profile-banner-key';
import {
  createProfilePictureKey,
  parseProfilePictureKey,
} from './profile-picture-key';
import type { ImageContentType } from './storage.interface';

describe('Claves de banner', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ] as const)(
    'genera una clave de banner para %s',
    (contentType, extension) => {
      const userId = randomUUID();

      const { key, fileName } = createProfileBannerKey(userId, contentType);

      expect(key).toBe(`profile-banners/${userId}/${fileName}`);
      expect(fileName).toMatch(new RegExp(`^[0-9a-f-]+\\.${extension}$`, 'i'));
      expect(parseProfileBannerKey(key)).toEqual({ userId, fileName });
    },
  );

  it('no interpreta una clave de avatar como banner', () => {
    const { key } = createProfilePictureKey(randomUUID(), 'image/png');

    expect(parseProfileBannerKey(key)).toBeNull();
  });

  it('no interpreta una clave de banner como avatar', () => {
    const { key } = createProfileBannerKey(randomUUID(), 'image/png');

    expect(parseProfilePictureKey(key)).toBeNull();
  });

  it.each([
    '',
    '../archivo.png',
    'profile-banners/../../archivo.png',
    'profile-banners/usuario/archivo.png',
    `profile-banners/${randomUUID()}/${randomUUID()}.svg`,
    `profile-banners/${randomUUID()}/${randomUUID()}.png/extra`,
  ])('rechaza la clave inválida %s', (key) => {
    expect(parseProfileBannerKey(key)).toBeNull();
  });

  it('rechaza un usuario inválido al generar una clave', () => {
    expect(() => createProfileBannerKey('../otro', 'image/png')).toThrow(
      'Invalid user ID',
    );
  });

  it('rechaza un tipo de imagen no permitido', () => {
    const invalidType = 'image/svg+xml' as ImageContentType;

    expect(() => createProfileBannerKey(randomUUID(), invalidType)).toThrow(
      'Unsupported image content type',
    );
  });
});
