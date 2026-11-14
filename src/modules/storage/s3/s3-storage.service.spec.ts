import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { S3StorageService } from './s3-storage.service';

describe('S3StorageService', () => {
  const bucket = 'social-network-test';

  let sendMock: jest.Mock<
    Promise<unknown>,
    [PutObjectCommand | DeleteObjectCommand]
  >;
  let storage: S3StorageService;

  beforeEach(() => {
    sendMock = jest
      .fn<Promise<unknown>, [PutObjectCommand | DeleteObjectCommand]>()
      .mockResolvedValue({});

    // Solo simulamos el método usado por el servicio; no hay conexión a AWS.
    const client = { send: sendMock } as unknown as S3Client;

    storage = new S3StorageService(client, bucket);
  });

  it('guarda una imagen y devuelve la clave generada', async () => {
    const userId = randomUUID();
    const content = Buffer.from('contenido de prueba');

    const result = await storage.saveProfilePicture(
      userId,
      content,
      'image/png',
    );

    expect(result.key).toMatch(
      new RegExp(`^profile-pictures/${userId}/[0-9a-f-]+\\.png$`, 'i'),
    );

    expect(sendMock).toHaveBeenCalledTimes(1);

    const command = sendMock.mock.calls[0][0];

    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: result.key,
      Body: content,
      ContentType: 'image/png',
    });
  });

  it('genera claves diferentes para archivos distintos', async () => {
    const userId = randomUUID();

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

  it('envía la eliminación de una clave válida', async () => {
    const key = `profile-pictures/${randomUUID()}/${randomUUID()}.webp`;

    await storage.deleteProfilePicture(key);

    expect(sendMock).toHaveBeenCalledTimes(1);

    const command = sendMock.mock.calls[0][0];

    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: key,
    });
  });

  it('no envía una eliminación para una clave inválida', async () => {
    await expect(
      storage.deleteProfilePicture('../archivo.png'),
    ).rejects.toThrow('Invalid profile picture key');

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('no envía una subida con un ID de usuario inválido', async () => {
    await expect(
      storage.saveProfilePicture(
        '../otro',
        Buffer.from('contenido'),
        'image/png',
      ),
    ).rejects.toThrow('Invalid user ID');

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('propaga los errores de S3 al guardar', async () => {
    sendMock.mockRejectedValueOnce(new Error('S3 no disponible'));

    await expect(
      storage.saveProfilePicture(
        randomUUID(),
        Buffer.from('contenido'),
        'image/png',
      ),
    ).rejects.toThrow('S3 no disponible');
  });

  it('propaga los errores de S3 al eliminar', async () => {
    sendMock.mockRejectedValueOnce(new Error('S3 no disponible'));

    const key = `profile-pictures/${randomUUID()}/${randomUUID()}.png`;

    await expect(storage.deleteProfilePicture(key)).rejects.toThrow(
      'S3 no disponible',
    );
  });
});
