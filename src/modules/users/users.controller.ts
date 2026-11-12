import { Controller, Get, Param, Query } from '@nestjs/common';

import { SearchUserDto } from './dto/search-user.dto';
import { UserSearchResult } from './interfaces/user-search-result.interface';
import { UsersService } from './users.service';
import { UserProfile } from './interfaces/user-profile.interface';

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
}
