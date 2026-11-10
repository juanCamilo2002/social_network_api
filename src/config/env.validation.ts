import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

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
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment variables invalids:\n${errors.join('\n')}`);
  }

  return validatedConfig;
}
