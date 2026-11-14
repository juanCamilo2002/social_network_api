import { randomUUID } from 'node:crypto';

import { profileImageUrl } from '../profile-image/profile-image-url';

describe('profileBannerUrl', () => {
  const baseUrl = 'http://localhost:3000/media/';

  it('convierte una clave de banner en una URL absoluta', () => {
    const key = `profile-banners/${randomUUID()}/${randomUUID()}.png`;

    expect(profileImageUrl(key, baseUrl, 'banner')).toBe(
      `http://localhost:3000/media/${key}`,
    );
  });

  it('conserva una URL anterior', () => {
    const existingUrl = 'https://example.com/banner.png';

    expect(profileImageUrl(existingUrl, baseUrl, 'banner')).toBe(existingUrl);
  });

  it('conserva null cuando no hay banner', () => {
    expect(profileImageUrl(null, baseUrl, 'banner')).toBeNull();
  });

  it('no interpreta una clave de avatar como banner', () => {
    const key = `profile-pictures/${randomUUID()}/${randomUUID()}.png`;

    expect(profileImageUrl(key, baseUrl, 'banner')).toBe(key);
  });
});
