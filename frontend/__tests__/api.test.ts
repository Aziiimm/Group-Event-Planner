describe('apiRequest / circlesApi', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('includes Authorization header when token exists', async () => {
    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: jest
            .fn()
            .mockResolvedValue({ data: { session: { access_token: 'tok-123', expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null }),
          refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
      },
    }));

    let circlesApi: any;
    jest.isolateModules(() => {
      // Load the real implementation even if jest.setup mocked the module
      circlesApi = jest.requireActual('@/lib/api').circlesApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 1 }],
    } as any);

    const res = await circlesApi.getUserCircles();

    expect(fetchMock).toHaveBeenCalled();
    const call = (fetchMock as any).mock.calls[0];
    const headers = call[1].headers;
    expect(headers.Authorization).toBe('Bearer tok-123');
    expect(res).toEqual([{ id: 1 }]);

    fetchMock.mockRestore();
  });

  it('throws a descriptive error when non-OK JSON response', async () => {
    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: jest
            .fn()
            .mockResolvedValue({ data: { session: { access_token: 'tok-123', expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null }),
          refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
      },
    }));

    let circlesApi: any;
    jest.isolateModules(() => {
      circlesApi = jest.requireActual('@/lib/api').circlesApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ message: 'Something bad' }),
    } as any);

    await expect(circlesApi.getUserCircles()).rejects.toThrow('Something bad');

    fetchMock.mockRestore();
  });

  it('getCircle calls correct endpoint with circleId', async () => {
    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: jest
            .fn()
            .mockResolvedValue({ data: { session: { access_token: 'tok-123', expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null }),
          refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
      },
    }));

    let circlesApi: any;
    jest.isolateModules(() => {
      circlesApi = jest.requireActual('@/lib/api').circlesApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'circle-123', name: 'Test Circle' }),
    } as any);

    await circlesApi.getCircle('circle-123');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/circles/circle-123'),
      expect.any(Object),
    );
    fetchMock.mockRestore();
  });

  it('searchUsers encodes query parameter correctly', async () => {
    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: jest
            .fn()
            .mockResolvedValue({ data: { session: { access_token: 'tok-123', expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null }),
          refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
      },
    }));

    let circlesApi: any;
    jest.isolateModules(() => {
      circlesApi = jest.requireActual('@/lib/api').circlesApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as any);

    await circlesApi.searchUsers('test user');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('query=test%20user'),
      expect.any(Object),
    );
    fetchMock.mockRestore();
  });
});
