import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { SearchUserDto } from './dto/search-user.dto';
import { UserSearchResult } from './interfaces/user-search-result.interface';
import { UsersService } from './users.service';
import { UserProfile } from './interfaces/user-profile.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_PROFILE_PICTURE_BYTES } from './profile-picture/profile-picture.validator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  search(@Query() query: SearchUserDto): Promise<UserSearchResult[]> {
    return this.usersService.search(query.q);
  }

  @Get('by-nickname/:nickname')
  findByNickName(@Param('nickname') nickname: string): Promise<UserProfile> {
    return this.usersService.findByNickName(nickname);
  }

  @Get('me')
  findOwnProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.usersService.findOwnProfile(user.id);
  }

  @Patch('me')
  updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOwnProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateOwnProfile(user.id, dto);
  }

  @Post('me/profile-picture')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_PROFILE_PICTURE_BYTES + 1,
        files: 1,
        fields: 0,
      },
    }),
  )
  uploadProfilePicture(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: { buffer: Buffer },
  ): Promise<UserProfile> {
    if (!file?.buffer) {
      throw new BadRequestException('Profile picture file is required');
    }

    return this.usersService.updateProfilePicture(user.id, file.buffer);
  }
}
