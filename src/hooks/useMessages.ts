import { useReducer, useCallback, useEffect } from 'react';
import { UIMessage } from '../types/chat';
import { performanceConfig } from '../config/performance';

// Generate unique IDs for messages
const generateId = () => Math.random().toString(36).substring(2, 15);

// Storage key for persisting messages
const MESSAGES_STORAGE_KEY = 'chat_messages_session';
const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent localStorage bloat

// Utility functions for localStorage persistence
const saveMessagesToStorage = (messages: UIMessage[]) => {
  try {
    // Only store the most recent messages to prevent localStorage bloat
    const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messagesToStore));
  } catch (error) {
    console.error('Error saving messages to localStorage:', error);
  }
};

const loadMessagesFromStorage = (): UIMessage[] => {
  try {
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return parsed.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
  } catch (error) {
    console.error('Error loading messages from localStorage:', error);
  }
  return [];
};

// Define action types
type MessageAction = 
  | { type: 'ADD_USER_MESSAGE'; content: string }
  | { type: 'ADD_AI_MESSAGE'; content: string }
  | { type: 'INITIALIZE_WELCOME'; message: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'LOAD_MESSAGES'; messages: UIMessage[] };

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
    
    case 'LOAD_MESSAGES': {
      return {
        messages: action.messages,
        lastMessageId: action.messages.length > 0 ? action.messages[action.messages.length - 1].id : null
      };
    }
    
    case 'CLEAR_MESSAGES':
      return initialState;
    
    default:
      return state;
  }
}

/**
 * Hook for managing chat messages with performance optimizations and persistence
 */
export function useMessages() {
  const [state, dispatch] = useReducer(messagesReducer, initialState);
  
  // Load messages from localStorage on initialization
  useEffect(() => {
    const savedMessages = loadMessagesFromStorage();
    if (savedMessages.length > 0) {
      dispatch({ type: 'LOAD_MESSAGES', messages: savedMessages });
    }
  }, []);
  
  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (state.messages.length > 0) {
      saveMessagesToStorage(state.messages);
    }
  }, [state.messages]);
  
  // Add a user message to the chat
  const addUserMessage = useCallback((content: string): string => {
    dispatch({ type: 'ADD_USER_MESSAGE', content });
    return state.lastMessageId || '';
  }, [state.lastMessageId]);
  
  // Add an AI message to the chat
  const addAIMessage = useCallback((content: string): string => {
    dispatch({ type: 'ADD_AI_MESSAGE', content });
    return state.lastMessageId || '';
  }, [state.lastMessageId]);
  
  // Initialize with welcome message (only if no existing messages)
  const initializeWithWelcome = useCallback((welcomeMessage: string) => {
    // Only initialize with welcome if we don't have any existing messages
    if (state.messages.length === 0) {
      dispatch({ type: 'INITIALIZE_WELCOME', message: welcomeMessage });
    }
  }, [state.messages.length]);
  
  // Clear all messages and localStorage
  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    try {
      localStorage.removeItem(MESSAGES_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing messages from localStorage:', error);
    }
  }, []);
  
  // Get the current number of stored messages for debugging/info
  const getStoredMessageCount = useCallback(() => {
    try {
      const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
      return stored ? JSON.parse(stored).length : 0;
    } catch (error) {
      console.error('Error getting stored message count:', error);
      return 0;
    }
  }, []);
  
  return {
    messages: state.messages,
    addUserMessage,
    addAIMessage,
    initializeWithWelcome,
    clearMessages,
    getStoredMessageCount,
  };
}

export default useMessages; 