import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

function trimIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateOwnProfileDto {
  @Transform(({ value }: { value: unknown }) => trimIfString(value))
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @Transform(({ value }: { value: unknown }) => trimIfString(value))
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @Transform(({ value }: { value: unknown }) => {
    const trimmed = trimIfString(value);
    return trimmed === '' ? null : trimmed;
  })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @MaxLength(500)
  biography?: string | null;
}
