describe('supabase module', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('throws when SUPABASE env is missing', async () => {
    jest.resetModules();

    // ensure EXPO env vars are removed so the module will throw
    const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    // mock expo-constants and AsyncStorage BEFORE importing the module
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: {} } }));

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }));

    // Load the real module implementation (bypass any jest.setup mocks)
    expect(() => {
      jest.isolateModules(() => {
        // require the actual implementation so module-level errors run
        jest.requireActual('@/lib/supabase');
      });
    }).toThrow();

    // restore env
    if (oldUrl !== undefined) process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey !== undefined) process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  });
});
