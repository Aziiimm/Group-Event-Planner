import React, { createContext, useContext, useEffect, useState } from 'react';

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
    // Sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (authError) {
      return { error: authError, session: null };
    }

    // If signup was successful and we have a user, create a row in public.users
    if (authData.user) {
      const now = new Date().toISOString();
      const { error: dbError } = await supabase.from('users').insert({
        id: authData.user.id, // Use the same ID as auth.users
        email: email,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        created_at: now,
        last_login: now, // Set last_login to the same value as created_at on first signup
      });

      if (dbError) {
        console.error('Error creating user profile:', dbError);
        // Note: User is already created in auth.users, but profile creation failed
        // You might want to handle this differently based on your needs
        return { error: dbError, session: null };
      }
    }

    // Return the session if user is automatically signed in (email confirmation disabled)
    // or null if email confirmation is required
    return { error: null, session: authData.session };
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
