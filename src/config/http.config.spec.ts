import type { INestApplication } from '@nestjs/common';

import { configureHttp } from './http.config';

describe('configureHttp', () => {
  function createAppMock() {
    return {
      enableCors: jest.fn(),
      use: jest.fn(),
    };
  }

  it('registra CORS y el router de imágenes en modo local', () => {
    const app = createAppMock();

    configureHttp(
      app as unknown as INestApplication,
      ['http://localhost:5173'],
      '/carpeta-de-prueba',
      'local',
    );

    expect(app.enableCors).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.use).toHaveBeenCalledWith(
      '/media/profile-pictures',
      expect.any(Function),
    );
    expect(app.use).toHaveBeenCalledWith(
      '/media/profile-banners',
      expect.any(Function),
    );
  });

  it('registra CORS, pero no el router local, en modo S3', () => {
    const app = createAppMock();

    configureHttp(
      app as unknown as INestApplication,
      ['http://localhost:5173'],
      '/carpeta-de-prueba',
      's3',
    );

    expect(app.enableCors).toHaveBeenCalledTimes(1);
    expect(app.use).not.toHaveBeenCalled();
  });
});
