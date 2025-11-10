import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
const request = supertest as any;
import { AppModule } from './../src/app.module'; 

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  // NestJS setup for testing
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // checks /health endpoint
  it('/health (GET) should return 200 OK', () => {
    return request(app.getHttpServer())
      .get('/health') 
      .expect(200); 
  });

  // Clean up after tests run
  afterAll(async () => {
    await app.close();
  });
});