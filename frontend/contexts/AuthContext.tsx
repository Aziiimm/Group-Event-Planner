import React, { createContext, useContext, useEffect, useState } from 'react';

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    firstName: string,
    lastName: string,
  ) => Promise<{ error: any; session: Session | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Update state based on auth events
      // TOKEN_REFRESHED events are automatically handled by Supabase
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (identifier: string, password: string) => {
    // Get API URL from environment or use default
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ||
      Constants.expoConfig?.extra?.apiUrl ||
      'http://localhost:3000';

    try {
      // Call backend login endpoint (supports email or display_name)
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier, // Can be email or display_name
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle backend validation errors
        const errorMessage = data.message || 'Login failed. Please try again.';
        return { error: { message: errorMessage } };
      }

      // Backend returns user and session, but we need to set the session in Supabase client
      // The session token needs to be set in the Supabase client for it to work properly
      if (data.session) {
        // Set the session in Supabase client
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          console.error('Error setting session:', sessionError);
          return { error: sessionError };
        }

        // Ensure the session is properly set and persisted
        // Wait a bit to ensure AsyncStorage has been updated
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        // Verify the session was set correctly - retry up to 3 times
        let verifySession = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            verifySession = session;
            break;
          }
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        
        if (!verifySession) {
          console.error('Failed to verify session after setting');
          return {
            error: {
              message: 'Failed to set session. Please try again.',
            },
          };
        }
      } else {
        return {
          error: {
            message: 'No session returned from server. Please try again.',
          },
        };
      }

      return { error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        error: {
          message:
            error.message || 'Network error. Please check your connection.',
        },
      };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    firstName: string,
    lastName: string,
  ) => {
    // Get API URL from environment or use default
    // For production, set EXPO_PUBLIC_API_URL in your .env file
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ||
      Constants.expoConfig?.extra?.apiUrl ||
      'http://localhost:3000';

    try {
      // Call backend signup endpoint for validation and user creation
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
          firstName,
          lastName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle backend validation errors (e.g., duplicate display_name)
        const errorMessage =
          data.message || 'Signup failed. Please try again.';
        return {
          error: { message: errorMessage },
          session: null,
        };
      }

      // If backend created the user successfully, sign in with Supabase
      // The backend creates the auth user, so we need to sign in to get the session
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        // If email confirmation is required, signInWithPassword will fail
        // In that case, return success but no session (user needs to confirm email)
        if (
          signInError.message?.includes('Email not confirmed') ||
          signInError.message?.includes('email_not_confirmed')
        ) {
          return {
            error: null,
            session: null, // User needs to confirm email first
          };
        }

        return {
          error: {
            message:
              'Account created but sign-in failed. Please try logging in.',
          },
          session: null,
        };
      }

      return { error: null, session: signInData.session };
    } catch (error: any) {
      console.error('Signup error:', error);
      return {
        error: {
          message:
            error.message || 'Network error. Please check your connection.',
        },
        session: null,
      };
    }
  };

  const signOut = async () => {
    // Force clear any remaining session data immediately
    setSession(null);
    setUser(null);
    
    // Clear the session from Supabase
    await supabase.auth.signOut();
    
    // Explicitly clear Supabase auth storage keys from AsyncStorage
    // Supabase stores session data with keys like 'sb-<project-ref>-auth-token'
    try {
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter((key) => 
        key.includes('supabase') || key.includes('sb-') || key.includes('auth-token')
      );
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
      }
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
    }
    
    // Wait a bit to ensure everything is cleared
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
