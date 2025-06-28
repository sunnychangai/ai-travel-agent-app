import { useReducer, useCallback, useEffect, useRef } from 'react';
import { UIMessage } from '../types/chat';
import { performanceConfig } from '../config/performance';
import { conversationFlowManager } from '../services/conversationFlowManager';
import { useAuth } from '../contexts/AuthContext';

// Generate unique IDs for messages
const generateId = () => Math.random().toString(36).substring(2, 15);

// **MOBILE SAFARI FIX**: In-memory backup for final fallback
let inMemoryBackup: { [key: string]: UIMessage[] } = {};

// **MOBILE SAFARI DETECTION**: Detect if we're running on mobile Safari
const isMobileSafari = () => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
};

// Storage key for persisting messages - will be user-specific
const getMessagesStorageKey = (userId?: string) => {
  return userId ? `chat_messages_user_${userId}` : 'chat_messages_session';
};
const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent localStorage bloat

// **MOBILE SAFARI FIX**: Enhanced storage with multiple fallbacks
const persistToAllStorages = (key: string, data: UIMessage[]) => {
  const jsonData = JSON.stringify(data);
  
  // **FINAL FALLBACK**: Always store in memory first
  inMemoryBackup[key] = [...data];
  
  try {
    // Primary: localStorage
    localStorage.setItem(key, jsonData);
  } catch (e) {
    console.warn('localStorage failed on mobile:', e);
  }
  
  try {
    // Fallback 1: sessionStorage (survives page refresh but not tab close)
    sessionStorage.setItem(key + '_session', jsonData);
  } catch (e) {
    console.warn('sessionStorage failed on mobile:', e);
  }
  
  try {
    // Fallback 2: IndexedDB for mobile Safari (more reliable)
    if ('indexedDB' in window) {
      const request = indexedDB.open('ChatHistory', 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'key' });
        }
      };
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        store.put({ key, data: jsonData, timestamp: Date.now() });
      };
    }
  } catch (e) {
    console.warn('IndexedDB failed on mobile:', e);
  }
};

// **MOBILE SAFARI FIX**: Enhanced loading with multiple fallbacks
const loadFromAllStorages = (key: string): UIMessage[] => {
  let data: string | null = null;
  
  // Try localStorage first
  try {
    data = localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage read failed on mobile:', e);
  }
  
  // Fallback to sessionStorage
  if (!data) {
    try {
      data = sessionStorage.getItem(key + '_session');
    } catch (e) {
      console.warn('sessionStorage read failed on mobile:', e);
    }
  }
  
  // Parse and return if found
  if (data) {
    try {
      const rawMessages = JSON.parse(data);
      return rawMessages.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }));
    } catch (e) {
      console.error('Failed to parse stored messages:', e);
    }
  }
  
  // **FINAL FALLBACK**: Check in-memory backup
  if (inMemoryBackup[key]) {
    console.log('📱 Using in-memory backup for messages');
    return [...inMemoryBackup[key]];
  }
  
  return [];
};

// Utility functions for localStorage persistence with mobile Safari fixes
const saveMessagesToStorage = (messages: UIMessage[], userId?: string) => {
  try {
    // Only store the most recent messages to prevent localStorage bloat
    const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);
    const storageKey = getMessagesStorageKey(userId);
    
    // **MOBILE SAFARI FIX**: Use enhanced persistence
    persistToAllStorages(storageKey, messagesToStore);
    
    console.log(`💾 Saved ${messagesToStore.length} messages to multiple storages for mobile reliability`);
  } catch (error) {
    console.error('Error saving messages to storage:', error);
  }
};

/**
 * Load messages from localStorage with destination validation
 */
