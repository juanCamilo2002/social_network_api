import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { EnvironmentVariables } from './env.validation';
import { User } from '../modules/users/entities/user.entity';
import { Post } from '../modules/posts/entities/post.entity';

type DatabaseEnvironment = Pick<
  EnvironmentVariables,
  'DB_HOST' | 'DB_PORT' | 'DB_USERNAME' | 'DB_PASSWORD' | 'DB_NAME'
>;

export function createDatabaseOptions(
  env: DatabaseEnvironment,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    entities: [User, Post],
    migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
    synchronize: false,
    migrationsRun: false,
  };
}
