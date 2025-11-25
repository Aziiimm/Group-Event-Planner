describe('use-auth re-export', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('re-exports useAuth from contexts/AuthContext', async () => {
    const fake = { useAuth: () => ({ user: { id: 'x' } }) };
    jest.doMock('@/contexts/AuthContext', () => fake);

    let useAuth: any;
    jest.isolateModules(() => {
      // Use requireActual to bypass any global mocks created in jest.setup
      useAuth = jest.requireActual('@/hooks/use-auth').useAuth;
    });

    expect(typeof useAuth).toBe('function');
    const ctx = useAuth();
    expect(ctx.user.id).toBe('x');
  });
});
