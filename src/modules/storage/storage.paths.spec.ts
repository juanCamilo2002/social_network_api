import { isAbsolute, join } from 'node:path';

import { LOCAL_UPLOAD_ROOT } from './storage.paths';

describe('LOCAL_UPLOAD_ROOT', () => {
  it('usa la carpeta uploads dentro del directorio de ejecución', () => {
    expect(isAbsolute(LOCAL_UPLOAD_ROOT)).toBe(true);
    expect(LOCAL_UPLOAD_ROOT).toBe(join(process.cwd(), 'uploads'));
  });
});
