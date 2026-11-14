import { randomUUID } from 'node:crypto';

import { profileBannerUrl } from './profile-banner-url';

describe('profileBannerUrl', () => {
  const baseUrl = 'http://localhost:3000/media/';

  it('convierte una clave de banner en una URL absoluta', () => {
    const key = `profile-banners/${randomUUID()}/${randomUUID()}.png`;

    expect(profileBannerUrl(key, baseUrl)).toBe(
      `http://localhost:3000/media/${key}`,
    );
  });

  it('conserva una URL anterior', () => {
    const existingUrl = 'https://example.com/banner.png';

    expect(profileBannerUrl(existingUrl, baseUrl)).toBe(existingUrl);
  });

  it('conserva null cuando no hay banner', () => {
    expect(profileBannerUrl(null, baseUrl)).toBeNull();
  });

  it('no interpreta una clave de avatar como banner', () => {
    const key = `profile-pictures/${randomUUID()}/${randomUUID()}.png`;

    expect(profileBannerUrl(key, baseUrl)).toBe(key);
  });
});
