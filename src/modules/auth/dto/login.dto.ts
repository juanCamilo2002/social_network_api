import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

function trimIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => trimIfString(value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
