import Constants from 'expo-constants';

import { supabase } from './supabase';

// Get API URL from environment or use default
const getApiUrl = () => {
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    'http://localhost:3000'
  );
};

// Get auth token from Supabase session
// Ensures we get a fresh session, especially after logout/login
// Get auth token from Supabase session
// Ensures we get a fresh session, especially after logout/login
const getAuthToken = async (retryCount = 0): Promise<string | null> => {
  try {
    // Get the current session - getSession() reads from storage
    // We'll try up to 3 times with increasing delays to handle race conditions
    let session = null;
    let error = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.auth.getSession();
      session = result.data.session;
      error = result.error;

      if (session || error) {
        break;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }

    if (error) {
      console.error('Error getting session:', error);
      return null;
    }

    // If still no session after retries, return null
    if (!session) {
      return null;
    }

    // Check if token is expired or about to expire (within 60 seconds)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000);

      // If token is expired or expires soon, try to refresh it
      if (expiresIn < 60) {
        try {
          const {
            data: { session: refreshedSession },
            error: refreshError,
          } = await supabase.auth.refreshSession();

          if (!refreshError && refreshedSession?.access_token) {
            return refreshedSession.access_token;
          } else if (refreshError) {
            // If refresh fails and token is expired, return null to force re-authentication
            if (expiresIn <= 0) {
              console.warn('Token expired and refresh failed:', refreshError);
              return null;
            }
            // If token is still valid for a bit, use it anyway
            console.warn('Failed to refresh session, using current token:', refreshError);
          }
        } catch (refreshErr) {
          // If refresh fails and token is expired, return null
          if (expiresIn <= 0) {
            console.warn('Token expired and refresh threw error:', refreshErr);
            return null;
          }
          // If token is still valid for a bit, use it anyway
          console.warn('Failed to refresh session, using current token:', refreshErr);
        }
      }
    }

    return session.access_token || null;
  } catch (error) {
    console.error('Error in getAuthToken:', error);
    return null;
  }
};

// Generic API request function
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> => {
  const apiUrl = getApiUrl();
  const token = await getAuthToken();

  const response = await fetch(`${apiUrl}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || response.statusText;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || `HTTP error! status: ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  return response;
};

// Circles API
export const circlesApi = {
  // Get all circles for the current user
  getUserCircles: async () => {
    const response = await apiRequest('/circles');
    return response.json();
  },

  // Get circle details
  getCircle: async (circleId: string) => {
    const response = await apiRequest(`/circles/${circleId}`);
    return response.json();
  },

  // Get circle members
  getCircleMembers: async (circleId: string) => {
    const response = await apiRequest(`/circles/${circleId}/members`);
    return response.json();
  },

  // Get pending invitations for a circle
  getCirclePendingInvitations: async (circleId: string) => {
    const response = await apiRequest(`/circles/${circleId}/pending-invitations`);
    return response.json();
  },

  // Create a new circle
  createCircle: async (name: string, description?: string) => {
    const response = await apiRequest('/circles', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    return response.json();
  },

  // Search users by display name
  searchUsers: async (query: string) => {
    const response = await apiRequest(`/circles/search-users?query=${encodeURIComponent(query)}`);
    return response.json();
  },

  // Create an invitation
  createInvitation: async (circleId: string, inviteeId: string) => {
    const response = await apiRequest('/circles/invitations', {
      method: 'POST',
      body: JSON.stringify({ circleId, inviteeId }),
    });
    return response.json();
  },

  // Get pending invitations
  getPendingInvitations: async () => {
    const response = await apiRequest('/circles/invitations/pending');
    return response.json();
  },

  // Respond to an invitation (accept or decline)
  respondToInvitation: async (invitationId: string, response: 'accept' | 'decline') => {
    const apiResponse = await apiRequest('/circles/invitations/respond', {
      method: 'POST',
      body: JSON.stringify({ invitationId, response }),
    });
    return apiResponse.json();
  },
};

// Events API
export const eventsApi = {
  // Create an event for a circle
  createEvent: async (
    circleId: string,
    eventData: {
      title: string;
      date_time: string;
      location: string;
      description?: string;
    },
  ) => {
    const response = await apiRequest(`/events/circle/${circleId}`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
    return response.json();
  },

  // Get all events for a circle
  getCircleEvents: async (circleId: string) => {
    const response = await apiRequest(`/events/circle/${circleId}`);
    return response.json();
  },

  // Get event details
  getEvent: async (eventId: string) => {
    const response = await apiRequest(`/events/${eventId}`);
    return response.json();
  },

  // RSVP to an event (going or not_going)
  rsvpToEvent: async (eventId: string, status: 'going' | 'not_going') => {
    const response = await apiRequest(`/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    return response.json();
  },

  // Get all RSVPs for an event
  getEventRSVPs: async (eventId: string) => {
    const response = await apiRequest(`/events/${eventId}/rsvps`);
    return response.json();
  },
};

// Expenses API
export const expensesApi = {
  // Create an expense for an event
  createExpense: async (
    eventId: string,
    expenseData: {
      title: string;
      amount: number;
      paid_by: string;
      split_type: 'equal' | 'individual' | 'custom';
      attendee_ids: string[];
      custom_splits?: { user_id: string; amount_owed: number }[];
      description?: string;
    },
  ) => {
    const response = await apiRequest(`/expenses/event/${eventId}`, {
      method: 'POST',
      body: JSON.stringify(expenseData),
    });
    return response.json();
  },

  // Get all expenses for an event
  getEventExpenses: async (eventId: string) => {
    const response = await apiRequest(`/expenses/event/${eventId}`);
    return response.json();
  },

  // Get expense summary for an event
  getExpenseSummary: async (eventId: string) => {
    const response = await apiRequest(`/expenses/event/${eventId}/summary`);
    return response.json();
  },

  // Get single expense details
  getExpense: async (expenseId: string) => {
    const response = await apiRequest(`/expenses/${expenseId}`);
    return response.json();
  },

  // Update an expense
  updateExpense: async (
    expenseId: string,
    updateData: {
      title?: string;
      amount?: number;
      paid_by?: string;
      split_type?: 'equal' | 'individual' | 'custom';
      attendee_ids?: string[];
      custom_splits?: { user_id: string; amount_owed: number }[];
      description?: string;
    },
  ) => {
    const response = await apiRequest(`/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
    return response.json();
  },

  // Delete an expense
  deleteExpense: async (expenseId: string) => {
    const response = await apiRequest(`/expenses/${expenseId}`, {
      method: 'DELETE',
    });
    return response.json();
  },
};
