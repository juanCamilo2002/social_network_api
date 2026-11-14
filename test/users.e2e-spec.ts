import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { User } from '../src/modules/users/entities/user.entity';
import { LocalStorageService } from '../src/modules/storage/local/local-storage.service';
import { configureHttp } from '../src/config/http.config';
import { STORAGE_SERVICE } from '../src/modules/storage/storage.interface';

describe('Búsqueda de usuarios (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let jwtService: JwtService;

  let createdUserIds: string[] = [];
  let firstUserId: string;
  let secondUserId: string;
  let accessToken: string;
  let suffix: string;

  let uploadRoot: string | undefined;
  let testStorage: LocalStorageService;

  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    PUBLIC_MEDIA_BASE_URL: process.env.PUBLIC_MEDIA_BASE_URL,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  };

  async function createBannerTestImage(): Promise<Buffer> {
    return sharp({
      create: {
        width: 12,
        height: 6,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_NAME = 'social_network_test';
    process.env.JWT_SECRET = 'test-secret-only-for-users-e2e-123456';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
    process.env.PUBLIC_MEDIA_BASE_URL = 'http://localhost:3000/media/';
    process.env.STORAGE_DRIVER = 'local';

    uploadRoot = await mkdtemp(join(tmpdir(), 'social-network-upload-e2e-'));
    const testUploadRoot = uploadRoot;

    testStorage = new LocalStorageService(testUploadRoot);

    // Configuramos el entorno antes de importar AppModule.
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_SERVICE)
      .useValue(testStorage)
      .compile();

    app = moduleRef.createNestApplication();

    configureHttp(app, ['http://localhost:5173'], testUploadRoot, 'local');

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

    if (uploadRoot) {
      await rm(uploadRoot, { recursive: true, force: true });
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

    const results = response.body as { id: string }[];
    const resultIds = results.map((user) => user.id);

    expect(resultIds).toContain(firstUserId);
    expect(resultIds).not.toContain(secondUserId);
  });

  it('no expone datos privados en los resultados', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ q: `sol_${suffix}` })
      .expect(200);

    const results = response.body as { id: string }[];
    const user = results.find((result) => result.id === firstUserId);

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

    expect(response.body).toEqual(
      expect.objectContaining({ id: secondUserId }),
    );

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

  it('requiere autenticación para editar el perfil propio', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ name: 'Nuevo' })
      .expect(401);
  });

  it('actualiza nombre, apellido y biografía y devuelve campos públicos', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '  Juan  ',
        lastName: '  Pérez  ',
        biography: '  Hola, soy Juan.  ',
      })
      .expect(200);

    expect(response.body).toEqual({
      id: firstUserId,
      nickname: `sol_${suffix}`,
      name: 'Juan',
      lastName: 'Pérez',
      profilePicture: null,
      banner: null,
      biography: 'Hola, soy Juan.',
    });

    const stored = await usersRepository.findOneByOrFail({ id: firstUserId });

    expect(stored.name).toBe('Juan');
    expect(stored.lastName).toBe('Pérez');
    expect(stored.biography).toBe('Hola, soy Juan.');
  });

  it('actualiza solo los campos enviados', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Nuevo nombre' })
      .expect(200);

    expect(response.body).toEqual({
      id: firstUserId,
      nickname: `sol_${suffix}`,
      name: 'Nuevo nombre',
      lastName: `Paz${suffix}`,
      profilePicture: null,
      banner: null,
      biography: null,
    });
  });

  it.each([
    ['null', null],
    ['una cadena vacía', ''],
    ['solo espacios', '   '],
  ])(
    'permite eliminar la biografía con %s',
    async (_description, biography) => {
      await usersRepository.update(
        { id: firstUserId },
        { biography: 'Biografía anterior' },
      );

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ biography })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({ biography: null }),
      );

      const stored = await usersRepository.findOneByOrFail({ id: firstUserId });
      expect(stored.biography).toBeNull();
    },
  );

  it.each([
    ['nombre vacío', { name: '   ' }],
    ['nombre nulo', { name: null }],
    ['nombre demasiado largo', { name: 'a'.repeat(101) }],
    ['apellido vacío', { lastName: '' }],
    ['apellido nulo', { lastName: null }],
    ['apellido demasiado largo', { lastName: 'a'.repeat(101) }],
    ['biografía demasiado larga', { biography: 'a'.repeat(501) }],
    ['biografía no textual', { biography: 123 }],
    ['cuerpo vacío', {}],
  ])('rechaza %s', async (_description, body) => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body)
      .expect(400);
  });

  it('no permite modificar campos fuera de la lista permitida', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Nombre permitido',
        nickname: 'otro_nickname',
        email: 'otro@example.com',
        birthdate: '2000-01-01',
        id: secondUserId,
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: firstUserId,
        nickname: `sol_${suffix}`,
        name: 'Nombre permitido',
      }),
    );

    const firstUser = await usersRepository.findOneByOrFail({
      id: firstUserId,
    });
    const secondUser = await usersRepository.findOneByOrFail({
      id: secondUserId,
    });

    expect(firstUser.nickname).toBe(`sol_${suffix}`);
    expect(firstUser.email).toBe(`first_${suffix}@example.com`);
    expect(firstUser.birthdate).toBe('1990-05-20');
    expect(secondUser.name).toBe(`Marta${suffix}`);
  });

  it('rechaza un cuerpo que solo contiene campos no editables', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ nickname: 'otro_nickname' })
      .expect(400);
  });

  it('devuelve 404 si el usuario del token ya no existe', async () => {
    const token = await jwtService.signAsync({ sub: randomUUID() });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nuevo nombre' })
      .expect(404);
  });

  it('convierte la clave de la foto en URL para perfiles y búsqueda', async () => {
    const key = `profile-pictures/${firstUserId}/${randomUUID()}.png`;
    const expectedUrl = `http://localhost:3000/media/${key}`;

    await usersRepository.update({ id: firstUserId }, { profilePicture: key });

    const ownProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const publicProfile = await request(app.getHttpServer())
      .get(`/users/by-nickname/sol_${suffix}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const search = await request(app.getHttpServer())
      .get('/users/search')
      .query({ q: `sol_${suffix}` })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(ownProfile.body).toEqual(
      expect.objectContaining({ profilePicture: expectedUrl }),
    );
    expect(publicProfile.body).toEqual(
      expect.objectContaining({ profilePicture: expectedUrl }),
    );
    expect(search.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstUserId,
          profilePicture: expectedUrl,
        }),
      ]),
    );
  });

  it('requiere autenticación para subir una foto de perfil', async () => {
    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .attach('file', Buffer.from('archivo'), 'avatar.png')
      .expect(401);
  });

  it('rechaza una petición sin archivo', async () => {
    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('rechaza contenido que no es una imagen aunque tenga extensión válida', async () => {
    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('no es una imagen'), 'avatar.png')
      .expect(400);
  });

  it('rechaza archivos que superan los 5 MB', async () => {
    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 2), 'grande.png')
      .expect(413);
  });

  it('guarda la foto y permite consultarla públicamente', async () => {
    if (!uploadRoot) {
      throw new Error('No se creó la carpeta temporal');
    }

    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    const response = await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'avatar.png')
      .expect(201);

    const storedUser = await usersRepository.findOneByOrFail({
      id: firstUserId,
    });

    expect(storedUser.profilePicture).toMatch(
      new RegExp(`^profile-pictures/${firstUserId}/[0-9a-f-]+\\.png$`, 'i'),
    );

    const key = storedUser.profilePicture!;

    expect(response.body).toEqual(
      expect.objectContaining({
        profilePicture: `http://localhost:3000/media/${key}`,
      }),
    );

    const storedContent = await readFile(join(uploadRoot, ...key.split('/')));
    const storedMetadata = await sharp(storedContent).metadata();

    expect(storedMetadata.format).toBe('png');
    expect(storedMetadata.width).toBe(10);
    expect(storedMetadata.height).toBe(10);
    expect(storedMetadata.exif).toBeUndefined();

    // La lectura es pública: no enviamos Authorization.
    const publicResponse = await request(app.getHttpServer())
      .get(`/media/${key}`)
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(publicResponse.headers['content-type']).toMatch(/^image\/png/);
    expect(publicResponse.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );

    const otherOriginResponse = await request(app.getHttpServer())
      .get(`/media/${key}`)
      .set('Origin', 'http://localhost:9999')
      .expect(200);

    expect(
      otherOriginResponse.headers['access-control-allow-origin'],
    ).toBeUndefined();
  });

  it('reemplaza la imagen anterior después de guardar la nueva', async () => {
    if (!uploadRoot) {
      throw new Error('No se creó la carpeta temporal');
    }

    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primera.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousKey = before.profilePicture!;

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'segunda.png')
      .expect(201);

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });
    const currentKey = after.profilePicture!;

    expect(currentKey).not.toBe(previousKey);

    await request(app.getHttpServer()).get(`/media/${previousKey}`).expect(404);

    await request(app.getHttpServer()).get(`/media/${currentKey}`).expect(200);
  });

  it('conserva la imagen activa ante dos subidas simultáneas', async () => {
    if (!uploadRoot) {
      throw new Error('No se creó la carpeta temporal');
    }

    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/users/me/profile-picture')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'primera.png'),
      request(app.getHttpServer())
        .post('/users/me/profile-picture')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segunda.png'),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const storedUser = await usersRepository.findOneByOrFail({
      id: firstUserId,
    });

    const activeKey = storedUser.profilePicture;

    expect(activeKey).not.toBeNull();

    if (!activeKey) {
      throw new Error('No quedó una foto activa');
    }

    // La imagen que quedó en la base de datos debe seguir disponible.
    await request(app.getHttpServer()).get(`/media/${activeKey}`).expect(200);

    // Para este usuario recién creado, solo debe quedar la foto activa.
    const files = await readdir(
      join(uploadRoot, 'profile-pictures', firstUserId),
    );

    expect(files).toEqual([activeKey.split('/').at(-1)]);
  });

  it('elimina los metadatos y conserva la orientación visual en la foto pública', async () => {
    const original = await sharp({
      create: {
        width: 12,
        height: 6,
        channels: 3,
        background: '#35695e',
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const originalMetadata = await sharp(original).metadata();

    expect(originalMetadata.exif).toBeDefined();
    expect(originalMetadata.orientation).toBe(6);

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', original, 'avatar.jpg')
      .expect(201);

    const storedUser = await usersRepository.findOneByOrFail({
      id: firstUserId,
    });

    const key = storedUser.profilePicture;

    expect(key).not.toBeNull();

    if (!key) {
      throw new Error('No se guardó la clave de la imagen');
    }

    // Consultamos el mismo archivo que recibiría un visitante, sin token.
    const response = await request(app.getHttpServer())
      .get(`/media/${key}`)
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(Buffer.isBuffer(response.body)).toBe(true);

    const publicMetadata = await sharp(response.body as Buffer).metadata();

    expect(publicMetadata.format).toBe('jpeg');
    expect(publicMetadata.width).toBe(6);
    expect(publicMetadata.height).toBe(12);
    expect(publicMetadata.orientation).toBeUndefined();
    expect(publicMetadata.exif).toBeUndefined();
    expect(publicMetadata.xmp).toBeUndefined();
    expect(publicMetadata.iptc).toBeUndefined();
  });

  it('conserva la imagen anterior si falla el almacenamiento de la nueva', async () => {
    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primera.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousKey = before.profilePicture;

    expect(previousKey).not.toBeNull();

    if (!previousKey) {
      throw new Error('No se guardó la imagen anterior');
    }

    const saveSpy = jest
      .spyOn(testStorage, 'saveProfilePicture')
      .mockRejectedValueOnce(new Error('Error de almacenamiento simulado'));

    try {
      await request(app.getHttpServer())
        .post('/users/me/profile-picture')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segunda.png')
        .expect(500);
    } finally {
      saveSpy.mockRestore();
    }

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });

    expect(after.profilePicture).toBe(previousKey);

    await request(app.getHttpServer()).get(`/media/${previousKey}`).expect(200);
  });

  it('conserva la nueva imagen si falla el borrado de la anterior', async () => {
    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primera.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousKey = before.profilePicture;

    expect(previousKey).not.toBeNull();

    if (!previousKey) {
      throw new Error('No se guardó la imagen anterior');
    }

    const deleteSpy = jest
      .spyOn(testStorage, 'deleteProfilePicture')
      .mockRejectedValueOnce(new Error('Error de borrado simulado'));

    try {
      await request(app.getHttpServer())
        .post('/users/me/profile-picture')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segunda.png')
        .expect(201);

      expect(deleteSpy).toHaveBeenCalledWith(previousKey);
    } finally {
      deleteSpy.mockRestore();
    }

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });
    const currentKey = after.profilePicture;

    expect(currentKey).not.toBeNull();
    expect(currentKey).not.toBe(previousKey);

    if (!currentKey) {
      throw new Error('No se guardó la imagen nueva');
    }

    await request(app.getHttpServer()).get(`/media/${currentKey}`).expect(200);

    // Como simulamos un fallo, la imagen anterior todavía existe.
    await request(app.getHttpServer()).get(`/media/${previousKey}`).expect(200);
  });

  it('rechaza campos de texto adicionales en la subida', async () => {
    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('description', 'No se permiten campos adicionales')
      .attach('file', image, 'avatar.png')
      .expect(400);

    const storedUser = await usersRepository.findOneByOrFail({
      id: firstUserId,
    });

    expect(storedUser.profilePicture).toBeNull();
  });

  it('rechaza más de un archivo en la misma petición', async () => {
    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primera.png')
      .attach('file', image, 'segunda.png')
      .expect(400);

    const storedUser = await usersRepository.findOneByOrFail({
      id: firstUserId,
    });

    expect(storedUser.profilePicture).toBeNull();
  });

  it('conserva la imagen anterior si falla la transacción', async () => {
    if (!uploadRoot) {
      throw new Error('No se creó la carpeta temporal');
    }

    const image = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#35695e',
      },
    })
      .png()
      .toBuffer();

    await request(app.getHttpServer())
      .post('/users/me/profile-picture')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primera.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousKey = before.profilePicture;

    if (!previousKey) {
      throw new Error('No se guardó la imagen anterior');
    }

    const dataSource = app.get(DataSource);

    const transactionSpy = jest
      .spyOn(dataSource, 'transaction')
      .mockRejectedValueOnce(new Error('Error de transacción simulado'));

    try {
      await request(app.getHttpServer())
        .post('/users/me/profile-picture')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segunda.png')
        .expect(500);
    } finally {
      transactionSpy.mockRestore();
    }

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });

    expect(after.profilePicture).toBe(previousKey);

    await request(app.getHttpServer()).get(`/media/${previousKey}`).expect(200);

    // La implementación conserva el archivo nuevo por precaución.
    const files = await readdir(
      join(uploadRoot, 'profile-pictures', firstUserId),
    );

    expect(files).toHaveLength(2);
    expect(files).toContain(previousKey.split('/').at(-1));
  });
  it('devuelve la URL del banner y permite leerlo públicamente', async () => {
    const content = Buffer.from('banner de prueba');

    const storedBanner = await testStorage.saveProfileBanner(
      firstUserId,
      content,
      'image/png',
    );

    await usersRepository.update(
      { id: firstUserId },
      { banner: storedBanner.key },
    );

    const expectedUrl = `http://localhost:3000/media/${storedBanner.key}`;

    const ownProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const publicProfile = await request(app.getHttpServer())
      .get(`/users/by-nickname/sol_${suffix}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(ownProfile.body).toEqual(
      expect.objectContaining({ banner: expectedUrl }),
    );
    expect(publicProfile.body).toEqual(
      expect.objectContaining({ banner: expectedUrl }),
    );

    // El banner es público: no se envía Authorization.
    const imageResponse = await request(app.getHttpServer())
      .get(`/media/${storedBanner.key}`)
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(imageResponse.headers['content-type']).toMatch(/^image\/png/);
    expect(imageResponse.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });

  it('requiere autenticación para subir un banner', async () => {
    const image = await createBannerTestImage();

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .attach('file', image, 'banner.png')
      .expect(401);
  });

  it('rechaza una subida de banner sin archivo', async () => {
    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('rechaza contenido inválido aunque tenga extensión de imagen', async () => {
    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('no es una imagen'), 'banner.png')
      .expect(400);
  });

  it('rechaza un banner que supera los 5 MiB', async () => {
    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 2), 'grande.png')
      .expect(413);
  });

  it('rechaza campos de texto adicionales en la subida del banner', async () => {
    const image = await createBannerTestImage();

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('description', 'Campo no permitido')
      .attach('file', image, 'banner.png')
      .expect(400);
  });

  it('sube el banner sin modificar el avatar ni el perfil de otro usuario', async () => {
    const image = await createBannerTestImage();

    const avatar = await testStorage.saveProfilePicture(
      firstUserId,
      image,
      'image/png',
    );

    await usersRepository.update(
      { id: firstUserId },
      { profilePicture: avatar.key },
    );

    const response = await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'banner.png')
      .expect(201);

    const firstUser = await usersRepository.findOneByOrFail({
      id: firstUserId,
    });

    const secondUser = await usersRepository.findOneByOrFail({
      id: secondUserId,
    });

    expect(firstUser.profilePicture).toBe(avatar.key);
    expect(firstUser.banner).toMatch(
      new RegExp(`^profile-banners/${firstUserId}/[0-9a-f-]+\\.png$`, 'i'),
    );
    expect(secondUser.banner).toBeNull();

    const bannerKey = firstUser.banner;

    if (!bannerKey) {
      throw new Error('No se guardó la clave del banner');
    }

    expect(response.body).toEqual(
      expect.objectContaining({
        banner: `http://localhost:3000/media/${bannerKey}`,
        profilePicture: `http://localhost:3000/media/${avatar.key}`,
      }),
    );

    await request(app.getHttpServer()).get(`/media/${bannerKey}`).expect(200);

    await request(app.getHttpServer()).get(`/media/${avatar.key}`).expect(200);
  });

  it('reemplaza el banner anterior sin borrar el avatar', async () => {
    const image = await createBannerTestImage();

    const avatar = await testStorage.saveProfilePicture(
      firstUserId,
      image,
      'image/png',
    );

    await usersRepository.update(
      { id: firstUserId },
      { profilePicture: avatar.key },
    );

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primero.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousBanner = before.banner;

    if (!previousBanner) {
      throw new Error('No se guardó el primer banner');
    }

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'segundo.png')
      .expect(201);

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });

    expect(after.banner).not.toBe(previousBanner);
    expect(after.profilePicture).toBe(avatar.key);

    if (!after.banner) {
      throw new Error('No se guardó el nuevo banner');
    }

    await request(app.getHttpServer())
      .get(`/media/${previousBanner}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/media/${after.banner}`)
      .expect(200);

    await request(app.getHttpServer()).get(`/media/${avatar.key}`).expect(200);
  });

  it('devuelve 404 si el usuario de la sesión ya no existe', async () => {
    const image = await createBannerTestImage();
    const token = await jwtService.signAsync({ sub: randomUUID() });

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', image, 'banner.png')
      .expect(404);
  });

  it('conserva el banner activo ante dos subidas simultáneas', async () => {
    if (!uploadRoot) {
      throw new Error('No se creó la carpeta temporal');
    }

    const image = await createBannerTestImage();

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/users/me/profile-banner')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'primero.png'),
      request(app.getHttpServer())
        .post('/users/me/profile-banner')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segundo.png'),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const user = await usersRepository.findOneByOrFail({ id: firstUserId });
    const activeBanner = user.banner;

    if (!activeBanner) {
      throw new Error('No quedó un banner activo');
    }

    await request(app.getHttpServer())
      .get(`/media/${activeBanner}`)
      .expect(200);

    const files = await readdir(
      join(uploadRoot, 'profile-banners', firstUserId),
    );

    expect(files).toEqual([activeBanner.split('/').at(-1)]);
  });

  it('conserva el avatar y el banner al subir ambos simultáneamente', async () => {
    const image = await createBannerTestImage();

    const [pictureResponse, bannerResponse] = await Promise.all([
      request(app.getHttpServer())
        .post('/users/me/profile-picture')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'avatar.png'),
      request(app.getHttpServer())
        .post('/users/me/profile-banner')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'banner.png'),
    ]);

    expect(pictureResponse.status).toBe(201);
    expect(bannerResponse.status).toBe(201);

    const user = await usersRepository.findOneByOrFail({ id: firstUserId });

    if (!user.profilePicture || !user.banner) {
      throw new Error('No quedaron guardadas ambas imágenes');
    }

    expect(user.profilePicture).toMatch(/^profile-pictures\//);
    expect(user.banner).toMatch(/^profile-banners\//);

    await request(app.getHttpServer())
      .get(`/media/${user.profilePicture}`)
      .expect(200);

    await request(app.getHttpServer()).get(`/media/${user.banner}`).expect(200);
  });

  it('conserva el banner anterior si falla el almacenamiento del nuevo', async () => {
    const image = await createBannerTestImage();

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primero.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousBanner = before.banner;

    if (!previousBanner) {
      throw new Error('No se guardó el banner anterior');
    }

    const saveSpy = jest
      .spyOn(testStorage, 'saveProfileBanner')
      .mockRejectedValueOnce(new Error('Error de almacenamiento simulado'));

    try {
      await request(app.getHttpServer())
        .post('/users/me/profile-banner')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segundo.png')
        .expect(500);
    } finally {
      saveSpy.mockRestore();
    }

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });

    expect(after.banner).toBe(previousBanner);

    await request(app.getHttpServer())
      .get(`/media/${previousBanner}`)
      .expect(200);
  });

  it('conserva el banner anterior si falla la transacción', async () => {
    if (!uploadRoot) {
      throw new Error('No se creó la carpeta temporal');
    }

    const image = await createBannerTestImage();

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primero.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousBanner = before.banner;

    if (!previousBanner) {
      throw new Error('No se guardó el banner anterior');
    }

    const transactionSpy = jest
      .spyOn(app.get(DataSource), 'transaction')
      .mockRejectedValueOnce(new Error('Error de transacción simulado'));

    try {
      await request(app.getHttpServer())
        .post('/users/me/profile-banner')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segundo.png')
        .expect(500);
    } finally {
      transactionSpy.mockRestore();
    }

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });

    expect(after.banner).toBe(previousBanner);

    await request(app.getHttpServer())
      .get(`/media/${previousBanner}`)
      .expect(200);

    // El archivo nuevo se conserva por precaución ante un fallo ambiguo.
    const files = await readdir(
      join(uploadRoot, 'profile-banners', firstUserId),
    );

    expect(files).toHaveLength(2);
    expect(files).toContain(previousBanner.split('/').at(-1));
  });

  it('aplica la orientación y elimina EXIF del banner público', async () => {
    const original = await sharp({
      create: {
        width: 12,
        height: 6,
        channels: 3,
        background: '#35695e',
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const originalMetadata = await sharp(original).metadata();

    expect(originalMetadata.orientation).toBe(6);
    expect(originalMetadata.exif).toBeDefined();

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', original, 'banner.jpg')
      .expect(201);

    const user = await usersRepository.findOneByOrFail({ id: firstUserId });

    if (!user.banner) {
      throw new Error('No se guardó el banner');
    }

    const response = await request(app.getHttpServer())
      .get(`/media/${user.banner}`)
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(Buffer.isBuffer(response.body)).toBe(true);

    const metadata = await sharp(response.body as Buffer).metadata();

    expect(metadata.width).toBe(6);
    expect(metadata.height).toBe(12);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
  });

  it('conserva el nuevo banner si falla el borrado del anterior', async () => {
    const image = await createBannerTestImage();

    await request(app.getHttpServer())
      .post('/users/me/profile-banner')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', image, 'primero.png')
      .expect(201);

    const before = await usersRepository.findOneByOrFail({ id: firstUserId });
    const previousBanner = before.banner;

    if (!previousBanner) {
      throw new Error('No se guardó el banner anterior');
    }

    const deleteSpy = jest
      .spyOn(testStorage, 'deleteProfileBanner')
      .mockRejectedValueOnce(new Error('Error de borrado simulado'));

    try {
      await request(app.getHttpServer())
        .post('/users/me/profile-banner')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', image, 'segundo.png')
        .expect(201);

      expect(deleteSpy).toHaveBeenCalledWith(previousBanner);
    } finally {
      deleteSpy.mockRestore();
    }

    const after = await usersRepository.findOneByOrFail({ id: firstUserId });
    const activeBanner = after.banner;

    if (!activeBanner) {
      throw new Error('No se guardó el nuevo banner');
    }

    expect(activeBanner).not.toBe(previousBanner);

    await request(app.getHttpServer())
      .get(`/media/${activeBanner}`)
      .expect(200);

    // El borrado falló, por lo que el archivo anterior sigue existiendo.
    await request(app.getHttpServer())
      .get(`/media/${previousBanner}`)
      .expect(200);
  });
});
