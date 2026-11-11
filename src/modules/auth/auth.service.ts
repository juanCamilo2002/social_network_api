import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const passwordHash = await argon2.hash(dto.password);

    const user = this.userRepository.create({
      nickname: dto.nickname,
      name: dto.name,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
      birthdate: dto.birthdate ?? null,
    });

    try {
      const savedUser = await this.userRepository.save(user);

      return {
        id: savedUser.id,
        nickname: savedUser.nickname,
        name: savedUser.name,
        lastName: savedUser.lastName,
        email: savedUser.email,
        createdAt: savedUser.createdAt,
      };
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const databaseError = error.driverError as {
          code?: string;
          constraint?: string;
        };

        if (databaseError.code === '23505') {
          if (databaseError.constraint === 'users_nickname_lower_unique') {
            throw new ConflictException('The nickname is already in use');
          }

          if (databaseError.constraint === 'users_email_lower_unique') {
            throw new ConflictException('The email is already in use');
          }
        }
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    });

    return { accessToken };
  }
}
