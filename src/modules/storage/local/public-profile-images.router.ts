import { join, resolve } from 'node:path';

import { Router } from 'express';

import { parseProfileImageKey } from '../profile-image-key';
import type { ProfileImageKind } from '../profile-image-key';

export function createPublicProfileImagesRouter(
  uploadRoot: string,
  kind: ProfileImageKind,
): Router {
  const router = Router();

  const prefix = kind === 'picture' ? 'profile-pictures' : 'profile-banners';
  const imagesRoot = resolve(uploadRoot, prefix);

  router.get('/:userId/:fileName', (req, res, next) => {
    const { userId, fileName } = req.params;

    const parsed = parseProfileImageKey(
      `${prefix}/${userId}/${fileName}`,
      kind,
    );

    if (!parsed) {
      res.sendStatus(404);
      return;
    }

    const userDirectory = join(imagesRoot, parsed.userId);

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

    res.sendFile(
      parsed.fileName,
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
