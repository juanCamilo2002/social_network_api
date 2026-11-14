import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import {
  STORAGE_SERVICE,
  StorageService,
} from '../src/modules/storage/storage.interface';
import { User } from '../src/modules/users/entities/user.entity';

const describeS3 =
  process.env.RUN_S3_INTEGRATION === '1' ? describe : describe.skip;

describeS3('Banner de perfil con S3 real (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication<App> | undefined;
  let dataSource: DataSource | undefined;
  let storage: StorageService | undefined;
  let userId: string | undefined;
  let accessToken: string;
  const createdKeys: string[] = [];

  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    PUBLIC_MEDIA_BASE_URL: process.env.PUBLIC_MEDIA_BASE_URL,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    S3_BUCKET: process.env.S3_BUCKET,
  };

  beforeAll(async () => {
    const bucket = process.env.S3_TEST_BUCKET;
    const region = process.env.AWS_REGION;
    const publicBaseUrl = process.env.TEST_CLOUDFRONT_BASE_URL;

    if (!bucket || !region || !publicBaseUrl) {
      throw new Error(
        'Faltan S3_TEST_BUCKET, AWS_REGION o TEST_CLOUDFRONT_BASE_URL',
      );
    }

    const parsedUrl = new URL(publicBaseUrl);
    if (
      parsedUrl.protocol !== 'https:' ||
      !parsedUrl.pathname.endsWith('/') ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error('La URL de CloudFront no es válida');
    }

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_NAME = 'social_network_test';
    process.env.JWT_SECRET = 'test-secret-only-for-s3-e2e-12345678';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
    process.env.PUBLIC_MEDIA_BASE_URL = publicBaseUrl;
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_BUCKET = bucket;

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    dataSource = moduleRef.get<DataSource>(DataSource);
    storage = moduleRef.get<StorageService>(STORAGE_SERVICE);

    const database: Array<{ current_database: string }> =
      await dataSource.query('SELECT current_database()');
    if (database[0]?.current_database !== 'social_network_test') {
      throw new Error('La conexión no apunta a social_network_test');
    }

    await app.init();

    const originalSave = storage.saveProfileBanner.bind(
      storage,
    ) as StorageService['saveProfileBanner'];
    jest
      .spyOn(storage, 'saveProfileBanner')
      .mockImplementation(async (...args) => {
        const result = await originalSave(...args);
        createdKeys.push(result.key);
        return result;
      });

    const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
    const users = dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        nickname: `s3test_${suffix}`,
        name: 'Prueba',
        lastName: 'S3',
        email: `s3test_${suffix}@example.com`,
        passwordHash: 'hash-no-utilizado-en-esta-prueba',
        birthdate: null,
      }),
    );
    userId = user.id;
    accessToken = await moduleRef.get(JwtService).signAsync({ sub: userId });
  });

  afterAll(async () => {
    const cleanupErrors: string[] = [];

    if (storage) {
      for (const key of createdKeys) {
        try {
          await storage.deleteProfileBanner(key);
        } catch {
          cleanupErrors.push(`No se pudo eliminar el objeto de prueba: ${key}`);
        }
      }
    }

    if (dataSource && userId) {
      try {
        await dataSource.getRepository(User).delete({ id: userId });
      } catch {
        cleanupErrors.push(
          `No se pudo eliminar el usuario de prueba: ${userId}`,
        );
      }
    }

    try {
      if (app) await app.close();
    } finally {
      for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    if (cleanupErrors.length > 0) throw new Error(cleanupErrors.join('\n'));
  });

  it('sube mediante el endpoint y permite leer el banner en CloudFront', async () => {
    if (!app || !dataSource || !userId) {
      throw new Error('La aplicación de prueba no se inicializó');
    }

    const image = await sharp({
      create: { width: 12, height: 6, channels: 3, background: '#35695e' },
    })
      .png()
      .toBuffer();

    const response = await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'banner.png')
      .expect(201);

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const key = user.banner;
    if (!key) throw new Error('No se guardó la clave del banner');

    expect(key).toMatch(new RegExp(`^profile-banners/${userId}/`));
    expect(createdKeys).toContain(key);

    const expectedUrl = new URL(
      key,
      process.env.TEST_CLOUDFRONT_BASE_URL,
    ).toString();
    expect(response.body).toEqual(
      expect.objectContaining({ banner: expectedUrl }),
    );

    const publicResponse = await fetch(expectedUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!publicResponse.ok) {
      throw new Error(`CloudFront respondió con HTTP ${publicResponse.status}`);
    }

    const publicImage = Buffer.from(await publicResponse.arrayBuffer());
    const metadata = await sharp(publicImage).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(12);
    expect(metadata.height).toBe(6);
    expect(metadata.exif).toBeUndefined();
  });
});
