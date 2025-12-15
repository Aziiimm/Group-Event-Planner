import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { config } from 'dotenv';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App e2e', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    // Load test environment (points at test Supabase project, etc.)
    config({ path: join(__dirname, '..', '.env.local') });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('Flow 1: signup -> login -> GET /circles returns empty list for new user', async () => {
    const server = app.getHttpServer();

    const ts = Date.now();
    const email = `qa-user-${ts}@example.com`;
    const password = 'Test1234!';
    const displayName = `qa_user_${ts}`;
    const firstName = 'QA';
    const lastName = 'User';

    // 1) Sign up a brand new user
    await request(server)
      .post('/auth/signup')
      .send({
        email,
        password,
        displayName,
        firstName,
        lastName,
      })
      .expect(201);

    // 2) Log in with the same credentials to get a Supabase access token
    const loginRes = await request(server)
      .post('/auth/login')
      .send({
        identifier: email,
        password,
      })
      .expect(200);

    const accessToken = loginRes.body?.session?.access_token;
    expect(accessToken).toBeDefined();

    // 3) Call /circles with the Bearer token and expect an empty array
    const circlesRes = await request(server)
      .get('/circles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(circlesRes.body)).toBe(true);
    expect(circlesRes.body.length).toBe(0);
  });
});
