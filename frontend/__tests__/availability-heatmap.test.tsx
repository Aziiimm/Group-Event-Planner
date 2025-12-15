import React from 'react';

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import AvailabilityHeatmap from '@/components/availability/availability-heatmap';
import { availabilityApi } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const original = jest.requireActual('@/lib/api');
  return {
    ...original,
    availabilityApi: {
      getAvailabilityHeatmap: jest.fn(),
    },
  };
});

describe('AvailabilityHeatmap component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches heatmap data for circle and renders header', async () => {
    (availabilityApi.getAvailabilityHeatmap as jest.Mock).mockResolvedValue({
      heatmap: [],
      total_members: 0,
    });

    const { getByText } = render(
      <AvailabilityHeatmap circleId="circle-heatmap" showHourDetails={false} />,
    );

    await waitFor(() => {
      expect(getByText('Availability Heatmap')).toBeTruthy();
      expect(availabilityApi.getAvailabilityHeatmap).toHaveBeenCalledWith(
        'circle-heatmap',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  it('calls onTimeSelect when an hour is tapped with showHourDetails enabled', async () => {
    (availabilityApi.getAvailabilityHeatmap as jest.Mock).mockResolvedValue({
      heatmap: [
        {
          date: '2099-01-10',
          hour_blocks: [
            {
              hour_block: 9,
              available_count: 3,
              total_members: 4,
              percentage: 75,
            },
          ],
        },
      ],
      total_members: 4,
    });

    const onTimeSelect = jest.fn();

    const { getByText } = render(
      <AvailabilityHeatmap
        circleId="circle-heatmap-2"
        startDate="2099-01-01"
        endDate="2099-01-31"
        selectedDate="2099-01-10"
        showHourDetails
        onTimeSelect={onTimeSelect}
      />,
    );

    // Wait until hour details are rendered
    await waitFor(() => {
      expect(getByText('9 AM')).toBeTruthy();
    });

    fireEvent.press(getByText('9 AM'));

    expect(onTimeSelect).toHaveBeenCalledWith('2099-01-10', 9, 9);
  });
});


