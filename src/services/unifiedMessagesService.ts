/**
 * Unified Messages Service
 * 
 * Enhanced version of message persistence that uses the unified cache manager
 * instead of direct localStorage. Provides user-scoped message caching,
 * automatic invalidation, and better performance.
 */

import { UIMessage } from '../types/chat';
import { performanceConfig } from '../config/performance';
import { conversationFlowManager } from './conversationFlowManager';
import { cacheUtils, CacheEvent } from './cacheManager';

// Cache namespace for messages
const CACHE_NAMESPACE = 'user-messages';

// Constants
const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent cache bloat
const MESSAGE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Initialize cache namespace
const initializeMessageCache = () => {
  cacheUtils.registerCache({
    namespace: CACHE_NAMESPACE,
    ttl: MESSAGE_CACHE_TTL,
    maxSize: 200, // Allow storing multiple conversation histories
    persistence: true,
    userScoped: true // Messages are user-scoped!
  });
};

// Initialize when module loads
initializeMessageCache();

/**
 * Generate cache key for user messages
 */
const getMessagesCacheKey = (conversationId?: string) => {
  return conversationId ? `conversation_${conversationId}` : 'default_conversation';
};

/**
 * Validate message context consistency
 */
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

export const unifiedMessagesService = {
  /**
   * Load messages from cache with destination validation
   */
  loadMessages(conversationId?: string): UIMessage[] {
    try {
      const cacheKey = getMessagesCacheKey(conversationId);
      const cachedMessages = cacheUtils.get<UIMessage[]>(CACHE_NAMESPACE, cacheKey);
      
      if (!cachedMessages) {
        console.log('📦 UnifiedMessages: No cached messages found for conversation:', conversationId);
        return [];
      }
      
      // Ensure timestamps are Date objects
      const messages: UIMessage[] = cachedMessages.map((msg: any) => ({
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
            console.log('🚨 UnifiedMessages: Message context inconsistent with conversation destination');
            console.log(`📍 Conversation: "${conversationDestination}"`);
            console.log('💬 Recent messages may be for different destination, clearing');
            
            // Clear inconsistent messages
            this.clearMessages(conversationId);
            return [];
          }
        }
      } catch (validationError) {
        console.error('Error during message validation:', validationError);
        // Continue with messages even if validation fails
      }
      
      console.log(`📦 UnifiedMessages: Loaded ${messages.length} validated messages for conversation:`, conversationId);
      return messages;
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error loading messages from cache:', error);
      return [];
    }
  },

  /**
   * Save messages to cache with user scoping
   */
  saveMessages(messages: UIMessage[], conversationId?: string): void {
    try {
      if (!messages || messages.length === 0) {
        return;
      }

      // Only store the most recent messages to prevent cache bloat
      const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);
      const cacheKey = getMessagesCacheKey(conversationId);
      
      cacheUtils.set(
        CACHE_NAMESPACE,
        cacheKey,
        messagesToStore,
        MESSAGE_CACHE_TTL
      );
      
      console.log(`📦 UnifiedMessages: Saved ${messagesToStore.length} messages for conversation:`, conversationId);
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error saving messages to cache:', error);
    }
  },

  /**
   * Add a single message to cache
   */
  addMessage(message: UIMessage, conversationId?: string): void {
    try {
      const existingMessages = this.loadMessages(conversationId);
      const updatedMessages = [...existingMessages, message];
      
      // Apply message limit
      const maxVisible = performanceConfig.ui.maxVisibleMessages;
      const messagesToSave = updatedMessages.length > maxVisible 
        ? updatedMessages.slice(-maxVisible)
        : updatedMessages;
      
      this.saveMessages(messagesToSave, conversationId);
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error adding message:', error);
    }
  },

  /**
   * Clear messages for a conversation
   */
  clearMessages(conversationId?: string): void {
    try {
      const cacheKey = getMessagesCacheKey(conversationId);
      cacheUtils.delete(CACHE_NAMESPACE, cacheKey);
      
      console.log('📦 UnifiedMessages: Cleared messages for conversation:', conversationId);
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error clearing messages:', error);
    }
  },

  /**
   * Clear all user messages (useful for logout)
   */
  clearAllUserMessages(): void {
    try {
      cacheUtils.clear(CACHE_NAMESPACE);
      console.log('📦 UnifiedMessages: Cleared all user messages');
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error clearing all messages:', error);
    }
  },

  /**
   * Get stored message count for debugging
   */
  getStoredMessageCount(conversationId?: string): number {
    try {
      const messages = this.loadMessages(conversationId);
      return messages.length;
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error getting stored message count:', error);
      return 0;
    }
  },

  /**
   * Handle destination change event
   * Clears messages if destination changes to prevent context conflicts
   */
  onDestinationChange(newDestination: string, conversationId?: string): void {
    try {
      const existingMessages = this.loadMessages(conversationId);
      
      if (existingMessages.length > 0) {
        const isConsistent = validateMessageContextConsistency(existingMessages, newDestination);
        
        if (!isConsistent) {
          console.log('🚨 UnifiedMessages: Destination changed, clearing inconsistent messages');
          console.log(`📍 New destination: "${newDestination}"`);
          this.clearMessages(conversationId);
          
          // Emit conversation reset to trigger other invalidations
          cacheUtils.emitConversationReset();
        }
      }
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error handling destination change:', error);
    }
  },

  /**
   * Handle visibility change (tab switching)
   * Ensures messages are immediately persisted when user switches tabs
   */
  handleVisibilityChange(messages: UIMessage[], conversationId?: string): void {
    if (document.visibilityState === 'hidden' && messages.length > 0) {
      console.log('📦 UnifiedMessages: Tab hidden, ensuring messages are cached');
      this.saveMessages(messages, conversationId);
    } else if (document.visibilityState === 'visible') {
      console.log('📦 UnifiedMessages: Tab visible, messages should be preserved');
    }
  },

  /**
   * Get cache analytics for debugging
   */
  getCacheStats() {
    return cacheUtils.getAnalytics(CACHE_NAMESPACE);
  },

  /**
   * Export messages for backup or migration
   */
  exportMessages(conversationId?: string): UIMessage[] {
    return this.loadMessages(conversationId);
  },

  /**
   * Import messages from backup
   */
  importMessages(messages: UIMessage[], conversationId?: string): void {
    try {
      // Validate imported messages
      const validMessages = messages.filter(msg => 
        msg.id && msg.content && msg.sender && msg.timestamp
      );
      
      if (validMessages.length !== messages.length) {
        console.warn(`📦 UnifiedMessages: Filtered out ${messages.length - validMessages.length} invalid messages during import`);
      }
      
      this.saveMessages(validMessages, conversationId);
      console.log(`📦 UnifiedMessages: Imported ${validMessages.length} messages for conversation:`, conversationId);
      
    } catch (error) {
      console.error('❌ UnifiedMessages: Error importing messages:', error);
    }
  }
};

export default unifiedMessagesService; 