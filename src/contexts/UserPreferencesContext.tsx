import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '../components/ui/use-toast';
import { unifiedUserPreferencesService } from '../services/unifiedUserPreferencesService';
import { UserPreferences } from '../components/TravelPlanner/EnhancedItineraryCreator';

// Define the context type
interface UserPreferencesContextType {
  userPreferences: UserPreferences | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  savePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  getUserPreferences: () => Promise<UserPreferences | null>;
  refreshPreferences: () => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
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

  // Load user preferences using unified service
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('📦 UserPreferencesContext: Loading preferences via unified service');
        
        // Use the unified service to load preferences
        const preferences = await unifiedUserPreferencesService.getPreferencesWithFallback();
        setUserPreferences(preferences);
        
        console.log('📦 UserPreferencesContext: Loaded preferences:', preferences);
      } catch (error) {
        console.error('Error loading preferences:', error);
        setError('Failed to load user preferences');
        toast({
          title: "Error",
          description: "Failed to load your preferences. Using defaults.",
          variant: "destructive",
        });
        
        // Fallback to defaults on error
        const defaultPrefs = await unifiedUserPreferencesService.getPreferencesWithFallback();
        setUserPreferences(defaultPrefs);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [toast]);

  // Save/Update user preferences using unified service
  const savePreferences = async (preferences: Partial<UserPreferences>): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📦 UserPreferencesContext: Saving preferences:', preferences);
      
      // Update preferences using unified service
      const updated = await unifiedUserPreferencesService.updatePreferences(preferences);
      
      if (updated) {
        setUserPreferences(updated);
        toast({
          title: "Success",
          description: "Your preferences have been saved.",
        });
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (error) {
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

  // Get current user preferences using unified service
  const getUserPreferences = async (): Promise<UserPreferences | null> => {
    try {
      console.log('📦 UserPreferencesContext: Getting current preferences');
      return await unifiedUserPreferencesService.loadPreferences();
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      setError('Failed to fetch preferences');
      return null;
    }
  };

  // Refresh user preferences data
  const refreshPreferences = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📦 UserPreferencesContext: Refreshing preferences');
      
      // Force refresh from Supabase
      const preferences = await unifiedUserPreferencesService.refreshFromSupabase();
      
      if (preferences) {
        setUserPreferences(preferences);
      } else {
        // Fallback to defaults if refresh fails
        const defaultPrefs = await unifiedUserPreferencesService.getPreferencesWithFallback();
        setUserPreferences(defaultPrefs);
      }
      
      setError(null);
    } catch (error) {
      console.error('Error refreshing preferences:', error);
      setError('Failed to refresh preferences');
    } finally {
      setIsLoading(false);
    }
  };

  // Update preferences in local state only (for optimistic updates)
  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    console.log('📦 UserPreferencesContext: Updating local preferences state');
    setUserPreferences(prev => {
      if (!prev) {
        // If no previous preferences, create defaults and merge
        const defaults: UserPreferences = {
          travelStyle: 'cultural',
          interests: [],
          travelGroup: 'couple',
          budget: 'mid-range',
          transportMode: 'walking',
          dietaryPreferences: [],
          pace: 'moderate',
          lastUpdated: Date.now()
        };
        return { ...defaults, ...newPreferences };
      }
      return { ...prev, ...newPreferences, lastUpdated: Date.now() };
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
        updatePreferences,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}; 