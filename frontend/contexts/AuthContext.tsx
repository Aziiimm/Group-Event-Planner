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
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (identifier: string, password: string) => {
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ||
      Constants.expoConfig?.extra?.apiUrl ||
      'http://localhost:3000';

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.message || 'Login failed.' } };
      }

      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) return { error: sessionError };

        // Wait for AsyncStorage update
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Retry verification
        let verifySession = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            verifySession = session;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!verifySession) {
          return {
            error: { message: 'Failed to set session. Try again.' },
          };
        }
      }

      return { error: null };
    } catch (error: any) {
      return {
        error: { message: error.message || 'Network error.' },
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
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ||
      Constants.expoConfig?.extra?.apiUrl ||
      'http://localhost:3000';

    try {
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        return { error: { message: data.message }, session: null };
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          return { error: null, session: null };
        }

        return {
          error: { message: 'Account created but login failed.' },
          session: null,
        };
      }

      return { error: null, session: signInData.session };
    } catch (error: any) {
      return {
        error: { message: error.message || 'Network error.' },
        session: null,
      };
    }
  };

  const signOut = async () => {
    setSession(null);
    setUser(null);

    await supabase.auth.signOut();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter(
        (key) => key.includes('supabase') || key.includes('sb-') || key.includes('auth-token'),
      );
      await AsyncStorage.multiRemove(supabaseKeys);
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
