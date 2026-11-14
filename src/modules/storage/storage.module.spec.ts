import { ConfigService } from '@nestjs/config';

import { EnvironmentVariables } from '../../config/env.validation';
import { LocalStorageService } from './local/local-storage.service';
import { S3StorageService } from './s3/s3-storage.service';
import { createStorageService } from './storage.factory';

describe('createStorageService', () => {
  function configWith(values: Record<string, string>) {
    return {
      getOrThrow(key: string) {
        const value = values[key];

        if (!value) {
          throw new Error(`Missing configuration: ${key}`);
        }

        return value;
      },
    } as unknown as ConfigService<EnvironmentVariables>;
  }

  it('selecciona el almacenamiento local', () => {
    const storage = createStorageService(
      configWith({ STORAGE_DRIVER: 'local' }),
    );

    expect(storage).toBeInstanceOf(LocalStorageService);
  });

  it('selecciona S3 sin realizar una petición a AWS', () => {
    const storage = createStorageService(
      configWith({
        STORAGE_DRIVER: 's3',
        AWS_REGION: 'us-east-1',
        S3_BUCKET: 'social-network-test',
      }),
    );

    expect(storage).toBeInstanceOf(S3StorageService);
  });

  it('rechaza un proveedor desconocido', () => {
    expect(() =>
      createStorageService(configWith({ STORAGE_DRIVER: 'otro' })),
    ).toThrow('Unsupported storage driver');
  });

  it('no crea el proveedor S3 si falta el bucket', () => {
    expect(() =>
      createStorageService(
        configWith({
          STORAGE_DRIVER: 's3',
          AWS_REGION: 'us-east-1',
        }),
      ),
    ).toThrow('Missing configuration: S3_BUCKET');
  });
});
