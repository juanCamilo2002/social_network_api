import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import * as request from 'supertest';
import { App } from 'supertest/types';

import { Post } from '../src/modules/posts/entities/post.entity';
import { User } from '../src/modules/users/entities/user.entity';

describe('Posts con PostgreSQL (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersRepository: Repository<User>;
  let postsRepository: Repository<Post>;
  let jwtService: JwtService;

  let userId: string | undefined;
  let accessToken: string;

  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  beforeAll(async () => {
    // Estas pruebas solo deben apuntar a la base de test local.
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_NAME = 'social_network_test';
    process.env.JWT_SECRET = 'test-secret-only-for-posts-e2e-123456';

    // Importamos después de configurar el entorno, porque AppModule
    // inicializa ConfigModule al cargarse.
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

    dataSource = moduleRef.get(DataSource);
    usersRepository = dataSource.getRepository(User);
    postsRepository = dataSource.getRepository(Post);
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
    const suffix = randomUUID().replace(/-/g, '');

    // Creamos un usuario exclusivo de esta prueba.
    // No usamos login aquí: generamos un token firmado para probar posts.
    const user = usersRepository.create({
      nickname: `user_${suffix}`,
      name: 'Usuario',
      lastName: 'Prueba',
      email: `${suffix}@example.com`,
      passwordHash: 'hash-no-utilizado-en-esta-prueba',
      birthdate: null,
    });

    const savedUser = await usersRepository.save(user);
    userId = savedUser.id;

    accessToken = await jwtService.signAsync({
      sub: userId,
    });
  });

  afterEach(async () => {
    if (userId) {
      // Solo eliminamos los datos creados para esta prueba.
      await postsRepository.delete({ authorId: userId });
      await usersRepository.delete({ id: userId });
      userId = undefined;
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

  it('rechaza consultas sin autenticación', async () => {
    await request(app.getHttpServer()).get('/posts').expect(401);
  });

  it('crea una publicación y permite consultarla', async () => {
    const created = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Mi publicación de prueba' })
      .expect(201);

    expect(created.body).toMatchObject({
      authorId: userId,
      content: 'Mi publicación de prueba',
    });

    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.createdAt).toEqual(expect.any(String));

    const found = await request(app.getHttpServer())
      .get(`/posts/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(found.body).toMatchObject({
      id: created.body.id,
      authorId: userId,
      content: 'Mi publicación de prueba',
    });

    // Comprobamos también directamente que existe en PostgreSQL.
    const storedPost = await postsRepository.findOneBy({
      id: created.body.id,
    });

    expect(storedPost).not.toBeNull();
    expect(storedPost?.authorId).toBe(userId);
  });

  it('incluye la publicación creada al listar posts', async () => {
    const created = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Una publicación para listar' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          authorId: userId,
        }),
      ]),
    );
  });

  it('usa el autor del token aunque el cliente envíe otro authorId', async () => {
    const response = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: 'No puedo elegir otro autor',
        authorId: randomUUID(),
      })
      .expect(201);

    expect(response.body.authorId).toBe(userId);
  });

  it.each([
    ['contenido vacío', { content: '' }],
    ['solo espacios', { content: '   ' }],
    ['contenido ausente', {}],
    ['contenido numérico', { content: 123 }],
    ['contenido nulo', { content: null }],
  ])('rechaza %s', async (_description, body) => {
    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body)
      .expect(400);
  });

  it('devuelve 400 para un identificador inválido', async () => {
    await request(app.getHttpServer())
      .get('/posts/no-es-un-uuid')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('devuelve 404 para un UUID que no existe', async () => {
    await request(app.getHttpServer())
      .get(`/posts/${randomUUID()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
