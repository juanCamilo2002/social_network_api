import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePostDto, @Req() request: AuthenticatedRequest) {
    return this.postsService.create(dto, request.user.id);
  }
}
