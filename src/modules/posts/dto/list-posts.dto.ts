import { IsOptional, IsUUID } from 'class-validator';

export class ListPostsDto {
  @IsOptional()
  @IsUUID()
  authorId?: string;
}
