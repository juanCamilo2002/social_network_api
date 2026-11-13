import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';
import request from 'supertest';

import { createPublicProfilePicturesRouter } from './public-profile-pictures.router';

describe('createPublicProfilePicturesRouter', () => {
  let rootDirectory: string;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), 'social-network-public-'));
  });

  afterEach(async () => {
    // Solo se elimina el directorio temporal creado para esta prueba.
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it('permite consultar una foto sin token', async () => {
    const userId = randomUUID();
    const fileName = `${randomUUID()}.png`;
    const directory = join(rootDirectory, 'profile-pictures', userId);

    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), Buffer.from('contenido'));

    const app = express();

    app.use(
      '/media/profile-pictures',
      createPublicProfilePicturesRouter(rootDirectory),
    );

    const response = await request(app)
      .get(`/media/profile-pictures/${userId}/${fileName}`)
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^image\/png/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('devuelve 404 para una foto inexistente', async () => {
    const app = express();

    app.use(
      '/media/profile-pictures',
      createPublicProfilePicturesRouter(rootDirectory),
    );

    await request(app)
      .get(`/media/profile-pictures/${randomUUID()}/${randomUUID()}.png`)
      .expect(404);
  });

  it.each([
    '/media/profile-pictures/usuario/archivo.png',
    `/media/profile-pictures/${randomUUID()}/archivo.png`,
    `/media/profile-pictures/${randomUUID()}/${randomUUID()}.svg`,
    '/media/profile-pictures/otro/directorio/archivo.png',
  ])('rechaza la ruta no permitida %s', async (path) => {
    const app = express();

    app.use(
      '/media/profile-pictures',
      createPublicProfilePicturesRouter(rootDirectory),
    );

    await request(app).get(path).expect(404);
  });
});
