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

  // Detect mobile device for better error handling
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Load user preferences from Supabase on initial render and auth state change
  useEffect(() => {
    let loadingTimeout: NodeJS.Timeout;
    let isComponentMounted = true;

    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Set a timeout for mobile devices to prevent infinite loading
        if (isMobile) {
          loadingTimeout = setTimeout(() => {
            if (isComponentMounted) {
              console.warn('Mobile preferences loading timeout - proceeding without preferences');
              setUserPreferences(null);
              setIsLoading(false);
            }
          }, 8000); // 8 second timeout for mobile
        }

        await refreshPreferences();
        
        // Clear timeout if successful
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
      } catch (error: any) {
        console.error('Error loading preferences:', error);
        
        if (isComponentMounted) {
          // Mobile-specific error handling
          if (isMobile) {
            console.warn('Mobile preferences loading failed - proceeding without preferences');
            setUserPreferences(null);
            setError(null); // Don't show error toast on mobile for preferences
          } else {
            setError('Failed to load user preferences');
            toast({
              title: "Error",
              description: "Failed to load your preferences. Please try again later.",
              variant: "destructive",
            });
          }
        }
      } finally {
        if (isComponentMounted) {
          setIsLoading(false);
        }
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
      }
    };

    // Check if user is authenticated with mobile-specific timeout
    const checkAuth = async () => {
      try {
        // Add timeout for mobile auth check
        const authPromise = supabase.auth.getSession();
        
        let timeoutPromise: Promise<never> | null = null;
        if (isMobile) {
          timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Mobile auth timeout')), 5000)
          );
        }

        const { data } = isMobile 
          ? await Promise.race([authPromise, timeoutPromise!])
          : await authPromise;

        if (isComponentMounted) {
          if (data.session) {
            await loadPreferences();
          } else {
            setUserPreferences(null);
            setIsLoading(false);
          }
        }
      } catch (error: any) {
        console.error('Auth check error:', error);
        
        if (isComponentMounted) {
          if (isMobile && error.message === 'Mobile auth timeout') {
            console.warn('Mobile auth timeout - proceeding without authentication check');
            setUserPreferences(null);
            setIsLoading(false);
          } else {
            setUserPreferences(null);
            setIsLoading(false);
          }
        }
      }
    };

    checkAuth();

    // Subscribe to auth changes with mobile-specific handling
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isComponentMounted) return;

      console.log('Auth state change:', event, 'isMobile:', isMobile);

      try {
        if (event === 'SIGNED_IN' && session) {
          // Add a small delay for mobile devices to ensure session is fully established
          if (isMobile) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (isComponentMounted) {
            await loadPreferences();
          }
        } else if (event === 'SIGNED_OUT') {
          if (isComponentMounted) {
            setUserPreferences(null);
            setIsLoading(false);
          }
        }
      } catch (error: any) {
        console.error('Auth state change error:', error);
        
        if (isComponentMounted) {
          if (isMobile) {
            // On mobile, don't block the UI if preferences fail to load
            console.warn('Mobile preferences loading failed during auth change - proceeding without preferences');
            setUserPreferences(null);
            setIsLoading(false);
          } else {
            setError('Failed to sync preferences after authentication');
          }
        }
      }
    });

    return () => {
      isComponentMounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      authListener.subscription.unsubscribe();
    };
  }, [toast, isMobile]);

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
      // Get current user with mobile timeout
      const userPromise = supabase.auth.getUser();
      
      let result;
      if (isMobile) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Mobile user fetch timeout')), 5000)
        );
        result = await Promise.race([userPromise, timeoutPromise]);
      } else {
        result = await userPromise;
      }

      const { data: { user } } = result;
      
      if (!user) {
        return null;
      }

      // Fetch preferences with mobile timeout
      const prefsPromise = supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      let prefsResult;
      if (isMobile) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Mobile preferences fetch timeout')), 5000)
        );
        prefsResult = await Promise.race([prefsPromise, timeoutPromise]);
      } else {
        prefsResult = await prefsPromise;
      }

      const { data, error } = prefsResult;

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Error fetching user preferences:', error);
      
      // On mobile, don't set error state for preferences fetch failures
      if (!isMobile) {
        setError('Failed to fetch preferences');
      }
      
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
      
      // On mobile, don't set error state for refresh failures
      if (!isMobile) {
        setError('Failed to refresh preferences');
      }
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