import { randomUUID } from 'node:crypto';

import { profileImageUrl } from '../profile-image/profile-image-url';

describe('profilePictureUrl', () => {
  const baseUrl = 'http://localhost:3000/media/';

  it('convierte una clave administrada en una URL absoluta', () => {
    const userId = randomUUID();
    const fileId = randomUUID();
    const key = `profile-pictures/${userId}/${fileId}.png`;

    expect(profileImageUrl(key, baseUrl, 'picture')).toBe(
      `http://localhost:3000/media/${key}`,
    );
  });

  it('conserva una URL existente', () => {
    const existingUrl = 'https://example.com/avatar.png';

    expect(profileImageUrl(existingUrl, baseUrl, 'picture')).toBe(existingUrl);
  });

  it('conserva null cuando el usuario no tiene imagen', () => {
    expect(profileImageUrl(null, baseUrl, 'picture')).toBeNull();
  });

  it('no convierte claves que no tienen el formato esperado', () => {
    const value = 'profile-pictures/../archivo.png';

    expect(profileImageUrl(value, baseUrl, 'picture')).toBe(value);
  });

  it('no interpreta una clave de banner como avatar', () => {
    const key = `profile-banners/${randomUUID()}/${randomUUID()}.png`;

    expect(profileImageUrl(key, baseUrl, 'picture')).toBe(key);
  });
});
