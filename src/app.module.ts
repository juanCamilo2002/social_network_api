import { Module } from '@nestjs/common';
import { PostsModule } from './modules/posts/posts.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvironmentVariables, validate } from './config/env.validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDatabaseOptions } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) =>
        createDatabaseOptions({
          DB_HOST: config.getOrThrow('DB_HOST', { infer: true }),
          DB_PORT: config.getOrThrow('DB_PORT', { infer: true }),
          DB_USERNAME: config.getOrThrow('DB_USERNAME', { infer: true }),
          DB_PASSWORD: config.getOrThrow('DB_PASSWORD', { infer: true }),
          DB_NAME: config.getOrThrow('DB_NAME', { infer: true }),
        }),
    }),
    AuthModule,
    PostsModule,
  ],
})
export class AppModule {}
