/**
 * Unified Messages Hook
 * 
 * Enhanced version of useMessages that uses the unified messages service
 * instead of direct localStorage. Provides user-scoped message caching,
 * automatic invalidation, and better performance.
 */

import { useReducer, useCallback, useEffect } from 'react';
import { UIMessage } from '../types/chat';
import { performanceConfig } from '../config/performance';
import { useAuth } from '../contexts/AuthContext';
import { useCacheManager } from './useCacheManager';
import { unifiedMessagesService } from '../services/unifiedMessagesService';
import { CacheEvent } from '../services/cacheManager';

// Generate unique IDs for messages
const generateId = () => Math.random().toString(36).substring(2, 15);

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
  conversationId?: string;
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
        ...state,
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
        ...state,
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
        ...state,
        messages: [welcomeMessage],
        lastMessageId: messageId
      };
    }
    
    case 'LOAD_MESSAGES': {
      return {
        ...state,
        messages: action.messages,
        lastMessageId: action.messages.length > 0 ? action.messages[action.messages.length - 1].id : null
      };
    }
    
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        lastMessageId: null
      };
    
    default:
      return state;
  }
}

/**
 * Hook for managing chat messages with unified cache system
 */
export function useUnifiedMessages(conversationId?: string) {
  const { user } = useAuth();
  const cache = useCacheManager();
  const [state, dispatch] = useReducer(messagesReducer, { 
    ...initialState, 
    conversationId 
  });

  // Load messages from unified cache on initialization or user change
  useEffect(() => {
    const loadSavedMessages = () => {
      try {
        const savedMessages = unifiedMessagesService.loadMessages(conversationId);
        console.log('📦 useUnifiedMessages: Loading saved messages:', savedMessages.length, 'for user:', user?.id);
        
        if (savedMessages.length > 0) {
          dispatch({ type: 'LOAD_MESSAGES', messages: savedMessages });
          console.log('📦 useUnifiedMessages: Loaded messages into state');
        }
      } catch (error) {
        console.error('Error loading saved messages:', error);
      }
    };

    loadSavedMessages();
  }, [user?.id, conversationId]);

  // Auto-save messages whenever they change
  useEffect(() => {
    if (state.messages.length > 0) {
      try {
        unifiedMessagesService.saveMessages(state.messages, conversationId);
        console.log('📦 useUnifiedMessages: Auto-saved', state.messages.length, 'messages for user:', user?.id);
      } catch (error) {
        console.error('Error auto-saving messages:', error);
      }
    }
  }, [state.messages, user?.id, conversationId]);

  // Handle visibility changes (tab switching) for immediate persistence
  useEffect(() => {
    const handleVisibilityChange = () => {
      unifiedMessagesService.handleVisibilityChange(state.messages, conversationId);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.messages, conversationId]);

  // Listen for destination changes to clear inconsistent messages
  useEffect(() => {
    const handleDestinationChange = cache.addEventListener(CacheEvent.DESTINATION_CHANGE, (data: any) => {
      if (data?.destination) {
        console.log('📦 useUnifiedMessages: Destination changed to:', data.destination);
        unifiedMessagesService.onDestinationChange(data.destination, conversationId);
        
        // Reload messages after destination change (they might have been cleared)
        const remainingMessages = unifiedMessagesService.loadMessages(conversationId);
        dispatch({ type: 'LOAD_MESSAGES', messages: remainingMessages });
      }
    });

    return handleDestinationChange; // This returns the cleanup function
  }, [cache, conversationId]);

  // Add a user message to the chat
  const addUserMessage = useCallback((content: string): string => {
    const messageId = generateId();
    const userMessage: UIMessage = {
      id: messageId,
      content,
      sender: 'user',
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_USER_MESSAGE', content });
    
    // Also add to cache service directly for immediate persistence
    unifiedMessagesService.addMessage(userMessage, conversationId);
    
    return messageId;
  }, [conversationId]);
  
  // Add an AI message to the chat
  const addAIMessage = useCallback((content: string): string => {
    const messageId = generateId();
    const aiMessage: UIMessage = {
      id: messageId,
      content,
      sender: 'ai',
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_AI_MESSAGE', content });
    
    // Also add to cache service directly for immediate persistence
    unifiedMessagesService.addMessage(aiMessage, conversationId);
    
    return messageId;
  }, [conversationId]);
  
  // Initialize with welcome message (only if no existing messages)
  const initializeWithWelcome = useCallback((welcomeMessage: string) => {
    console.log('📦 useUnifiedMessages: initializeWithWelcome called with message length:', state.messages.length);
    
    // Only initialize with welcome if we don't have any existing messages
    if (state.messages.length === 0) {
      console.log('📦 useUnifiedMessages: Adding welcome message to empty chat');
      
      const messageId = generateId();
      const welcomeMsg: UIMessage = {
        id: messageId,
        content: welcomeMessage,
        sender: 'ai',
        timestamp: new Date(),
      };

      dispatch({ type: 'INITIALIZE_WELCOME', message: welcomeMessage });
      
      // Also save to cache
      unifiedMessagesService.addMessage(welcomeMsg, conversationId);
    } else {
      console.log('📦 useUnifiedMessages: Skipping welcome message - messages already exist:', state.messages.length);
    }
  }, [state.messages.length, conversationId]);
  
  // Clear all messages and cache
  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    unifiedMessagesService.clearMessages(conversationId);
    console.log('📦 useUnifiedMessages: Cleared messages for conversation:', conversationId);
  }, [conversationId]);

  // Clear all user messages (useful for logout)
  const clearAllUserMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    unifiedMessagesService.clearAllUserMessages();
    console.log('📦 useUnifiedMessages: Cleared all user messages');
  }, []);
  
  // Get the current number of stored messages for debugging/info
  const getStoredMessageCount = useCallback(() => {
    return unifiedMessagesService.getStoredMessageCount(conversationId);
  }, [conversationId]);

  // Export messages for backup
  const exportMessages = useCallback(() => {
    return unifiedMessagesService.exportMessages(conversationId);
  }, [conversationId]);

  // Import messages from backup
  const importMessages = useCallback((messages: UIMessage[]) => {
    unifiedMessagesService.importMessages(messages, conversationId);
    
    // Reload into state
    const reloadedMessages = unifiedMessagesService.loadMessages(conversationId);
    dispatch({ type: 'LOAD_MESSAGES', messages: reloadedMessages });
    
    console.log('📦 useUnifiedMessages: Imported and reloaded messages');
  }, [conversationId]);

  // Force refresh messages from cache
  const refreshMessages = useCallback(() => {
    const refreshedMessages = unifiedMessagesService.loadMessages(conversationId);
    dispatch({ type: 'LOAD_MESSAGES', messages: refreshedMessages });
    console.log('📦 useUnifiedMessages: Refreshed messages from cache');
  }, [conversationId]);

  // Get cache statistics for debugging
  const getCacheStats = useCallback(() => {
    return unifiedMessagesService.getCacheStats();
  }, []);
  
  return {
    // Core functionality
    messages: state.messages,
    addUserMessage,
    addAIMessage,
    initializeWithWelcome,
    clearMessages,
    
    // Enhanced functionality
    clearAllUserMessages,
    getStoredMessageCount,
    exportMessages,
    importMessages,
    refreshMessages,
    getCacheStats,
    
    // Conversation info
    conversationId: state.conversationId,
    messageCount: state.messages.length,
    lastMessageId: state.lastMessageId
  };
}

/**
 * Simplified version of the hook for default conversation
 */
export function useMessages() {
  return useUnifiedMessages();
}

export default useUnifiedMessages; 