function loadMessagesFromStorage(userId?: string): UIMessage[] {
  try {
    const key = getMessagesStorageKey(userId);
    
    // **MOBILE SAFARI FIX**: Use enhanced loading from multiple storages
    const messages = loadFromAllStorages(key);
    
    if (messages.length === 0) {
      console.log('📱 No messages found in any storage layer');
      return [];
    }
    
    // **MOBILE FIX**: Simplified validation to prevent overly aggressive clearing
    try {
      const session = conversationFlowManager.getCurrentSession();
      const conversationDestination = session?.destination;
      
      // Only clear if there's a clear mismatch (much less aggressive)
      if (conversationDestination && messages.length > 5) {
        const recentMessages = messages.slice(-3); // Only check last 3 messages
        const hasDestinationConflict = recentMessages.some(msg => {
          const content = msg.content.toLowerCase();
          const dest = conversationDestination.toLowerCase();
          // Only flag clear conflicts (not minor variations)
          return content.includes('trip to') && !content.includes(dest) && 
                 content.split(' ').some(word => word.length > 3 && !dest.includes(word));
        });
        
        if (hasDestinationConflict) {
          console.log('🚨 Clear destination conflict detected, clearing messages');
          return [];
        }
      }
    } catch (validationError) {
      console.warn('Validation error, continuing with messages:', validationError);
      // Continue with messages even if validation fails
    }
    
    console.log(`📥 Loaded ${messages.length} messages for user:`, userId);
    return messages;
  } catch (error) {
    console.error('❌ Error loading messages from storage:', error);
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
 * Hook for managing chat messages with performance optimizations and mobile-enhanced persistence
 */
export function useMessages() {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(messagesReducer, initialState);
  const lastSavedRef = useRef<string>('');
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // **MOBILE SAFARI FIX**: Immediate persistence helper
  const persistMessagesImmediately = useCallback((messages: UIMessage[]) => {
    if (messages.length > 0) {
      const messagesHash = JSON.stringify(messages.map(m => m.id + m.content)).slice(0, 50);
      
      // Only save if messages actually changed (prevent excessive saves)
      if (messagesHash !== lastSavedRef.current) {
        saveMessagesToStorage(messages, user?.id);
        lastSavedRef.current = messagesHash;
        console.log('💾 Immediate persistence triggered for mobile reliability');
      }
    }
  }, [user?.id]);
  
  // Load messages from localStorage on initialization
  useEffect(() => {
    const savedMessages = loadMessagesFromStorage(user?.id);
    console.log('useMessages: Loading saved messages from storage:', savedMessages.length, 'for user:', user?.id);
    if (savedMessages.length > 0) {
      dispatch({ type: 'LOAD_MESSAGES', messages: savedMessages });
      console.log('useMessages: Loaded messages into state');
    }
  }, [user?.id]);

  // **MOBILE SAFARI FIX**: Enhanced event handlers for mobile persistence
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && state.messages.length > 0) {
        console.log('📱 Tab/app hidden, immediate save for mobile');
        persistMessagesImmediately(state.messages);
      } else if (document.visibilityState === 'visible') {
        console.log('📱 Tab/app visible, messages preserved');
      }
    };

    const handleBeforeUnload = () => {
      console.log('📱 Page unloading, final save attempt');
      persistMessagesImmediately(state.messages);
    };

    const handlePageHide = () => {
      console.log('📱 Page hide event, mobile save');
      persistMessagesImmediately(state.messages);
    };

    const handleFreeze = () => {
      console.log('📱 Page freeze event, mobile save');
      persistMessagesImmediately(state.messages);
    };

    // Standard events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Mobile-specific events
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('freeze', handleFreeze);
    
    // Focus/blur for additional safety
    window.addEventListener('blur', () => persistMessagesImmediately(state.messages));

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('freeze', handleFreeze);
      window.removeEventListener('blur', () => persistMessagesImmediately(state.messages));
    };
  }, [state.messages, persistMessagesImmediately]);
  
  // **MOBILE SAFARI FIX**: Periodic auto-save for extra reliability
  useEffect(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }
    
    if (state.messages.length > 0) {
      // More aggressive saving on mobile Safari
      const saveInterval = isMobileSafari() ? 5000 : 10000; // 5s for Safari, 10s for others
      
      autoSaveIntervalRef.current = setInterval(() => {
        persistMessagesImmediately(state.messages);
      }, saveInterval);
      
      console.log(`📱 Auto-save enabled every ${saveInterval/1000}s for ${isMobileSafari() ? 'mobile Safari' : 'other browsers'}`);
    }
    
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [state.messages, persistMessagesImmediately]);
  
  // **MOBILE SAFARI FIX**: Immediate save on every message change
  useEffect(() => {
    if (state.messages.length > 0) {
      persistMessagesImmediately(state.messages);
    }
  }, [state.messages, persistMessagesImmediately]);
  
  // Add a user message to the chat
  const addUserMessage = useCallback((content: string): string => {
    dispatch({ type: 'ADD_USER_MESSAGE', content });
    // Messages will be auto-saved by the effect above
    return state.lastMessageId || '';
  }, [state.lastMessageId]);
  
  // Add an AI message to the chat
  const addAIMessage = useCallback((content: string): string => {
    dispatch({ type: 'ADD_AI_MESSAGE', content });
    // Messages will be auto-saved by the effect above
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
  
  // **MOBILE SAFARI FIX**: Enhanced clear with multi-storage cleanup
  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
    
    // Clear from all storage layers
    const storageKey = getMessagesStorageKey(user?.id);
    
    // Clear in-memory backup first
    delete inMemoryBackup[storageKey];
    
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey + '_session');
      
      // Clear IndexedDB
      if ('indexedDB' in window) {
        const request = indexedDB.open('ChatHistory', 1);
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (db.objectStoreNames.contains('messages')) {
            const transaction = db.transaction(['messages'], 'readwrite');
            const store = transaction.objectStore('messages');
            store.delete(storageKey);
          }
        };
      }
      
      console.log('📱 Cleared messages from all storage layers');
    } catch (error) {
      console.error('Error clearing messages from storage:', error);
    }
  }, [user?.id]);
  
  // Get the current number of stored messages for debugging/info
  const getStoredMessageCount = useCallback(() => {
    try {
      const messages = loadFromAllStorages(getMessagesStorageKey(user?.id));
      return messages.length;
    } catch (error) {
      console.error('Error getting stored message count:', error);
      return 0;
    }
  }, [user?.id]);
  
  // **MOBILE DEBUG**: Get storage status for debugging mobile issues
  const getStorageStatus = useCallback(() => {
    const storageKey = getMessagesStorageKey(user?.id);
    return {
      isMobileSafari: isMobileSafari(),
      localStorage: !!localStorage.getItem(storageKey),
      sessionStorage: !!sessionStorage.getItem(storageKey + '_session'),
      inMemory: !!inMemoryBackup[storageKey],
      messageCount: state.messages.length,
      storageKey
    };
  }, [user?.id, state.messages.length]);
  
  return {
    messages: state.messages,
    addUserMessage,
    addAIMessage,
    initializeWithWelcome,
    clearMessages,
    getStoredMessageCount,
    getStorageStatus, // For debugging mobile issues
  };
}

export default useMessages; 