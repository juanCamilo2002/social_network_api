import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { UserSearchResult } from './interfaces/user-search-result.interface';
import { UserProfile } from './interfaces/user-profile.interface';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async search(query: string): Promise<UserSearchResult[]> {
    const escapedQuery = query.replace(/[!%_]/g, (character) => {
      return `!${character}`;
    });

    const pattern = `%${escapedQuery}%`;

    return this.usersRepository
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.name', 'name')
      .addSelect('user.lastName', 'lastName')
      .addSelect('user.profilePicture', 'profilePicture')
      .where(
        new Brackets((where) => {
          where
            .where("user.nickname ILIKE :pattern ESCAPE '!'", { pattern })
            .orWhere("user.name ILIKE :pattern ESCAPE '!'", { pattern })
            .orWhere("user.lastName ILIKE :pattern ESCAPE '!'", { pattern })
            .orWhere(
              "(user.name || ' ' || user.lastName) ILIKE :pattern ESCAPE '!'",
              { pattern },
            );
        }),
      )
      .orderBy('user.nickname', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .limit(20)
      .getRawMany<UserSearchResult>();
  }

  async findByNickName(nickname: string): Promise<UserProfile> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.name', 'name')
      .addSelect('user.lastName', 'lastName')
      .addSelect('user.profilePicture', 'profilePicture')
      .addSelect('user.banner', 'banner')
      .addSelect('user.biography', 'biography')
      .where('LOWER(user.nickname) = LOWER(:nickname)', { nickname })
      .getRawOne<UserProfile>();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findOwnProfile(userId: string): Promise<UserProfile> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.name', 'name')
      .addSelect('user.lastName', 'lastName')
      .addSelect('user.profilePicture', 'profilePicture')
      .addSelect('user.banner', 'banner')
      .addSelect('user.biography', 'biography')
      .where('user.id = :userId', { userId })
      .getRawOne<UserProfile>();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateOwnProfile(
    userId: string,
    dto: UpdateOwnProfileDto,
  ): Promise<UserProfile> {
    const changes: {
      name?: string;
      lastName?: string;
      biography?: string | null;
    } = {};

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.lastName !== undefined) {
      changes.lastName = dto.lastName;
    }

    if (dto.biography !== undefined) {
      changes.biography = dto.biography;
    }

    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('No profile fields provided');
    }

    const result = await this.usersRepository.update({ id: userId }, changes);

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    return this.findOwnProfile(userId);
  }
}
