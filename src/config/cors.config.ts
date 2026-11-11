import { INestApplication } from '@nestjs/common';

export function configureCors(
  app: INestApplication,
  allowedOrigins: string[],
): void {
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
