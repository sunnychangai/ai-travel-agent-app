import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// User type based on Supabase user
interface User {
  id: string;
  email: string;
  name: string;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
}

// Create the auth context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  signIn: async () => ({ success: false, message: 'Not implemented' }),
  signUp: async () => ({ success: false, message: 'Not implemented' }),
  signOut: async () => {},
});

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

// Convert Supabase user to our User type
const mapSupabaseUser = (supabaseUser: SupabaseUser): User => ({
  id: supabaseUser.id,
  email: supabaseUser.email || '',
  name: supabaseUser.user_metadata?.name || 
        supabaseUser.user_metadata?.full_name || 
        supabaseUser.email?.split('@')[0] || 
        'User',
});

// Provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user and set up auth state listener on initial render
  useEffect(() => {
    // Get current session
    const initializeAuth = async () => {
      try {
        const session = await authService.getSession();
        if (session?.user) {
          setUser(mapSupabaseUser(session.user));
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
      } else {
        setUser(null);
      }
      
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => subscription?.unsubscribe();
  }, []);

  // Sign in user using Supabase
  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);

      const { user: supabaseUser } = await authService.signIn(email, password);
      
      if (supabaseUser) {
        setUser(mapSupabaseUser(supabaseUser));
        return { success: true, message: 'Signed in successfully' };
      }

      return { success: false, message: 'Sign in failed' };
    } catch (error: any) {
      console.error('Error signing in:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to sign in. Please check your credentials.' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up user using Supabase
  const signUp = async (email: string, password: string, name: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);

      const { user: supabaseUser } = await authService.signUp(email, password);
      
      if (supabaseUser) {
        // Note: For email confirmation, user might not be immediately available
        // The auth state listener will handle setting the user when confirmed
        return { 
          success: true, 
          message: supabaseUser.email_confirmed_at 
            ? 'Account created successfully' 
            : 'Please check your email to confirm your account' 
        };
      }

      return { success: false, message: 'Account creation failed' };
    } catch (error: any) {
      console.error('Error signing up:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to create account' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out user using Supabase
  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await authService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 