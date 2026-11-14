import { INestApplication } from '@nestjs/common';

import { createPublicProfilePicturesRouter } from '../modules/storage/local/public-profile-pictures.router';
import { configureCors } from './cors.config';
import { createPublicProfileImagesRouter } from '../modules/storage/local/public-profile-images.router';

export function configureHttp(
  app: INestApplication,
  allowedOrigins: string[],
  uploadRoot: string,
  storageDriver: 'local' | 's3',
): void {
  configureCors(app, allowedOrigins);

  if (storageDriver === 'local') {
    app.use(
      '/media/profile-pictures',
      createPublicProfilePicturesRouter(uploadRoot),
    );

    app.use(
      '/media/profile-banners',
      createPublicProfileImagesRouter(uploadRoot, 'banner'),
    );
  }
}
