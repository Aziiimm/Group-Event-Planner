import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

// Minimal SupabaseService shape for mocking
interface MockSupabaseClient {
  from: jest.Mock;
  auth: {
    signUp: jest.Mock;
    signInWithPassword: jest.Mock;
  };
}

describe('AuthService (unit)', () => {
  let service: AuthService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockSupabaseService: {
    getClient: jest.Mock;
    getAnonClient: jest.Mock;
  };

  beforeEach(() => {
    mockSupabaseClient = {
      from: jest.fn(),
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
      },
    };

    mockSupabaseService = {
      getClient: jest.fn(() => mockSupabaseClient),
      getAnonClient: jest.fn(() => mockSupabaseClient),
    };

    service = new AuthService(mockSupabaseService as any);
  });

  describe('signup', () => {
    const baseSignupDto = {
      email: 'TestUser@example.com',
      password: 'Test1234!',
      displayName: 'TestUser',
      firstName: 'Test',
      lastName: 'User',
    };

    it('throws ConflictException when display name is already taken', async () => {
      // Mock supabase.from('users').select(...) to return an existing user
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [{ display_name: 'testuser' }],
              error: null,
            }),
          } as any;
        }
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) } as any;
      });

      await expect(service.signup(baseSignupDto as any)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.signup(baseSignupDto as any)).rejects.toThrow(
        'This display name is already taken. Please choose a different name.',
      );
    });

    it('throws ConflictException when email is already registered', async () => {
      // 1) No duplicate display name
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [{ display_name: 'someone-else' }],
              error: null,
            }),
          } as any;
        }
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) } as any;
      });

      // 2) Supabase auth.signUp returns an "already registered" error
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'already registered' },
      });

      const promise = service.signup(baseSignupDto as any);

      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'An account with this email already exists.',
      );
    });
  });
});


