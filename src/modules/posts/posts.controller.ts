import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post as PostSocial } from './interfaces/post.interface';
import { CreatePostDto } from './dto/create-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(): PostSocial[] {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): PostSocial {
    return this.postsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePostDto): PostSocial {
    return this.postsService.create(dto);
  }
}
