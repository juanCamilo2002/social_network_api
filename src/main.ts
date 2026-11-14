import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './config/env.validation';
import { parseAllowedOrigins } from './config/cors-origins';
import { LOCAL_UPLOAD_ROOT } from './modules/storage/storage.paths';
import { configureHttp } from './config/http.config';

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

  configureHttp(
    app,
    allowedOrigins,
    LOCAL_UPLOAD_ROOT,
    config.getOrThrow('STORAGE_DRIVER', { infer: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
