import { SupabaseService } from './supabase.service';
import { ConfigService } from '@nestjs/config';

// Mock the supabase client factory so no network calls are made
const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('SupabaseService (QA-style)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const makeConfig = (map: Record<string, string | undefined>) => {
    return { get: (k: string) => map[k] } as unknown as ConfigService;
  };

  it('throws when required SUPABASE env variables are missing', () => {
    const cfg = makeConfig({ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined });

    expect(() => new SupabaseService(cfg)).toThrow(
      'Missing Supabase configuration. Please check your environment variables.',
    );
  });

  it('creates a service-role client on construction and returns it via getClient()', () => {
    const url = 'https://example.supabase.co';
    const serviceKey = 'service-role-key-123';
    const fakeClient = { name: 'service-client' };

    mockCreateClient.mockReturnValueOnce(fakeClient);

    const cfg = makeConfig({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey });
    const svc = new SupabaseService(cfg);

    // getClient should return the same instance created in constructor
    expect(svc.getClient()).toBe(fakeClient);

    // createClient should be called once with the service role key and the auth options
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      url,
      serviceKey,
      expect.objectContaining({
        auth: expect.objectContaining({ autoRefreshToken: false, persistSession: false }),
      }),
    );
  });

  it('getAnonClient returns an anon client when anon key is present and validates options', () => {
    const url = 'https://example.supabase.co';
    const serviceKey = 'service-role-key-123';
    const anonKey = 'anon-key-xyz';
    const serviceClient = { name: 'service-client' };
    const anonClient = { name: 'anon-client' };

    // First call (constructor) returns serviceClient, second call (getAnonClient) returns anonClient
    mockCreateClient.mockReturnValueOnce(serviceClient).mockReturnValueOnce(anonClient);

    const cfg = makeConfig({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, SUPABASE_ANON_KEY: anonKey });
    const svc = new SupabaseService(cfg);

    const got = svc.getAnonClient();
    expect(got).toBe(anonClient);

    // createClient should have been called twice: once in constructor, once in getAnonClient
    expect(mockCreateClient).toHaveBeenCalledTimes(2);

    // second call arguments should include the anon key and same auth options
    const secondCallArgs = mockCreateClient.mock.calls[1];
    expect(secondCallArgs[0]).toBe(url);
    expect(secondCallArgs[1]).toBe(anonKey);
    expect(secondCallArgs[2]).toEqual(
      expect.objectContaining({ auth: expect.objectContaining({ autoRefreshToken: false, persistSession: false }) }),
    );
  });

  it('getAnonClient throws when anon key or url missing', () => {
    const url = 'https://example.supabase.co';
    const serviceKey = 'service-role-key-123';

    // Missing anon key
    const cfgMissingAnon = makeConfig({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, SUPABASE_ANON_KEY: undefined });
    const svc = new SupabaseService(cfgMissingAnon);
    expect(() => svc.getAnonClient()).toThrow(
      'Missing Supabase configuration. Please check your environment variables.',
    );
  });
});
