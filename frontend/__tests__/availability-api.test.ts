describe('availabilityApi endpoints', () => {
  const setupSupabaseMock = () => {
    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: 'tok-123',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
              },
            },
            error: null,
          }),
          refreshSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      },
    }));
  };

  beforeEach(() => {
    jest.resetModules();
  });

  it('setAvailability posts correct payload to circle endpoint', async () => {
    setupSupabaseMock();

    let availabilityApi: any;
    jest.isolateModules(() => {
      availabilityApi = jest.requireActual('@/lib/api').availabilityApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as any);

    await availabilityApi.setAvailability('circle-1', {
      start_date: '2025-01-01',
      end_date: '2025-01-07',
      hour_blocks: [9, 10, 11],
      is_available: true,
    });

    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = (fetchMock as any).mock.calls[0];
    expect(url).toContain('/api/availability/circle/circle-1');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      start_date: '2025-01-01',
      end_date: '2025-01-07',
      hour_blocks: [9, 10, 11],
      is_available: true,
    });

    fetchMock.mockRestore();
  });

  it('getCircleAvailability builds optional date query parameters', async () => {
    setupSupabaseMock();

    let availabilityApi: any;
    jest.isolateModules(() => {
      availabilityApi = jest.requireActual('@/lib/api').availabilityApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as any);

    await availabilityApi.getCircleAvailability(
      'circle-2',
      '2025-02-01',
      '2025-02-28',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/availability/circle/circle-2?start_date=2025-02-01&end_date=2025-02-28',
      ),
      expect.any(Object),
    );

    fetchMock.mockRestore();
  });

  it('getAvailabilityHeatmap calls heatmap endpoint with encoded range', async () => {
    setupSupabaseMock();

    let availabilityApi: any;
    jest.isolateModules(() => {
      availabilityApi = jest.requireActual('@/lib/api').availabilityApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ heatmap: [], total_members: 0 }),
    } as any);

    await availabilityApi.getAvailabilityHeatmap(
      'circle-3',
      '2025-03-01',
      '2025-03-31',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/availability/circle/circle-3/heatmap?start_date=2025-03-01&end_date=2025-03-31',
      ),
      expect.any(Object),
    );

    fetchMock.mockRestore();
  });

  it('updateAvailabilityBlock sends PUT with is_available flag', async () => {
    setupSupabaseMock();

    let availabilityApi: any;
    jest.isolateModules(() => {
      availabilityApi = jest.requireActual('@/lib/api').availabilityApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'block-1', is_available: true }),
    } as any);

    await availabilityApi.updateAvailabilityBlock('block-1', true);

    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = (fetchMock as any).mock.calls[0];
    expect(url).toContain('/api/availability/block-1');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ is_available: true });

    fetchMock.mockRestore();
  });

  it('deleteAvailabilityBlock issues DELETE request to block endpoint', async () => {
    setupSupabaseMock();

    let availabilityApi: any;
    jest.isolateModules(() => {
      availabilityApi = jest.requireActual('@/lib/api').availabilityApi;
    });

    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as any);

    await availabilityApi.deleteAvailabilityBlock('block-xyz');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/availability/block-xyz'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    );

    fetchMock.mockRestore();
  });
});


