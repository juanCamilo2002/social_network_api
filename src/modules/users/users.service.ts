import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, DataSource } from 'typeorm';

import { User } from './entities/user.entity';
import { UserSearchResult } from './interfaces/user-search-result.interface';
import { UserProfile } from './interfaces/user-profile.interface';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { profilePictureUrl } from './profile-picture/profile-picture-url';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { processProfilePicture } from './profile-picture/profile-picture.processor';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly config: ConfigService<EnvironmentVariables>,
    private readonly dataSource: DataSource,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  async search(query: string): Promise<UserSearchResult[]> {
    const escapedQuery = query.replace(/[!%_]/g, (character) => {
      return `!${character}`;
    });

    const pattern = `%${escapedQuery}%`;

    const users = await this.usersRepository
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

    return users.map((user) => ({
      ...user,
      profilePicture: this.getProgilePictureUrl(user.profilePicture),
    }));
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

    return {
      ...user,
      profilePicture: this.getProgilePictureUrl(user.profilePicture),
    };
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

    return {
      ...user,
      profilePicture: this.getProgilePictureUrl(user.profilePicture),
    };
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

  async updateProfilePicture(
    userId: string,
    content: Buffer,
  ): Promise<UserProfile> {
    const processed = await processProfilePicture(content);

    await this.findOwnProfile(userId);

    const storedFile = await this.storage.saveProfilePicture(
      userId,
      processed.content,
      processed.contentType,
    );

    let previousPicture: string | null;

    try {
      previousPicture = await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);

        const user = await users.findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const previous = user.profilePicture;

        await users.update({ id: userId }, { profilePicture: storedFile.key });

        return previous;
      });
    } catch (error: unknown) {
      this.logger.warn(`Profile picture may need cleanup: ${storedFile.key}`);

      throw error;
    }

    if (
      previousPicture &&
      previousPicture.startsWith(`profile-pictures/${userId}/`)
    ) {
      try {
        await this.storage.deleteProfilePicture(previousPicture);
      } catch {
        this.logger.warn(
          `Could not delete previous profile picture: ${previousPicture}`,
        );
      }
    }

    return this.findOwnProfile(userId);
  }

  private getProgilePictureUrl(value: string | null): string | null {
    return profilePictureUrl(
      value,
      this.config.getOrThrow('PUBLIC_MEDIA_BASE_URL', { infer: true }),
    );
  }
}
