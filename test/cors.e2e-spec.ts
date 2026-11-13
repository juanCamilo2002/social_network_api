import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { configureCors } from '../src/config/cors.config';
import { parseAllowedOrigins } from '../src/config/cors-origins';

const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://admin.example.com'];

const OTHER_ORIGIN = 'https://other.example.com';

@Controller('cors-test')
class CorsTestController {
  @Get()
  find() {
    return { ok: true };
  }
}

describe('CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CorsTestController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureCors(app, ALLOWED_ORIGINS);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(ALLOWED_ORIGINS)(
    'autoriza las respuestas para el origen %s',
    async (origin) => {
      const response = await request(app.getHttpServer())
        .get('/cors-test')
        .set('Origin', origin)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(origin);
    },
  );

  it('no autoriza un origen que no está en la lista', async () => {
    const response = await request(app.getHttpServer())
      .get('/cors-test')
      .set('Origin', OTHER_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).not.toBe(
      OTHER_ORIGIN,
    );
  });

  it.each(ALLOWED_ORIGINS)('autoriza el preflight desde %s', async (origin) => {
    const response = await request(app.getHttpServer())
      .options('/cors-test')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-methods']).toContain('POST');

    const allowedHeaders =
      response.headers['access-control-allow-headers'].toLowerCase();

    expect(allowedHeaders).toContain('authorization');
    expect(allowedHeaders).toContain('content-type');
  });
});

describe('parseAllowedOrigins', () => {
  it('separa los orígenes y elimina espacios alrededor', () => {
    expect(
      parseAllowedOrigins(' http://localhost:5173, https://admin.example.com '),
    ).toEqual(['http://localhost:5173', 'https://admin.example.com']);
  });

  it('elimina orígenes duplicados', () => {
    expect(
      parseAllowedOrigins('http://localhost:5173,http://localhost:5173'),
    ).toEqual(['http://localhost:5173']);
  });

  it.each([
    ['valor vacío', ''],
    [
      'origen vacío entre comas',
      'http://localhost:5173,,https://admin.example.com',
    ],
    ['sin protocolo', 'localhost:5173'],
    ['protocolo no permitido', 'ftp://example.com'],
    ['ruta incluida', 'https://example.com/login'],
    ['barra final', 'https://example.com/'],
  ])('rechaza %s', (_description, value) => {
    expect(() => parseAllowedOrigins(value)).toThrow();
  });
});
