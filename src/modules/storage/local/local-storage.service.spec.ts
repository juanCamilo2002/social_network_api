import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let rootDirectory: string;
  let storage: LocalStorageService;
  let userId: string;

  beforeEach(async () => {
    // Cada prueba recibe su propia carpeta temporal.
    rootDirectory = await mkdtemp(join(tmpdir(), 'social-network-storage-'));
    storage = new LocalStorageService(rootDirectory);
    userId = randomUUID();
  });

  afterEach(async () => {
    // Solo elimina la carpeta temporal creada por esta prueba.
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it('guarda el contenido con una clave generada para el usuario', async () => {
    const content = Buffer.from('contenido de prueba');

    const result = await storage.saveProfilePicture(
      userId,
      content,
      'image/png',
    );

    expect(result.key).toMatch(
      new RegExp(`^profile-pictures/${userId}/[0-9a-f-]+\\.png$`, 'i'),
    );

    const storedContent = await readFile(
      join(rootDirectory, ...result.key.split('/')),
    );

    expect(storedContent).toEqual(content);
  });

  it('genera claves diferentes para cada archivo', async () => {
    const first = await storage.saveProfilePicture(
      userId,
      Buffer.from('primero'),
      'image/jpeg',
    );

    const second = await storage.saveProfilePicture(
      userId,
      Buffer.from('segundo'),
      'image/jpeg',
    );

    expect(first.key).not.toBe(second.key);
  });

  it('elimina una imagen guardada', async () => {
    const result = await storage.saveProfilePicture(
      userId,
      Buffer.from('contenido'),
      'image/webp',
    );

    const filePath = join(rootDirectory, ...result.key.split('/'));

    await storage.deleteProfilePicture(result.key);

    await expect(stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('no falla si la imagen ya fue eliminada', async () => {
    const key = `profile-pictures/${userId}/${randomUUID()}.png`;

    await expect(storage.deleteProfilePicture(key)).resolves.toBeUndefined();
  });

  it.each([
    '../archivo.png',
    'profile-pictures/../../archivo.png',
    'profile-pictures/usuario/archivo.png',
    `profile-pictures/${randomUUID()}/archivo.exe`,
  ])('rechaza la clave inválida %s', async (key) => {
    await expect(storage.deleteProfilePicture(key)).rejects.toThrow(
      'Invalid profile picture key',
    );
  });

  it('rechaza un ID de usuario inválido', async () => {
    await expect(
      storage.saveProfilePicture(
        '../otro',
        Buffer.from('contenido'),
        'image/png',
      ),
    ).rejects.toThrow('Invalid user ID');
  });
});
