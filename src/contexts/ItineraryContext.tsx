/**
 * Simplified Itinerary Context
 * 
 * Replaces the complex 1777-line ItineraryContext.tsx with a simplified
 * implementation using the unified itinerary service and cache manager.
 * 
 * This maintains backward compatibility while significantly reducing complexity.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { Activity, ItineraryDay, SuggestionItem } from '../types';
import { useUnifiedItinerary, UseUnifiedItineraryReturn } from '../hooks/useUnifiedItinerary';

// Maintain the same interface as the original ItineraryContext for backward compatibility
interface ItineraryContextType extends UseUnifiedItineraryReturn {
  // Add any additional fields that the original context had
  hasPreviousItinerary: () => boolean;
}

// Create the context
const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

// Props for the provider component
interface ItineraryProviderProps {
  children: ReactNode;
  initialItinerary?: ItineraryDay[];
  initialSuggestions?: SuggestionItem[];
}

/**
 * Simplified ItineraryProvider using unified cache system
 */
export const ItineraryProvider: React.FC<ItineraryProviderProps> = ({ 
  children, 
  initialItinerary = [], 
  initialSuggestions = [] 
}) => {
  // Use refs to track initialization to prevent multiple calls
  const initializedRef = React.useRef(false);
  const suggestionsInitializedRef = React.useRef(false);
  
  // Use the unified itinerary hook to get all functionality
  const itineraryAPI = useUnifiedItinerary();
  
  // Extract stable function references to avoid useEffect issues
  const { addDay, addSuggestion, itineraryDays, suggestions } = itineraryAPI;

  // Initialize with any provided initial data - only once
  React.useEffect(() => {
    if (!initializedRef.current && initialItinerary.length > 0 && itineraryDays.length === 0) {
      console.log('🔄 SimplifiedItineraryContext: Initializing with provided itinerary data');
      initializedRef.current = true;
      const days = initialItinerary.map(day => ({ ...day }));
      days.forEach(day => addDay(day));
    }
  }, [initialItinerary.length, itineraryDays.length, addDay]);

  React.useEffect(() => {
    if (!suggestionsInitializedRef.current && initialSuggestions.length > 0 && suggestions.length === 0) {
      console.log('🔄 SimplifiedItineraryContext: Initializing with provided suggestions');
      suggestionsInitializedRef.current = true;
      initialSuggestions.forEach(suggestion => addSuggestion(suggestion));
    }
  }, [initialSuggestions.length, suggestions.length, addSuggestion]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = React.useMemo<ItineraryContextType>(() => ({
    ...itineraryAPI
  }), [
    itineraryAPI.itineraryData,
    itineraryAPI.suggestions,
    itineraryAPI.isLoading,
    itineraryAPI.currentItineraryId,
    itineraryAPI.currentItineraryTitle
  ]);

  return (
    <ItineraryContext.Provider value={contextValue}>
      {children}
    </ItineraryContext.Provider>
  );
};

/**
 * Hook to use the itinerary context
 */
export const useItinerary = () => {
  const context = useContext(ItineraryContext);
  if (context === undefined) {
    throw new Error('useItinerary must be used within an ItineraryProvider');
  }
  return context;
};

/**
 * Separate hooks for data and actions (performance optimization)
 */
export const useItineraryData = () => {
  const context = useItinerary();
  
  // Return only data-related properties
  return {
    itineraryDays: context.itineraryDays,
    sortedItineraryDays: context.sortedItineraryDays,
    suggestions: context.suggestions,
    isLoading: context.isLoading,
    currentItineraryId: context.currentItineraryId,
    currentItineraryTitle: context.currentItineraryTitle,
    destination: context.destination,
    startDate: context.startDate,
    endDate: context.endDate,
    itineraryData: context.itineraryData
  };
};

export const useItineraryActions = () => {
  const context = useItinerary();
  
  // Return only action methods
  return {
    setCurrentItineraryTitle: context.setCurrentItineraryTitle,
    getCurrentItineraryTitle: context.getCurrentItineraryTitle,
    addActivity: context.addActivity,
    updateActivity: context.updateActivity,
    deleteActivity: context.deleteActivity,
    addDay: context.addDay,
    deleteDay: context.deleteDay,
    acceptSuggestion: context.acceptSuggestion,
    rejectSuggestion: context.rejectSuggestion,
    setLoading: context.setLoading,
    saveItinerary: context.saveItinerary,
    loadItinerary: context.loadItinerary,
    getUserItineraries: context.getUserItineraries,
    deleteItinerary: context.deleteItinerary,
    clearSessionStorage: context.clearSessionStorage,
    clearItineraryDays: context.clearItineraryDays,
    finishItineraryCreation: context.finishItineraryCreation,
    savePreviousItinerary: context.savePreviousItinerary,
    restorePreviousItinerary: context.restorePreviousItinerary,
    hasPreviousItinerary: context.hasPreviousItinerary,
    forceRefresh: context.forceRefresh,
    addSuggestion: context.addSuggestion,
    removeSuggestion: context.removeSuggestion,
    getAnalytics: context.getAnalytics
  };
};

// Export everything for backward compatibility
export {
  ItineraryContext,
  type ItineraryContextType,
  type ItineraryProviderProps
}; 