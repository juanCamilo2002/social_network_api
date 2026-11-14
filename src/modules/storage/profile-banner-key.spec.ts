import { randomUUID } from 'node:crypto';

import {
  createProfileImageKey,
  parseProfileImageKey,
} from './profile-image-key';
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

      const { key, fileName } = createProfileImageKey(
        userId,
        contentType,
        'banner',
      );

      expect(key).toBe(`profile-banners/${userId}/${fileName}`);
      expect(fileName).toMatch(new RegExp(`^[0-9a-f-]+\\.${extension}$`, 'i'));
      expect(parseProfileImageKey(key, 'banner')).toEqual({ userId, fileName });
    },
  );

  it('no interpreta una clave de avatar como banner', () => {
    const { key } = createProfileImageKey(randomUUID(), 'image/png', 'picture');

    expect(parseProfileImageKey(key, 'banner')).toBeNull();
  });

  it('no interpreta una clave de banner como avatar', () => {
    const { key } = createProfileImageKey(randomUUID(), 'image/png', 'banner');

    expect(parseProfileImageKey(key, 'picture')).toBeNull();
  });

  it.each([
    '',
    '../archivo.png',
    'profile-banners/../../archivo.png',
    'profile-banners/usuario/archivo.png',
    `profile-banners/${randomUUID()}/${randomUUID()}.svg`,
    `profile-banners/${randomUUID()}/${randomUUID()}.png/extra`,
  ])('rechaza la clave inválida %s', (key) => {
    expect(parseProfileImageKey(key, 'banner')).toBeNull();
  });

  it('rechaza un usuario inválido al generar una clave', () => {
    expect(() =>
      createProfileImageKey('../otro', 'image/png', 'banner'),
    ).toThrow('Invalid user ID');
  });

  it('rechaza un tipo de imagen no permitido', () => {
    const invalidType = 'image/svg+xml' as ImageContentType;

    expect(() =>
      createProfileImageKey(randomUUID(), invalidType, 'banner'),
    ).toThrow('Unsupported image content type');
  });
});
