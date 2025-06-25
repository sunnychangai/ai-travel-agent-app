import { useReducer, useCallback, useEffect } from 'react';
import { SuggestionChip } from '../types/chat';
import { 
  INITIAL_SUGGESTIONS, 
  DESTINATION_SUGGESTIONS, 
  ITINERARY_SUGGESTIONS 
} from '../constants/chatConstants';

// Action types
type SuggestionsAction =
  | { type: 'SET_SUGGESTIONS'; suggestions: SuggestionChip[] }
  | { type: 'UPDATE_FOR_DESTINATION'; destination: string; hasItinerary: boolean }
  | { type: 'ADD_RESTORE_SUGGESTION' }
  | { type: 'REMOVE_RESTORE_SUGGESTION' }
  | { type: 'TOGGLE_COLLAPSED' }
  | { type: 'TOGGLE_STYLE' }
  | { type: 'INITIALIZE_PREFERENCES'; collapsed?: boolean; style?: 'vertical' | 'horizontal' };

// State interface
interface SuggestionsState {
  suggestions: SuggestionChip[];
  areSuggestionsCollapsed: boolean;
  suggestionsStyle: 'vertical' | 'horizontal';
}

// Initial state
const initialState: SuggestionsState = {
  suggestions: INITIAL_SUGGESTIONS,
  areSuggestionsCollapsed: false,
  suggestionsStyle: 'vertical'
};

// Reducer function
function suggestionsReducer(state: SuggestionsState, action: SuggestionsAction): SuggestionsState {
  switch (action.type) {
    case 'SET_SUGGESTIONS':
      return {
        ...state,
        suggestions: action.suggestions
      };
      
    case 'UPDATE_FOR_DESTINATION': {
      const newSuggestions = action.hasItinerary 
        ? ITINERARY_SUGGESTIONS(action.destination)
        : DESTINATION_SUGGESTIONS(action.destination);
      return {
        ...state,
        suggestions: newSuggestions
      };
    }
    
    case 'ADD_RESTORE_SUGGESTION': {
      // Check if the chip already exists
      const existingChip = state.suggestions.find(s => s.id === 'restore-previous');
      if (existingChip) {
        return state; // No change needed
      }
      
      return {
        ...state,
        suggestions: [
          ...state.suggestions,
          {
            id: 'restore-previous',
            text: 'Restore my previous itinerary'
          }
        ]
      };
    }
    
    case 'REMOVE_RESTORE_SUGGESTION':
      return {
        ...state,
        suggestions: state.suggestions.filter(s => s.id !== 'restore-previous')
      };
      
    case 'TOGGLE_COLLAPSED': {
      const newCollapsedState = !state.areSuggestionsCollapsed;
      // Store preference in localStorage
      localStorage.setItem('suggestionsCollapsed', String(newCollapsedState));
      return {
        ...state,
        areSuggestionsCollapsed: newCollapsedState
      };
    }
    
    case 'TOGGLE_STYLE': {
      const newStyle = state.suggestionsStyle === 'vertical' ? 'horizontal' : 'vertical';
      // Store preference in localStorage
      localStorage.setItem('suggestionsStyle', newStyle);
      return {
        ...state,
        suggestionsStyle: newStyle
      };
    }
    
    case 'INITIALIZE_PREFERENCES':
      return {
        ...state,
        areSuggestionsCollapsed: action.collapsed ?? state.areSuggestionsCollapsed,
        suggestionsStyle: action.style ?? state.suggestionsStyle
      };
      
    default:
      return state;
  }
}

/**
 * Hook for managing suggestion chips with persistence
 */
export function useSuggestions(
  hasPreviousItinerary: () => boolean,
  itineraryDaysLength: number
) {
  // Use reducer instead of multiple useState calls
  const [state, dispatch] = useReducer(suggestionsReducer, initialState);
  
  // Update suggestions for a destination
  const updateSuggestionsForDestination = useCallback((destination: string) => {
    dispatch({ 
      type: 'UPDATE_FOR_DESTINATION', 
      destination, 
      hasItinerary: itineraryDaysLength > 0 
    });
  }, [itineraryDaysLength]);
  
  // Add or remove "restore previous itinerary" suggestion
  useEffect(() => {
    if (hasPreviousItinerary() && !itineraryDaysLength) {
      dispatch({ type: 'ADD_RESTORE_SUGGESTION' });
    } else {
      dispatch({ type: 'REMOVE_RESTORE_SUGGESTION' });
    }
  }, [hasPreviousItinerary, itineraryDaysLength]);
  
  // Toggle suggestions visibility
  const toggleSuggestions = useCallback(() => {
    dispatch({ type: 'TOGGLE_COLLAPSED' });
  }, []);
  
  // Toggle suggestion style
  const toggleSuggestionStyle = useCallback(() => {
    dispatch({ type: 'TOGGLE_STYLE' });
  }, []);
  
  // Initialize preferences from localStorage - only run once
  useEffect(() => {
    const savedCollapsedPreference = localStorage.getItem('suggestionsCollapsed');
    const savedStylePreference = localStorage.getItem('suggestionsStyle') as 'vertical' | 'horizontal' | null;
    
    dispatch({ 
      type: 'INITIALIZE_PREFERENCES',
      collapsed: savedCollapsedPreference === 'true',
      style: savedStylePreference || undefined
    });
  }, []);
  
  // Direct setter for compatibility with existing code
  const setSuggestions = useCallback((newSuggestions: SuggestionChip[]) => {
    dispatch({ type: 'SET_SUGGESTIONS', suggestions: newSuggestions });
  }, []);
  
  return {
    suggestions: state.suggestions,
    setSuggestions,
    areSuggestionsCollapsed: state.areSuggestionsCollapsed,
    suggestionsStyle: state.suggestionsStyle,
    toggleSuggestions,
    toggleSuggestionStyle,
    updateSuggestionsForDestination
  };
}

export default useSuggestions; 