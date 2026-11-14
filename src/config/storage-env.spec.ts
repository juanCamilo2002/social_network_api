import { validate } from './env.validation';

const baseEnvironment = {
  NODE_ENV: 'test',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_USERNAME: 'test_user',
  DB_PASSWORD: 'test_password',
  DB_NAME: 'social_network_test',
  JWT_SECRET: 'test-secret-for-validation-at-least-32-characters',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  PUBLIC_MEDIA_BASE_URL: 'http://localhost:3000/media/',
};

describe('Configuración del almacenamiento', () => {
  it('acepta local sin configuración de AWS', () => {
    expect(
      validate({
        ...baseEnvironment,
        STORAGE_DRIVER: 'local',
      }).STORAGE_DRIVER,
    ).toBe('local');
  });

  it('acepta S3 con región y bucket', () => {
    expect(
      validate({
        ...baseEnvironment,
        STORAGE_DRIVER: 's3',
        AWS_REGION: 'us-east-1',
        S3_BUCKET: 'social-network-test',
        PUBLIC_MEDIA_BASE_URL: 'https://cdn.example.com/',
      }).STORAGE_DRIVER,
    ).toBe('s3');
  });

  it.each([
    {},
    { STORAGE_DRIVER: 'desconocido' },
    { STORAGE_DRIVER: 's3' },
    { STORAGE_DRIVER: 's3', AWS_REGION: 'us-east-1' },
    { STORAGE_DRIVER: 's3', S3_BUCKET: 'social-network-test' },
  ])('rechaza configuración incompleta o inválida: %j', (storageConfig) => {
    expect(() => validate({ ...baseEnvironment, ...storageConfig })).toThrow();
  });

  it('rechaza una URL HTTP cuando se selecciona S3', () => {
    expect(() =>
      validate({
        ...baseEnvironment,
        STORAGE_DRIVER: 's3',
        AWS_REGION: 'us-east-1',
        S3_BUCKET: 'social-network-test',
        PUBLIC_MEDIA_BASE_URL: 'http://localhost:3000/media/',
      }),
    ).toThrow('PUBLIC_MEDIA_BASE_URL must use HTTPS when S3 is selected');
  });
});
