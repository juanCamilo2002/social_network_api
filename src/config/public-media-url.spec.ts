import { parsePublicMediaUrl } from './public-media-url';

describe('parsePublicMediaUrl', () => {
  it('acepta una URL HTTP absoluta terminada en barra', () => {
    expect(parsePublicMediaUrl('http://localhost:3000/media/')).toBe(
      'http://localhost:3000/media/',
    );
  });

  it('acepta una URL HTTPS con una ruta base', () => {
    expect(parsePublicMediaUrl('https://cdn.example.com/media/')).toBe(
      'https://cdn.example.com/media/',
    );
  });

  it.each([
    '',
    '/media/',
    'http://localhost:3000/media',
    'ftp://example.com/media/',
    'https://user:password@example.com/media/',
    'https://example.com/media/?version=1',
    'https://example.com/media/#imagen',
    ' https://example.com/media/ ',
  ])('rechaza la URL inválida %s', (value) => {
    expect(() => parsePublicMediaUrl(value)).toThrow();
  });
});
