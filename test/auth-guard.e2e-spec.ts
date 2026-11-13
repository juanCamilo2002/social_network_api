import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { Public } from '../src/modules/auth/decorators/public.decorator';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../src/modules/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../src/modules/auth/interfaces/authenticated-user.interface';

const TEST_SECRET = 'test-secret-only-for-guard-tests-123456';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

@Controller('guard-test')
class GuardTestController {
  @Public()
  @Get('public')
  publicRoute() {
    return { message: 'public' };
  }

  @Get('protected')
  protectedRoute(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.id };
  }

  @Public()
  @Get('public-with-current-user')
  publicWithCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.id };
  }
}

describe('JwtAuthGuard (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: {
            expiresIn: '15m',
          },
        }),
      ],
      controllers: [GuardTestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite acceder a una ruta pública sin token', async () => {
    await request(app.getHttpServer())
      .get('/guard-test/public')
      .expect(200)
      .expect({ message: 'public' });
  });

  it('rechaza una ruta protegida sin token', async () => {
    await request(app.getHttpServer()).get('/guard-test/protected').expect(401);
  });

  it('rechaza una cabecera de autorización mal formada', async () => {
    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Authorization', 'Basic abc123')
      .expect(401);
  });

  it('rechaza un token inválido', async () => {
    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('rechaza un token expirado', async () => {
    const token = await jwtService.signAsync(
      { sub: USER_ID },
      { expiresIn: '-1s' },
    );

    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rechaza un token cuyo identificador no es un UUID', async () => {
    const token = await jwtService.signAsync({
      sub: 'usuario-invalido',
    });

    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('permite un token válido y expone el identificador del usuario', async () => {
    const token = await jwtService.signAsync({
      sub: USER_ID,
    });

    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ userId: USER_ID });
  });

  it('rechaza CurrentUser cuando no hay usuario en la petición', async () => {
    await request(app.getHttpServer())
      .get('/guard-test/public-with-current-user')
      .expect(401);
  });
});
