import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import HomeScreen from '../(tabs)/index';

describe('HomeScreen', () => {
  it('renders HomeScreen', async () => {
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('My Circles')).toBeTruthy();
    });
  });
});
