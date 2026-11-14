import { randomUUID } from 'node:crypto';
import type { ImageContentType } from './storage.interface';

import {
  createProfileImageKey,
  parseProfileImageKey,
} from './profile-image-key';

describe('Claves de avatar', () => {
  it.each(['jpg', 'png', 'webp'])(
    'acepta una clave válida con extensión %s',
    (extension) => {
      const userId = randomUUID();
      const fileName = `${randomUUID()}.${extension}`;

      expect(
        parseProfileImageKey(
          `profile-pictures/${userId}/${fileName}`,
          'picture',
        ),
      ).toEqual({ userId, fileName });
    },
  );

  it.each([
    '',
    '../archivo.png',
    'profile-pictures/../../archivo.png',
    'profile-pictures/usuario/archivo.png',
    `profile-pictures/${randomUUID()}/${randomUUID()}.svg`,
    `profile-pictures/${randomUUID()}/${randomUUID()}.png/extra`,
    'https://example.com/avatar.png',
  ])('rechaza la clave inválida %s', (key) => {
    expect(parseProfileImageKey(key, 'picture')).toBeNull();
  });

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ] as const)('genera una clave válida para %s', (contentType, extension) => {
    const userId = randomUUID();

    const { key, fileName } = createProfileImageKey(
      userId,
      contentType,
      'picture',
    );

    expect(fileName).toMatch(new RegExp(`^[0-9a-f-]+\\.${extension}$`, 'i'));
    expect(parseProfileImageKey(key, 'picture')).toEqual({ userId, fileName });
  });

  it('rechaza un usuario inválido al generar la clave', () => {
    expect(() =>
      createProfileImageKey('../otro', 'image/png', 'picture'),
    ).toThrow('Invalid user ID');
  });

  it('rechaza un tipo no permitido al generar la clave', () => {
    const invalidType = 'image/svg+xml' as ImageContentType;

    expect(() =>
      createProfileImageKey(randomUUID(), invalidType, 'picture'),
    ).toThrow('Unsupported image content type');
  });
});
