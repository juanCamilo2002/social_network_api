import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

interface JwtPayload {
  sub?: unknown;
  exp?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    const token = match?.[1];

    if (!token) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub) ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    request.user = {
      id: payload.sub,
    };

    return true;
  }
}
