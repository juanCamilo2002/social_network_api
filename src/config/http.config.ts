import { INestApplication } from '@nestjs/common';

import { createPublicProfilePicturesRouter } from '../modules/storage/local/public-profile-pictures.router';
import { configureCors } from './cors.config';

export function configureHttp(
  app: INestApplication,
  allowedOrigins: string[],
  uploadRoot: string,
): void {
  configureCors(app, allowedOrigins);

  app.use(
    '/media/profile-pictures',
    createPublicProfilePicturesRouter(uploadRoot),
  );
}
