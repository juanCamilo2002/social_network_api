import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { parseAllowedOrigins } from './cors-origins';
import { parsePublicMediaUrl } from './public-media-url';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

function parsePort(value: unknown): unknown {
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parsePort(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  DB_HOST!: string;

  @Transform(({ value }: { value: unknown }) => parsePort(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  DB_NAME!: string;

  @IsString()
  @MinLength(32)
  @Matches(/\S/)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ALLOWED_ORIGINS!: string;

  @IsString()
  @IsNotEmpty()
  PUBLIC_MEDIA_BASE_URL!: string;

  @IsIn(['local', 's3'])
  STORAGE_DRIVER!: 'local' | 's3';

  @ValidateIf((config: EnvironmentVariables) => config.STORAGE_DRIVER === 's3')
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/)
  AWS_REGION?: string;

  @ValidateIf((config: EnvironmentVariables) => config.STORAGE_DRIVER === 's3')
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/)
  S3_BUCKET?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment variables invalids:\n${errors.join('\n')}`);
  }

  parseAllowedOrigins(validatedConfig.CORS_ALLOWED_ORIGINS);

  validatedConfig.PUBLIC_MEDIA_BASE_URL = parsePublicMediaUrl(
    validatedConfig.PUBLIC_MEDIA_BASE_URL,
  );

  if (
    validatedConfig.STORAGE_DRIVER === 's3' &&
    new URL(validatedConfig.PUBLIC_MEDIA_BASE_URL).protocol !== 'https:'
  ) {
    throw new Error('PUBLIC_MEDIA_BASE_URL must use HTTPS when S3 is selected');
  }

  return validatedConfig;
}
