import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { User } from '../src/modules/users/entities/user.entity';

describe('Búsqueda de usuarios (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let jwtService: JwtService;

  let createdUserIds: string[] = [];
  let firstUserId: string;
  let secondUserId: string;
  let accessToken: string;
  let suffix: string;

  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_NAME = 'social_network_test';
    process.env.JWT_SECRET = 'test-secret-only-for-users-e2e-123456';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';

    // Configuramos el entorno antes de importar AppModule.
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    const dataSource = moduleRef.get(DataSource);
    usersRepository = dataSource.getRepository(User);
    jwtService = moduleRef.get(JwtService);

    await app.init();

    const result: Array<{ current_database: string }> = await dataSource.query(
      'SELECT current_database()',
    );

    if (result[0]?.current_database !== 'social_network_test') {
      throw new Error('Las pruebas no están conectadas a la base de test');
    }
  });

  beforeEach(async () => {
    createdUserIds = [];
    suffix = randomUUID().replace(/-/g, '').slice(0, 12);

    const firstUser = await usersRepository.save(
      usersRepository.create({
        nickname: `sol_${suffix}`,
        name: `Nora${suffix}`,
        lastName: `Paz${suffix}`,
        email: `first_${suffix}@example.com`,
        passwordHash: 'hash-no-utilizado-en-esta-prueba',
        birthdate: '1990-05-20',
      }),
    );

    firstUserId = firstUser.id;
    createdUserIds.push(firstUser.id);

    const secondUser = await usersRepository.save(
      usersRepository.create({
        nickname: `solx${suffix}`,
        name: `Marta${suffix}`,
        lastName: `Otro${suffix}`,
        email: `second_${suffix}@example.com`,
        passwordHash: 'hash-no-utilizado-en-esta-prueba',
        birthdate: null,
      }),
    );

    secondUserId = secondUser.id;
    createdUserIds.push(secondUser.id);

    accessToken = await jwtService.signAsync({
      sub: firstUserId,
    });
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      // Solo eliminamos los usuarios creados por esta prueba.
      await usersRepository.delete(createdUserIds);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('requiere autenticación', async () => {
    await request(app.getHttpServer())
      .get('/users/search')
      .query({ q: 'nora' })
      .expect(401);
  });

  it.each([
    {
      field: 'nickname',
      query: (value: string) => `SOL_${value}`,
    },
    {
      field: 'nombre',
      query: (value: string) => `nora${value}`,
    },
    {
      field: 'apellido',
      query: (value: string) => `paz${value}`,
    },
    {
      field: 'nombre completo',
      query: (value: string) => `nora${value} paz${value}`,
    },
  ])('busca por $field sin distinguir mayúsculas', async ({ query }) => {
    const response = await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q: query(suffix) })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstUserId,
        }),
      ]),
    );
  });

  it('trata el guion bajo como texto literal', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q: `sol_${suffix}` })
      .expect(200);

    const resultIds = response.body.map((user: { id: string }) => user.id);

    expect(resultIds).toContain(firstUserId);
    expect(resultIds).not.toContain(secondUserId);
  });

  it('no expone datos privados en los resultados', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q: `sol_${suffix}` })
      .expect(200);

    const user = response.body.find(
      (result: { id: string }) => result.id === firstUserId,
    );

    expect(user).toBeDefined();

    expect(user).toEqual({
      id: firstUserId,
      nickname: `sol_${suffix}`,
      name: `Nora${suffix}`,
      lastName: `Paz${suffix}`,
      profilePicture: null,
    });
  });

  it('devuelve una lista vacía cuando no hay coincidencias', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q: `no-existe-${randomUUID()}` })
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('rechaza una búsqueda sin q', async () => {
    await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it.each([
    ['vacía', ''],
    ['con solo espacios', '   '],
    ['de un carácter', 'a'],
    ['demasiado larga', 'a'.repeat(202)],
  ])('rechaza una búsqueda %s', async (_description, q) => {
    await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q })
      .expect(400);
  });

  it('elimina los espacios alrededor de la búsqueda', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q: `  Nora${suffix}  ` })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: firstUserId })]),
    );
  });

  it('devuelve como máximo 20 resultados', async () => {
    const users = Array.from({ length: 21 }, (_, index) =>
      usersRepository.create({
        nickname: `grupo_${suffix}_${index}`,
        name: 'Usuario',
        lastName: 'Prueba',
        email: `grupo_${suffix}_${index}@example.com`,
        passwordHash: 'hash-no-utilizado-en-esta-prueba',
        birthdate: null,
      }),
    );

    const savedUsers = await usersRepository.save(users);
    createdUserIds.push(...savedUsers.map((user) => user.id));

    const response = await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q: `grupo_${suffix}` })
      .expect(200);

    expect(response.body).toHaveLength(20);
  });

  it('requiere autenticación para consultar un perfil', async () => {
    await request(app.getHttpServer())
      .get(`/users/by-nickname/sol_${suffix}`)
      .expect(401);
  });

  it('devuelve únicamente los campos públicos del perfil', async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/by-nickname/SOL_${suffix.toUpperCase()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: firstUserId,
      nickname: `sol_${suffix}`,
      name: `Nora${suffix}`,
      lastName: `Paz${suffix}`,
      profilePicture: null,
      banner: null,
      biography: null,
    });
  });

  it('devuelve 404 cuando el nickname no existe', async () => {
    await request(app.getHttpServer())
      .get(`/users/by-nickname/no_existe_${suffix}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('busca el nickname completo y trata el guion bajo literalmente', async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/by-nickname/solx${suffix}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.id).toBe(secondUserId);

    await request(app.getHttpServer())
      .get(`/users/by-nickname/sol__${suffix.slice(1)}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/users/by-nickname/sol_${suffix.slice(0, -1)}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('requiere autenticación para consultar el perfil propio', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('devuelve únicamente los campos públicos del usuario autenticado', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: firstUserId,
      nickname: `sol_${suffix}`,
      name: `Nora${suffix}`,
      lastName: `Paz${suffix}`,
      profilePicture: null,
      banner: null,
      biography: null,
    });
  });

  it('devuelve el perfil correspondiente a cada sesión', async () => {
    const secondToken = await jwtService.signAsync({
      sub: secondUserId,
    });

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: secondUserId,
      nickname: `solx${suffix}`,
      name: `Marta${suffix}`,
      lastName: `Otro${suffix}`,
      profilePicture: null,
      banner: null,
      biography: null,
    });
  });

  it('devuelve 404 si el usuario del token ya no existe', async () => {
    const token = await jwtService.signAsync({
      sub: randomUUID(),
    });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
