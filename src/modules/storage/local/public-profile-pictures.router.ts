import { join, resolve } from 'node:path';

import { parseProfilePictureKey } from '../profile-picture-key';
import { Router } from 'express';

/**
 * Exposes only files with the key format used by
 * LocalStorageService for profile photos.
 */
export function createPublicProfilePicturesRouter(uploadRoot: string): Router {
  const router = Router();
  const profilePicturesRoot = resolve(uploadRoot, 'profile-pictures');

  router.get('/:userId/:fileName', (req, res, next) => {
    const { userId, fileName } = req.params;

    const parsed = parseProfilePictureKey(
      `profile-pictures/${userId}/${fileName}`,
    );

    if (!parsed) {
      res.sendStatus(404);
      return;
    }

    const userDirectory = join(profilePicturesRoot, userId);

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

    res.sendFile(
      fileName,
      {
        root: userDirectory,
        dotfiles: 'deny',
      },
      (error) => {
        if (!error) {
          return;
        }

        if (!res.headersSent) {
          res.sendStatus(404);
          return;
        }

        next(error);
      },
    );
  });

  return router;
}
