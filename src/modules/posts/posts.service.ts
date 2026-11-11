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
import { PostResponse } from './interfaces/post-response.interface';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async findAll(): Promise<PostResponse[]> {
    const posts = await this.postsWithAuthor()
      .orderBy('post.createdAt', 'DESC')
      .getMany();

    return posts.map((post) => this.toResponse(post));
  }

  async findOne(id: string): Promise<PostResponse> {
    const post = await this.findPostWithAuthor(id);

    return this.toResponse(post);
  }

  async create(dto: CreatePostDto, authorId: string): Promise<PostResponse> {
    const post = this.postsRepository.create({
      content: dto.content,
      authorId,
    });

    const savedPost = await this.postsRepository.save(post);

    return this.findOne(savedPost.id);
  }

  async update(
    id: string,
    dto: UpdatePostDto,
    userId: string,
  ): Promise<PostResponse> {
    const post = await this.findPostWithAuthor(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You cannot edit this post');
    }

    post.content = dto.content;

    const savedPost = await this.postsRepository.save(post);

    return this.toResponse(savedPost);
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findPostWithAuthor(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('You cannot delete this post');
    }

    const result = await this.postsRepository.delete({
      id,
      authorId: userId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Post not found.');
    }
  }

  private postsWithAuthor() {
    return this.postsRepository
      .createQueryBuilder('post')
      .innerJoin('post.author', 'author')
      .addSelect(['author.id', 'author.nickname', 'author.profilePicture']);
  }

  private toResponse(post: Post): PostResponse {
    return {
      id: post.id,
      authorId: post.authorId,
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author.id,
        nickname: post.author.nickname,
        profilePicture: post.author.profilePicture,
      },
    };
  }

  private async findPostWithAuthor(id: string): Promise<Post> {
    const post = await this.postsWithAuthor()
      .where('post.id = :id', { id })
      .getOne();

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }
}
