import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { PostsModule } from '../src/modules/posts/posts.module';

describe('Posts (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PostsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /posts devuelve las publicaciones iniciales', async () => {
    const response = await request(app.getHttpServer())
      .get('/posts')
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      id: 1,
      author: 'Juan Camilo Ordoñez',
      content: 'El cielo está hermoso.',
    });
  });

  it('GET /posts/:id devuelve una publicación existente', async () => {
    const response = await request(app.getHttpServer())
      .get('/posts/1')
      .expect(200);

    expect(response.body).toMatchObject({
      id: 1,
      author: 'Juan Camilo Ordoñez',
      content: 'El cielo está hermoso.',
    });
  });

  it('GET /posts/:id devuelve 404 si la publicación no existe', async () => {
    await request(app.getHttpServer()).get('/posts/999').expect(404);
  });

  it('GET /posts/:id devuelve 400 si el identificador no es un entero', async () => {
    await request(app.getHttpServer()).get('/posts/abc').expect(400);
  });

  it('POST /posts crea una publicación que se puede consultar', async () => {
    const response = await request(app.getHttpServer())
      .post('/posts')
      .send({ author: 'Ana', content: 'Mi primera publicación' })
      .expect(201);

    expect(response.body).toMatchObject({
      author: 'Ana',
      content: 'Mi primera publicación',
    });
    expect(response.body.id).toEqual(expect.any(Number));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(new Date(response.body.createdAt).toISOString()).toBe(
      response.body.createdAt,
    );

    const found = await request(app.getHttpServer())
      .get(`/posts/${response.body.id}`)
      .expect(200);
    expect(found.body).toEqual(response.body);
  });

  it('POST /posts elimina los espacios alrededor del autor y contenido', async () => {
    const response = await request(app.getHttpServer())
      .post('/posts')
      .send({ author: '  Ana  ', content: '  Hola  ' })
      .expect(201);

    expect(response.body).toMatchObject({ author: 'Ana', content: 'Hola' });
  });

  it.each([
    ['autor vacío', { author: '', content: 'Hola' }],
    ['contenido vacío', { author: 'Ana', content: '' }],
    ['autor con espacios', { author: '   ', content: 'Hola' }],
    ['contenido con espacios', { author: 'Ana', content: '   ' }],
    ['autor ausente', { content: 'Hola' }],
    ['contenido ausente', { author: 'Ana' }],
    ['autor numérico', { author: 123, content: 'Hola' }],
    ['contenido numérico', { author: 'Ana', content: 123 }],
    ['autor nulo', { author: null, content: 'Hola' }],
    ['contenido nulo', { author: 'Ana', content: null }],
  ])('POST /posts devuelve 400 con %s', async (_description, body) => {
    await request(app.getHttpServer()).post('/posts').send(body).expect(400);
  });
});
