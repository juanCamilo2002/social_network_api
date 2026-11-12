import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';

import { SearchUserDto } from './dto/search-user.dto';
import { UserSearchResult } from './interfaces/user-search-result.interface';
import { UsersService } from './users.service';
import { UserProfile } from './interfaces/user-profile.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';

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
}
