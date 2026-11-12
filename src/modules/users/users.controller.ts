import { Controller, Get, Query } from '@nestjs/common';

import { SearchUserDto } from './dto/search-user.dto';
import { UserSearchResult } from './interfaces/user-search-result.interface';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  search(@Query() query: SearchUserDto): Promise<UserSearchResult[]> {
    return this.usersService.search(query.q);
  }
}
