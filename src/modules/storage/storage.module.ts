import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STORAGE_SERVICE } from './storage.interface';
import { createStorageService } from './storage.factory';

@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: createStorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
