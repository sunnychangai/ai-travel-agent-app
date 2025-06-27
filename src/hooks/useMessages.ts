import { useReducer, useCallback, useEffect } from 'react';
import { UIMessage } from '../types/chat';
import { performanceConfig } from '../config/performance';
import { conversationFlowManager } from '../services/conversationFlowManager';
import { useAuth } from '../contexts/AuthContext';

// Generate unique IDs for messages
const generateId = () => Math.random().toString(36).substring(2, 15);

// Storage key for persisting messages - will be user-specific
const getMessagesStorageKey = (userId?: string) => {
  return userId ? `chat_messages_user_${userId}` : 'chat_messages_session';
};
const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent localStorage bloat

// Utility functions for localStorage persistence
const saveMessagesToStorage = (messages: UIMessage[], userId?: string) => {
  try {
    // Only store the most recent messages to prevent localStorage bloat
    const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);
    const storageKey = getMessagesStorageKey(userId);
    localStorage.setItem(storageKey, JSON.stringify(messagesToStore));
  } catch (error) {
    console.error('Error saving messages to localStorage:', error);
  }
};

// **DESTINATION VALIDATION**: Validate message context consistency
const validateMessageContextConsistency = (messages: UIMessage[], currentDestination?: string): boolean => {
  if (!currentDestination || messages.length === 0) {
    return true; // Allow if no destination context or no messages
  }
  
  // Check recent messages for destination mentions that conflict
  const recentMessages = messages.slice(-10); // Check last 10 messages
  const destinationMentions = recentMessages
    .map(msg => msg.content.toLowerCase())
    .filter(content => 
      content.includes('trip to') || 
      content.includes('visit') || 
      content.includes('itinerary for') ||
      content.includes('plan') && (content.includes('to') || content.includes('for'))
    );
  
  if (destinationMentions.length === 0) {
    return true; // No destination mentions, assume consistent
  }
  
  // Simple validation - if current destination is mentioned recently, consider consistent
  const currentDestLower = currentDestination.toLowerCase();
  const hasRecentMention = destinationMentions.some(mention => 
    mention.includes(currentDestLower) || currentDestLower.includes(mention.replace(/[^a-z\s]/g, '').trim())
  );
  
  return hasRecentMention;
};

/**
 * Load messages from localStorage with destination validation
 */
function loadMessagesFromStorage(userId?: string): UIMessage[] {
  try {
    const key = getMessagesStorageKey(userId);
    const stored = localStorage.getItem(key);
    
    if (!stored) return [];
    
    const rawMessages = JSON.parse(stored);
    
    // Ensure timestamps are Date objects
    const messages: UIMessage[] = rawMessages.map((msg: any) => ({
      ...msg,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
    }));
    
    // **DESTINATION VALIDATION**: Check conversation context consistency
    try {
      const session = conversationFlowManager.getCurrentSession();
      const conversationDestination = session?.destination;
      
      if (conversationDestination) {
        const isConsistent = validateMessageContextConsistency(messages, conversationDestination);
        
        if (!isConsistent) {
          console.log('🚨 useMessages: Message context inconsistent with conversation destination');
          console.log(`📍 Conversation: "${conversationDestination}"`);
          console.log('💬 Recent messages may be for different destination, clearing');
          
          // Clear inconsistent messages
          localStorage.removeItem(key);
          return [];
        }
      }
    } catch (validationError) {
      console.error('Error during message validation:', validationError);
      // Continue with messages even if validation fails
    }
    
    console.log(`📥 useMessages: Loaded ${messages.length} validated messages for user:`, userId);
    return messages;
  } catch (error) {
    console.error('❌ useMessages: Error loading messages from storage:', error);
    return [];
  }
}

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
  const { user } = useAuth();
  const [state, dispatch] = useReducer(messagesReducer, initialState);
  
  // Load messages from localStorage on initialization
  useEffect(() => {
    const savedMessages = loadMessagesFromStorage(user?.id);
    console.log('useMessages: Loading saved messages from localStorage:', savedMessages.length, 'for user:', user?.id);
    if (savedMessages.length > 0) {
      dispatch({ type: 'LOAD_MESSAGES', messages: savedMessages });
      console.log('useMessages: Loaded messages into state');
    }
  }, [user?.id]);

  // Save messages immediately when visibility changes (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && state.messages.length > 0) {
        console.log('useMessages: Tab hidden, ensuring messages are saved');
        saveMessagesToStorage(state.messages, user?.id);
      } else if (document.visibilityState === 'visible') {
        console.log('useMessages: Tab visible, messages should be preserved');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.messages, user?.id]);
  
  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (state.messages.length > 0) {
      console.log('useMessages: Saving', state.messages.length, 'messages to localStorage for user:', user?.id);
      saveMessagesToStorage(state.messages, user?.id);
    }
  }, [state.messages, user?.id]);
  
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
    console.log('initializeWithWelcome called with message length:', state.messages.length);
    // Only initialize with welcome if we don't have any existing messages
    if (state.messages.length === 0) {
      console.log('Adding welcome message to empty chat');
      dispatch({ type: 'INITIALIZE_WELCOME', message: welcomeMessage });
    } else {
      console.log('Skipping welcome message - messages already exist:', state.messages.length);
    }
  }, [state.messages.length]);
  
  // Clear all messages and localStorage
  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    try {
      localStorage.removeItem(getMessagesStorageKey(user?.id));
    } catch (error) {
      console.error('Error clearing messages from localStorage:', error);
    }
  }, [user?.id]);
  
  // Get the current number of stored messages for debugging/info
  const getStoredMessageCount = useCallback(() => {
    try {
      const stored = localStorage.getItem(getMessagesStorageKey(user?.id));
      return stored ? JSON.parse(stored).length : 0;
    } catch (error) {
      console.error('Error getting stored message count:', error);
      return 0;
    }
  }, [user?.id]);
  
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