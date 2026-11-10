import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePostDto {
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }

    return value;
  })
  @IsString()
  @IsNotEmpty()
  author!: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }

    return value;
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
