import { useReducer, useCallback } from 'react';
import { extractDestination } from '../utils/destinationUtils';

// Action types
type ConversationAction =
  | { type: 'SET_CURRENT_DESTINATION'; destination: string }
  | { type: 'START_TYPING' }
  | { type: 'STOP_TYPING' }
  | { type: 'SET_ERROR'; message: string | null };

// State interface
interface ConversationState {
  currentDestination: string;
  isTyping: boolean;
  error: string | null;
}

// Initial state
const initialState: ConversationState = {
  currentDestination: '',
  isTyping: false,
  error: null
};

// Reducer function
function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'SET_CURRENT_DESTINATION':
      return {
        ...state,
        currentDestination: action.destination
      };
      
    case 'START_TYPING':
      return {
        ...state,
        isTyping: true
      };
      
    case 'STOP_TYPING':
      return {
        ...state,
        isTyping: false
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.message
      };
      
    default:
      return state;
  }
}

/**
 * Hook for handling conversation logic in the chat agent
 */
export function useConversation() {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  
  // Extract destination from a message
  const detectDestination = useCallback((message: string, onDetected?: (destination: string) => void) => {
    const destination = extractDestination(message);
    
    if (destination) {
      dispatch({ type: 'SET_CURRENT_DESTINATION', destination });
      
      if (onDetected) {
        onDetected(destination);
      }
    }
    
    return destination;
  }, []);
  
  // Create a generic conversation response based on context
  const createConversationResponse = useCallback((
    message: string, 
    hasItinerary: boolean
  ): string => {
    if (message.toLowerCase().includes('help') || message.toLowerCase().includes('what can you do')) {
      return `I can help you plan your trip! Here are some things you can ask me:
- Create an itinerary for a destination with dates
- Add new activities to your itinerary
- Change times or details of existing activities
- Get recommendations for restaurants, attractions, or hotels
- Ask about travel tips for specific destinations
- Get information about local customs, weather, or transportation

What would you like help with?`;
    } else if (hasItinerary) {
      // We have an itinerary but the message wasn't a specific update request
      return `I see you have an itinerary already! Is there anything specific you'd like to change or add to it? Or would you like me to explain any part of it in more detail?`;
    } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      return `Hi there! I'm your AI travel agent. I can help you plan trips, create customized itineraries, and provide travel recommendations. Where would you like to go?`;
    } else {
      // Generic response encouraging itinerary creation
      return `I'm here to help you plan your perfect trip! To get started, you can tell me where you'd like to go and when. For example, you could say "Plan a trip to Paris from June 1-7, 2025" or "I want to visit Tokyo for 5 days in April 2025."`;
    }
  }, []);
  
  // Setters for state
  const setCurrentDestination = useCallback((destination: string) => {
    dispatch({ type: 'SET_CURRENT_DESTINATION', destination });
  }, []);
  
  const startTyping = useCallback(() => {
    dispatch({ type: 'START_TYPING' });
  }, []);
  
  const stopTyping = useCallback(() => {
    dispatch({ type: 'STOP_TYPING' });
  }, []);
  
  const setErrorMessage = useCallback((message: string | null) => {
    dispatch({ type: 'SET_ERROR', message });
  }, []);
  
  return {
    currentDestination: state.currentDestination,
    setCurrentDestination,
    isTyping: state.isTyping,
    startTyping,
    stopTyping,
    error: state.error,
    setErrorMessage,
    detectDestination,
    createConversationResponse
  };
}

export default useConversation; 