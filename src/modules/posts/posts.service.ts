import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Repository } from 'typeorm';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async findAll(): Promise<Post[]> {
    return this.postsRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postsRepository.findOneBy({ id });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }

  async create(dto: CreatePostDto, authorId: string): Promise<Post> {
    const post = this.postsRepository.create({
      content: dto.content,
      authorId,
    });

    return this.postsRepository.save(post);
  }

  async update(id: string, dto: UpdatePostDto, userId: string): Promise<Post> {
    const post = await this.findOne(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You cannot edit this post');
    }

    post.content = dto.content;

    return this.postsRepository.save(post);
  }
}
