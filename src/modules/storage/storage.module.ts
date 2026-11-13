import { Module } from '@nestjs/common';
import { STORAGE_SERVICE } from './storage.interface';
import { LocalStorageService } from './local/local-storage.service';
import { LOCAL_UPLOAD_ROOT } from './storage.paths';

@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: () => new LocalStorageService(LOCAL_UPLOAD_ROOT),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
