import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { AuthModule } from '../src/modules/auth/auth.module';
import { User } from '../src/modules/users/entities/user.entity';
import { PostsModule } from '../src/modules/posts/posts.module';
import { Post } from '../src/modules/posts/entities/post.entity';

const TEST_SECRET = 'test-secret-only-for-module-tests-123456';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('AuthModule y guard global (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
        }),
        AuthModule,
        PostsModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: jest.fn().mockReturnValue(TEST_SECRET),
      })
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .overrideProvider(getRepositoryToken(Post))
      .useValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    jwtService = moduleRef.get(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite llegar a la validación de registro sin token', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(400);
  });

  it('permite llegar a la validación de login sin token', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
  });

  it('protege las rutas de posts sin configuración local del guard', async () => {
    await request(app.getHttpServer()).get('/posts').expect(401);
  });

  it('rechaza un token inválido en posts', async () => {
    await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('permite consultar posts con un token válido', async () => {
    const token = await jwtService.signAsync({
      sub: USER_ID,
    });

    await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
