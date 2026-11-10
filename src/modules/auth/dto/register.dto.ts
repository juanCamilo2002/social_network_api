import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) => trimIfString(value))
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'The nickname can only contain letters, numbers, and underscores.',
  })
  nickname!: string;

  @Transform(({ value }: { value: unknown }) => trimIfString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Transform(({ value }: { value: unknown }) => trimIfString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }: { value: unknown }) => trimIfString(value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'The date of birth must be in the format YYYY-MM-DD',
  })
  birthdate?: string | null;
}
