import { useReducer, useCallback } from 'react';
import { UIMessage } from '../types/chat';
import { performanceConfig } from '../config/performance';

// Generate unique IDs for messages
const generateId = () => Math.random().toString(36).substring(2, 15);

// Define action types
type MessageAction = 
  | { type: 'ADD_USER_MESSAGE'; content: string }
  | { type: 'ADD_AI_MESSAGE'; content: string }
  | { type: 'INITIALIZE_WELCOME'; message: string }
  | { type: 'CLEAR_MESSAGES' };

// Define the state type
interface MessagesState {
  messages: UIMessage[];
  lastMessageId: string | null;
}

// Create initial state
const initialState: MessagesState = {
  messages: [],
  lastMessageId: null
};

// Create a reducer function to handle all state changes
function messagesReducer(state: MessagesState, action: MessageAction): MessagesState {
  const maxVisible = performanceConfig.ui.maxVisibleMessages;
  
  switch (action.type) {
    case 'ADD_USER_MESSAGE': {
      const messageId = generateId();
      const userMessage: UIMessage = {
        id: messageId,
        content: action.content,
        sender: 'user',
        timestamp: new Date(),
      };
      
      // Calculate updated messages with limit
      let updatedMessages = [...state.messages, userMessage];
      if (updatedMessages.length > maxVisible) {
        updatedMessages = updatedMessages.slice(-maxVisible);
      }
      
      return {
        messages: updatedMessages,
        lastMessageId: messageId
      };
    }
    
    case 'ADD_AI_MESSAGE': {
      const messageId = generateId();
      const aiMessage: UIMessage = {
        id: messageId,
        content: action.content,
        sender: 'ai',
        timestamp: new Date(),
      };
      
      // Calculate updated messages with limit
      let updatedMessages = [...state.messages, aiMessage];
      if (updatedMessages.length > maxVisible) {
        updatedMessages = updatedMessages.slice(-maxVisible);
      }
      
      return {
        messages: updatedMessages,
        lastMessageId: messageId
      };
    }
    
    case 'INITIALIZE_WELCOME': {
      const messageId = generateId();
      const welcomeMessage: UIMessage = {
        id: messageId,
        content: action.message,
        sender: 'ai',
        timestamp: new Date(),
      };
      
      return {
        messages: [welcomeMessage],
        lastMessageId: messageId
      };
    }
    
    case 'CLEAR_MESSAGES':
      return initialState;
    
    default:
      return state;
  }
}

/**
 * Hook for managing chat messages with performance optimizations
 */
export function useMessages() {
  const [state, dispatch] = useReducer(messagesReducer, initialState);
  
  // Add a user message to the chat
  const addUserMessage = useCallback((content: string): string => {
    dispatch({ type: 'ADD_USER_MESSAGE', content });
    return state.lastMessageId || '';
  }, []);
  
  // Add an AI message to the chat
  const addAIMessage = useCallback((content: string): string => {
    dispatch({ type: 'ADD_AI_MESSAGE', content });
    return state.lastMessageId || '';
  }, []);
  
  // Initialize with welcome message
  const initializeWithWelcome = useCallback((welcomeMessage: string) => {
    dispatch({ type: 'INITIALIZE_WELCOME', message: welcomeMessage });
  }, []);
  
  // Clear all messages
  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);
  
  return {
    messages: state.messages,
    addUserMessage,
    addAIMessage,
    initializeWithWelcome,
    clearMessages,
  };
}

export default useMessages; 