import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './config/env.validation';
import { configureCors } from './config/cors.config';
import { parseAllowedOrigins } from './config/cors-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService<EnvironmentVariables>);

  const allowedOrigins = parseAllowedOrigins(
    config.getOrThrow('CORS_ALLOWED_ORIGINS', { infer: true }),
  );

  configureCors(app, allowedOrigins);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
