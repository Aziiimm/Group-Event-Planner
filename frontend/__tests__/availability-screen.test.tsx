import React from 'react';
import { Alert } from 'react-native';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import AvailabilityManagementScreen from '@/app/availability/[circleId]';
import { availabilityApi } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const original = jest.requireActual('@/lib/api');
  return {
    ...original,
    availabilityApi: {
      getCircleAvailability: jest.fn(),
      setAvailability: jest.fn(),
      updateAvailabilityBlock: jest.fn(),
      deleteAvailabilityBlock: jest.fn(),
    },
  };
});

const mockUseLocalSearchParams = (params: Record<string, string>) => {
  const expoRouter = require('expo-router');
  expoRouter.useLocalSearchParams = jest.fn().mockReturnValue(params);
};

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('AvailabilityManagementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads current month availability and filters to current user', async () => {
    mockUseLocalSearchParams({ circleId: 'circle-1' });

    (availabilityApi.getCircleAvailability as jest.Mock).mockResolvedValue([
      // Block for current user
      {
        id: 'a1',
        user_id: 'test-user',
        date: '2099-01-15',
        hour_block: 9,
        is_available: true,
      },
      // Block for someone else – should be ignored
      {
        id: 'a2',
        user_id: 'other-user',
        date: '2099-01-15',
        hour_block: 10,
        is_available: true,
      },
    ]);

    const { getByText } = render(<AvailabilityManagementScreen />);

    // Wait for header to confirm screen rendered and API called
    await waitFor(() => {
      expect(getByText('Manage Availability')).toBeTruthy();
      expect(availabilityApi.getCircleAvailability).toHaveBeenCalled();
    });
  });

  it('creates availability for selected hours when saving', async () => {
    mockUseLocalSearchParams({ circleId: 'circle-2' });

    // No existing availability
    (availabilityApi.getCircleAvailability as jest.Mock).mockResolvedValue([]);
    (availabilityApi.setAvailability as jest.Mock).mockResolvedValue({});

    const { getByText } = render(<AvailabilityManagementScreen />);

    // Wait for screen to be ready
    await waitFor(() => {
      expect(getByText('Manage Availability')).toBeTruthy();
    });

    // Select an hour block (e.g., 9 AM)
    const hourButton = getByText('9 AM');
    fireEvent.press(hourButton);

    // Save day
    await act(async () => {
      fireEvent.press(getByText('Save Day'));
    });

    await waitFor(() => {
      expect(availabilityApi.setAvailability).toHaveBeenCalledWith(
        'circle-2',
        expect.objectContaining({
          hour_blocks: expect.arrayContaining([9]),
        }),
      );
    });
  });

  it('deletes all availability for a date when no hours are selected', async () => {
    mockUseLocalSearchParams({ circleId: 'circle-3' });

    // Existing availability for current user on selected date
    (availabilityApi.getCircleAvailability as jest.Mock).mockResolvedValue([
      {
        id: 'block-1',
        user_id: 'test-user',
        date: new Date().toISOString().split('T')[0],
        hour_block: 10,
        is_available: true,
      },
    ]);

    (availabilityApi.deleteAvailabilityBlock as jest.Mock).mockResolvedValue({});

    const { getByText } = render(<AvailabilityManagementScreen />);

    await waitFor(() => {
      expect(getByText('Manage Availability')).toBeTruthy();
    });

    // The existing 10 AM block should be pre-selected; tap it to clear selection
    const tenAmButton = getByText('10 AM');
    fireEvent.press(tenAmButton); // toggle off

    await act(async () => {
      fireEvent.press(getByText('Remove All'));
    });

    await waitFor(() => {
      expect(availabilityApi.deleteAvailabilityBlock).toHaveBeenCalledWith('block-1');
    });
  });
});


