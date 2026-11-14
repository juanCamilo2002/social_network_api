import { Router } from 'express';
import { createPublicProfileImagesRouter } from './public-profile-images.router';

/**
 * Exposes only files with the key format used by
 * LocalStorageService for profile photos.
 */
export function createPublicProfilePicturesRouter(uploadRoot: string): Router {
  return createPublicProfileImagesRouter(uploadRoot, 'picture');
}
