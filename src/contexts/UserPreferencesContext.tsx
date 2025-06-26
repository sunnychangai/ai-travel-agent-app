import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from '../components/ui/use-toast';

// Define the user preferences type
export interface UserPreferences {
  id?: string;
  user_id?: string;
  name: string;
  email: string;
  travel_style?: string;
  interests?: string[];
  budget?: string;
  preferred_accommodation?: string;
  dietary_restrictions?: string[];
  accessibility_needs?: string[];
  preferred_transportation?: string[];
  trip_duration?: number;
  created_at?: string;
  updated_at?: string;
}

// Define the context type
interface UserPreferencesContextType {
  userPreferences: UserPreferences | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  savePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  getUserPreferences: () => Promise<UserPreferences | null>;
  refreshPreferences: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  loading: boolean;
  error: string | null;
}

// Create the context with default values
const UserPreferencesContext = createContext<UserPreferencesContextType>({
  userPreferences: null,
  preferences: null,
  isLoading: false,
  loading: false,
  error: null,
  savePreferences: async () => {},
  getUserPreferences: async () => null,
  refreshPreferences: async () => {},
  updateDisplayName: async () => {},
  updatePreferences: () => {},
});

// Hook to use the user preferences context
export const useUserPreferences = () => useContext(UserPreferencesContext);

// Props for the provider component
interface UserPreferencesProviderProps {
  children: ReactNode;
}

// Provider component
export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load user preferences from Supabase on initial render and auth state change
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await refreshPreferences();
      } catch (error: any) {
        console.error('Error loading preferences:', error);
        setError('Failed to load user preferences');
      } finally {
        setIsLoading(false);
      }
    };

    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await loadPreferences();
        } else {
          setUserPreferences(null);
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Auth check error:', error);
        setUserPreferences(null);
        setIsLoading(false);
      }
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      
      if (event === 'SIGNED_IN' && session) {
        await loadPreferences();
      } else if (event === 'SIGNED_OUT') {
        setUserPreferences(null);
        setIsLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Save/Update user preferences in Supabase
  const savePreferences = async (preferences: Partial<UserPreferences>): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if user already has preferences
      const { data: existingPrefs, error: fetchError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      let result;
      
      // Get current date for updated_at
      const now = new Date().toISOString();
      
      if (existingPrefs) {
        // Update existing preferences
        const { data, error } = await supabase
          .from('user_preferences')
          .update({
            ...preferences,
            updated_at: now
          })
          .eq('user_id', user.id)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      } else {
        // Insert new preferences
        const { data, error } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            ...preferences,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      }

      setUserPreferences(result);
      
      toast({
        title: "Success",
        description: "Your preferences have been saved.",
      });
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      setError('Failed to save preferences');
      
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get current user preferences from Supabase
  const getUserPreferences = async (): Promise<UserPreferences | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: prefsData } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (prefsData) {
          return prefsData;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } catch (error: any) {
      console.error('Error fetching user preferences:', error);
      setError('Failed to fetch preferences');
      return null;
    }
  };

  // Refresh user preferences data
  const refreshPreferences = async (): Promise<void> => {
    try {
      const preferences = await getUserPreferences();
      setUserPreferences(preferences);
      setError(null);
    } catch (error: any) {
      console.error('Error refreshing preferences:', error);
      setError('Failed to refresh preferences');
    }
  };

  // Update just the display name (convenience method)
  const updateDisplayName = async (name: string): Promise<void> => {
    if (!userPreferences) {
      await savePreferences({ name });
    } else {
      await savePreferences({ ...userPreferences, name });
    }
  };

  // Add an updatePreferences function that simply updates the userPreferences state
  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    setUserPreferences(prev => {
      if (!prev) return newPreferences as UserPreferences;
      return { ...prev, ...newPreferences };
    });
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        userPreferences,
        preferences: userPreferences,
        isLoading,
        loading: isLoading,
        error,
        savePreferences,
        getUserPreferences,
        refreshPreferences,
        updateDisplayName,
        updatePreferences,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}; 