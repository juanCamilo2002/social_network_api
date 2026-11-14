import { S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../config/env.validation';
import { LocalStorageService } from './local/local-storage.service';
import { S3StorageService } from './s3/s3-storage.service';
import type { StorageService } from './storage.interface';
import { LOCAL_UPLOAD_ROOT } from './storage.paths';

export function createStorageService(
  config: ConfigService<EnvironmentVariables>,
): StorageService {
  const driver = config.getOrThrow('STORAGE_DRIVER', { infer: true });

  if (driver === 'local') {
    return new LocalStorageService(LOCAL_UPLOAD_ROOT);
  }

  if (driver === 's3') {
    const region = config.getOrThrow('AWS_REGION', { infer: true });
    const bucket = config.getOrThrow('S3_BUCKET', { infer: true });

    return new S3StorageService(new S3Client({ region }), bucket);
  }

  throw new Error('Unsupported storage driver');
}
