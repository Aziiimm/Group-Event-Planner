import React, { createContext, useContext, useEffect, useState } from 'react';

import Constants from 'expo-constants';
import { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return { error: authError };
    }

    // If login was successful and we have a user, update last_login in public.users
    if (authData.user) {
      const { error: dbError } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authData.user.id);

      if (dbError) {
        console.error('Error updating last_login:', dbError);
        // Don't fail the login if last_login update fails, just log it
      }
    }

    return { error: null };
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
    await supabase.auth.signOut();
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
