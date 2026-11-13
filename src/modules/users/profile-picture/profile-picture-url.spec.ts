import { randomUUID } from 'node:crypto';

import { profilePictureUrl } from './profile-picture-url';

describe('profilePictureUrl', () => {
  const baseUrl = 'http://localhost:3000/media/';

  it('convierte una clave administrada en una URL absoluta', () => {
    const userId = randomUUID();
    const fileId = randomUUID();
    const key = `profile-pictures/${userId}/${fileId}.png`;

    expect(profilePictureUrl(key, baseUrl)).toBe(
      `http://localhost:3000/media/${key}`,
    );
  });

  it('conserva una URL existente', () => {
    const existingUrl = 'https://example.com/avatar.png';

    expect(profilePictureUrl(existingUrl, baseUrl)).toBe(existingUrl);
  });

  it('conserva null cuando el usuario no tiene imagen', () => {
    expect(profilePictureUrl(null, baseUrl)).toBeNull();
  });

  it('no convierte claves que no tienen el formato esperado', () => {
    const value = 'profile-pictures/../archivo.png';

    expect(profilePictureUrl(value, baseUrl)).toBe(value);
  });
});
