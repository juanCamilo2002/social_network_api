import { randomUUID } from 'node:crypto';

import { parseProfilePictureKey } from './profile-picture-key';

describe('parseProfilePictureKey', () => {
  it.each(['jpg', 'png', 'webp'])(
    'acepta una clave válida con extensión %s',
    (extension) => {
      const userId = randomUUID();
      const fileName = `${randomUUID()}.${extension}`;

      expect(
        parseProfilePictureKey(`profile-pictures/${userId}/${fileName}`),
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
    expect(parseProfilePictureKey(key)).toBeNull();
  });
});
