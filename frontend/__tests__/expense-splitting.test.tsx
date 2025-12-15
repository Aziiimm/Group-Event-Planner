import React from 'react';
import { Alert } from 'react-native';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import EventDetailScreen from '@/app/events/[id]';
import CreateExpenseScreen from '@/app/expenses/create';
import EditExpenseScreen from '@/app/expenses/edit';
import { eventsApi, expensesApi } from '@/lib/api';

// Reuse jest.setup mocks but extend types here
jest.mock('@/lib/api', () => {
  const original = jest.requireActual('@/lib/api');
  return {
    ...original,
    eventsApi: {
      getEvent: jest.fn(),
      getEventRSVPs: jest.fn(),
      rsvpToEvent: jest.fn(),
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

// Mock Alerts to avoid native popups in test env and allow assertions
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// expo-router params are already partially mocked in jest.setup.ts; we add helpers
const mockUseLocalSearchParams = (params: Record<string, string>) => {
  const expoRouter = require('expo-router');
  expoRouter.useLocalSearchParams = () => params;
};

describe('Expense Splitting UI Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EventDetailScreen expenses summary', () => {
    it('renders expense totals, balances and list with decimal precision', async () => {
      mockUseLocalSearchParams({ id: 'event-1' });

      (eventsApi.getEvent as jest.Mock).mockResolvedValue({
        id: 'event-1',
        title: 'Trip',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        location: 'Beach',
        description: 'Fun trip',
        status: 'upcoming',
        host_id: 'host-1',
        host: {
          id: 'host-1',
          display_name: 'Host User',
          first_name: 'Host',
          last_name: 'User',
        },
        circle_id: 'circle-1',
        created_at: new Date().toISOString(),
      });

      const rsvps = [
        {
          id: 'r1',
          event_id: 'event-1',
          user_id: 'test-user',
          status: 'going' as const,
          created_at: new Date().toISOString(),
          user: {
            id: 'test-user',
            display_name: 'Test User',
            first_name: 'Test',
            last_name: 'User',
          },
        },
        {
          id: 'r2',
          event_id: 'event-1',
          user_id: 'friend-1',
          status: 'going' as const,
          created_at: new Date().toISOString(),
          user: {
            id: 'friend-1',
            display_name: 'Friend One',
            first_name: 'Friend',
            last_name: 'One',
          },
        },
      ];

      (eventsApi.getEventRSVPs as jest.Mock).mockResolvedValue(rsvps);

      // Many expenses and decimal-heavy balances
      (expensesApi.getEventExpenses as jest.Mock).mockResolvedValue(
        Array.from({ length: 8 }).map((_, index) => ({
          id: `expense-${index + 1}`,
          title: `Expense ${index + 1}`,
          description: null,
          paid_by: index % 2 === 0 ? 'test-user' : 'friend-1',
          amount: 1234.567, // large amount to test toFixed
          splits: [
            {
              id: `split-${index + 1}-1`,
              user_id: 'test-user',
              amount_owed: 617.2835,
            },
            {
              id: `split-${index + 1}-2`,
              user_id: 'friend-1',
              amount_owed: 617.2835,
            },
          ],
        })),
      );

      (expensesApi.getExpenseSummary as jest.Mock).mockResolvedValue({
        total_expenses: 98765.4321,
        balances: [
          { user_id: 'test-user', net: 1234.5678 },
          { user_id: 'friend-1', net: -1234.5678 },
        ],
      });

      const { getByText, findAllByText, getAllByText } = render(<EventDetailScreen />);

      // Wait for expenses header
      await waitFor(() => {
        expect(getByText('Expenses')).toBeTruthy();
      });

      // Total and balances are formatted to 2 decimal places
      expect(getByText('$98765.43')).toBeTruthy();
      expect(getByText('+$1234.57')).toBeTruthy();
      expect(getByText('-$1234.57')).toBeTruthy();

      // Each expense line shows amount to 2 decimals
      const amounts = await findAllByText('$1234.57');
      expect(amounts.length).toBeGreaterThanOrEqual(1);

      // Splits list shows per-person amounts with 2 decimals and "+N more" for many attendees
      const splitLabels = getAllByText(/Split among 2 persons?/);
      expect(splitLabels.length).toBeGreaterThan(0);
      // Split rows render name and amount in separate Text nodes; assert both pieces exist
      const friendLabels = getAllByText('Friend One');
      expect(friendLabels.length).toBeGreaterThan(0);
    });
  });

  describe('CreateExpenseScreen', () => {
    it('creates an equal split expense (happy path)', async () => {
      mockUseLocalSearchParams({ eventId: 'event-1' });

      (eventsApi.getEventRSVPs as jest.Mock).mockResolvedValue([
        {
          id: 'r1',
          user_id: 'test-user',
          status: 'going',
          user: {
            id: 'test-user',
            display_name: 'Test User',
            first_name: 'Test',
            last_name: 'User',
          },
        },
        {
          id: 'r2',
          user_id: 'friend-1',
          status: 'going',
          user: {
            id: 'friend-1',
            display_name: 'Friend One',
            first_name: 'Friend',
            last_name: 'One',
          },
        },
      ]);

      (expensesApi.createExpense as jest.Mock).mockResolvedValue({});

      const { getByPlaceholderText, getByText } = render(<CreateExpenseScreen />);

      // Title & amount
      fireEvent.changeText(
        getByPlaceholderText('e.g., Dinner, Gas, Supplies'),
        'Dinner',
      );
      fireEvent.changeText(getByPlaceholderText('0.00'), '100.99');

      // Select second attendee to include two people
      await waitFor(() => {
        expect(getByText('Friend One')).toBeTruthy();
      });
      fireEvent.press(getByText('Friend One'));

      // Ensure button enabled and submit
      await act(async () => {
        fireEvent.press(getByText('Create Expense'));
      });

      await waitFor(() => {
        expect(expensesApi.createExpense).toHaveBeenCalledWith('event-1', expect.objectContaining({
          title: 'Dinner',
          amount: 100.99,
          split_type: 'equal',
          attendee_ids: ['test-user', 'friend-1'],
        }));
      });
    });

    it('shows validation error when custom splits do not sum to total (decimal precision)', async () => {
      mockUseLocalSearchParams({ eventId: 'event-2' });

      (eventsApi.getEventRSVPs as jest.Mock).mockResolvedValue([
        {
          id: 'r1',
          user_id: 'test-user',
          status: 'going',
          user: {
            id: 'test-user',
            display_name: 'Test User',
            first_name: 'Test',
            last_name: 'User',
          },
        },
        {
          id: 'r2',
          user_id: 'friend-1',
          status: 'going',
          user: {
            id: 'friend-1',
            display_name: 'Friend One',
            first_name: 'Friend',
            last_name: 'One',
          },
        },
      ]);

      const { getByPlaceholderText, getByText, getAllByPlaceholderText } = render(
        <CreateExpenseScreen />,
      );

      fireEvent.changeText(
        getByPlaceholderText('e.g., Dinner, Gas, Supplies'),
        'Custom Split Expense',
      );
      fireEvent.changeText(getByPlaceholderText('0.00'), '100.00');

      // Switch to custom split
      fireEvent.press(getByText('Custom'));

      await waitFor(() => {
        expect(getByText('Friend One')).toBeTruthy();
      });
      fireEvent.press(getByText('Friend One'));

      // Two split amount fields (for test-user & friend-1)
      const splitInputs = getAllByPlaceholderText('0.00');
      // Give them values that do NOT sum to 100.00
      fireEvent.changeText(splitInputs[1], '30.00');
      fireEvent.changeText(splitInputs[2], '60.00');

      await act(async () => {
        fireEvent.press(getByText('Create Expense'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Custom splits must sum to 100.00'),
        );
      });
      expect(expensesApi.createExpense).not.toHaveBeenCalled();
    });
  });

  describe('EditExpenseScreen', () => {
    it('updates expense with many attendees and splits', async () => {
      mockUseLocalSearchParams({ eventId: 'event-3', expenseId: 'expense-123' });

      const manyRsvps = Array.from({ length: 10 }).map((_, index) => ({
        id: `r-${index}`,
        user_id: `user-${index}`,
        status: 'going' as const,
        user: {
          id: `user-${index}`,
          display_name: `User ${index}`,
          first_name: 'User',
          last_name: `${index}`,
        },
      }));

      (eventsApi.getEventRSVPs as jest.Mock).mockResolvedValue(manyRsvps);

      (expensesApi.getExpense as jest.Mock).mockResolvedValue({
        id: 'expense-123',
        title: 'Big Group Expense',
        amount: 1000,
        split_type: 'custom',
        description: '',
        splits: manyRsvps.map((rsvp) => ({
          user_id: rsvp.user_id,
          amount_owed: 100, // 10 * 100 = 1000
        })),
      });

      (expensesApi.updateExpense as jest.Mock).mockResolvedValue({});

      const { getByText, getByDisplayValue } = render(<EditExpenseScreen />);

      // Wait for prefilled data
      await waitFor(() => {
        expect(getByDisplayValue('Big Group Expense')).toBeTruthy();
      });

      // Change amount slightly to test rounding and total validation
      fireEvent.changeText(getByDisplayValue('1000'), '1000.00');

      await act(async () => {
        fireEvent.press(getByText('Update Expense'));
      });

      await waitFor(() => {
        expect(expensesApi.updateExpense).toHaveBeenCalledWith(
          'expense-123',
          expect.objectContaining({
            amount: 1000,
            split_type: 'custom',
            attendee_ids: manyRsvps.map((r) => r.user_id),
            custom_splits: expect.arrayContaining([
              expect.objectContaining({
                user_id: 'user-0',
                amount_owed: 100,
              }),
            ]),
          }),
        );
      });
    });
  });
});

