import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Simple user type
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

// Provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user from localStorage on initial render
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Sign in user (mock implementation)
  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);

      // In a real app, you would validate against a backend
      // This is a simplified mock that accepts any email/password
      if (email && password) {
        const user: User = {
          id: Math.random().toString(36).substring(2, 15),
          email,
          name: email.split('@')[0],
        };

        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));

        return { success: true, message: 'Signed in successfully' };
      }

      return { success: false, message: 'Invalid email or password' };
    } catch (error) {
      console.error('Error signing in:', error);
      return { success: false, message: 'Failed to sign in' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up user (mock implementation)
  const signUp = async (email: string, password: string, name: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);

      // In a real app, you would create a user in a database
      // This is a simplified mock that accepts any valid input
      if (email && password && name) {
        const user: User = {
          id: Math.random().toString(36).substring(2, 15),
          email,
          name,
        };

        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));

        return { success: true, message: 'Account created successfully' };
      }

      return { success: false, message: 'Invalid input' };
    } catch (error) {
      console.error('Error signing up:', error);
      return { success: false, message: 'Failed to create account' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out user
  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setUser(null);
      localStorage.removeItem('user');
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