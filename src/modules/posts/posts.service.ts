import { Injectable, NotFoundException } from '@nestjs/common';
import { Post } from './interfaces/post.interface';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  private posts: Post[] = [
    {
      id: 1,
      author: 'Juan Camilo Ordoñez',
      content: 'El cielo está hermoso.',
      createdAt: '2026-11-06T20:27:42.188Z',
    },
    {
      id: 2,
      author: 'Diego Alejandro Ordoñez Morea',
      content: 'Esta tarde está bellisima',
      createdAt: '2026-11-06T20:27:42.188Z',
    },
  ];

  findAll(): Post[] {
    return this.posts;
  }

  findOne(id: number): Post {
    const post = this.posts.find((post) => post.id === id);

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }

  create(dto: CreatePostDto): Post {
    const newPost: Post = {
      id: this.posts.length + 1,
      author: dto.author,
      content: dto.content,
      createdAt: new Date().toISOString(),
    };

    this.posts.push(newPost);

    return newPost;
  }
}
