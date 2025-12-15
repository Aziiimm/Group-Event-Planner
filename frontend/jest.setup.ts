import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      apiUrl: 'http://localhost:3000',
    },
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    session: null,
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase', () => {
  const mockSingle = jest.fn().mockResolvedValue({
    data: {
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
    },
  });

  const mockEq = jest.fn(() => ({
    single: mockSingle,
  }));

  const mockSelect = jest.fn(() => ({
    eq: mockEq,
    single: mockSingle,
  }));

  return {
    supabase: {
      from: jest.fn(() => ({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })),
    },
  };
});

jest.mock('@/lib/api', () => {
  const originalModule = jest.requireActual('@/lib/api');
  return {
    ...originalModule,
    circlesApi: {
      getUserCircles: jest.fn().mockResolvedValue([]),
      getPendingInvitations: jest.fn().mockResolvedValue([]),
      respondToInvitation: jest.fn().mockResolvedValue({}),
    },
    // Default no-op mocks for events/expenses; individual tests can override
    eventsApi: {
      createEvent: jest.fn(),
      getCircleEvents: jest.fn(),
      getEvent: jest.fn(),
      rsvpToEvent: jest.fn(),
      getEventRSVPs: jest.fn(),
    },
    expensesApi: {
      createExpense: jest.fn(),
      getEventExpenses: jest.fn(),
      getExpenseSummary: jest.fn(),
      getExpense: jest.fn(),
      updateExpense: jest.fn(),
      deleteExpense: jest.fn(),
    },
  };
});

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
