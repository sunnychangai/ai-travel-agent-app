import { useContext, useMemo, useCallback, useEffect } from 'react';
import { UnifiedConversationContext, ConversationContext, ConversationTurn } from '../services/unifiedConversationContext';
import { cacheManager } from '../services/cacheManager';
import { ChatIntent, IntentParameters } from '../services/intentClassificationService';
import { AuthContext } from '../contexts/AuthContext';

export interface UseUnifiedConversationContextReturn {
  // Core conversation methods
  addConversationTurn: (
    role: 'user' | 'assistant',
    content: string,
    intent?: ChatIntent,
    parameters?: IntentParameters,
    confidence?: number
  ) => string;
  
  // Context getters
  getContext: () => ConversationContext;
  getRecentHistory: (turns?: number) => ConversationTurn[];
  getRecentRecommendations: (type?: string, withinMinutes?: number) => any[];
  getMentionedPreferences: () => Record<string, { value: string; timestamp: Date }>;
  getPendingQuestions: () => string[];
  
  // State management
  setCurrentDestination: (destination: string) => void;
  setCurrentTopic: (topic: string) => void;
  updateMentionedPreferences: (preferences: Record<string, string>) => void;
  clearContext: () => void;
  
  // Context analysis
  isFollowUpQuestion: (message: string) => boolean;
  hasRecentRecommendations: (withinMinutes?: number) => boolean;
  wasRecentlyDiscussed: (topic: string, withinMinutes?: number) => boolean;
  getDominantTopic: (recentTurns?: number) => string | undefined;
  getContextualSuggestions: () => string[];
  getResponseStrategy: () => 'direct_answer' | 'clarifying_question' | 'follow_up_suggestion' | 'context_aware';
  
  // Analytics and debugging
  getAnalytics: () => any;
  
  // Current state (reactive)
  currentDestination?: string;
  currentTopic?: string;
  conversationState: any;
  isAwaitingFollowUp: boolean;
  lastIntent?: ChatIntent;
}

export function useUnifiedConversationContext(): UseUnifiedConversationContextReturn {
  const authContext = useContext(AuthContext);

  // Create the conversation context instance with cache manager
  const conversationContext = useMemo(() => {
    return new UnifiedConversationContext(cacheManager);
  }, []);

  // Clear context when user changes (additional safety)
  useEffect(() => {
    if (authContext?.user?.id) {
      // Load context for this user
      // Context will automatically be user-scoped by the cache manager
    } else {
      // Clear context when user logs out
      conversationContext.clearContext();
    }
  }, [authContext?.user?.id, conversationContext]);

  // Wrap conversation methods with useCallback for performance
  const addConversationTurn = useCallback((
    role: 'user' | 'assistant',
    content: string,
    intent?: ChatIntent,
    parameters?: IntentParameters,
    confidence?: number
  ) => {
    return conversationContext.addConversationTurn(role, content, intent, parameters, confidence);
  }, [conversationContext]);

  const getContext = useCallback(() => {
    return conversationContext.getContext();
  }, [conversationContext]);

  const getRecentHistory = useCallback((turns = 5) => {
    return conversationContext.getRecentHistory(turns);
  }, [conversationContext]);

  const getRecentRecommendations = useCallback((type?: string, withinMinutes = 30) => {
    return conversationContext.getRecentRecommendations(type, withinMinutes);
  }, [conversationContext]);

  const getMentionedPreferences = useCallback(() => {
    return conversationContext.getMentionedPreferences();
  }, [conversationContext]);

  const getPendingQuestions = useCallback(() => {
    return conversationContext.getPendingQuestions();
  }, [conversationContext]);

  const setCurrentDestination = useCallback((destination: string) => {
    conversationContext.setCurrentDestination(destination);
  }, [conversationContext]);

  const setCurrentTopic = useCallback((topic: string) => {
    conversationContext.setCurrentTopic(topic);
  }, [conversationContext]);

  const updateMentionedPreferences = useCallback((preferences: Record<string, string>) => {
    conversationContext.updateMentionedPreferences(preferences);
  }, [conversationContext]);

  const clearContext = useCallback(() => {
    conversationContext.clearContext();
  }, [conversationContext]);

  const isFollowUpQuestion = useCallback((message: string) => {
    return conversationContext.isFollowUpQuestion(message);
  }, [conversationContext]);

  const hasRecentRecommendations = useCallback((withinMinutes = 10) => {
    return conversationContext.hasRecentRecommendations(withinMinutes);
  }, [conversationContext]);

  const wasRecentlyDiscussed = useCallback((topic: string, withinMinutes = 30) => {
    return conversationContext.wasRecentlyDiscussed(topic, withinMinutes);
  }, [conversationContext]);

  const getDominantTopic = useCallback((recentTurns = 5) => {
    return conversationContext.getDominantTopic(recentTurns);
  }, [conversationContext]);

  const getContextualSuggestions = useCallback(() => {
    return conversationContext.getContextualSuggestions();
  }, [conversationContext]);

  const getResponseStrategy = useCallback(() => {
    return conversationContext.getResponseStrategy();
  }, [conversationContext]);

  const getAnalytics = useCallback(() => {
    return conversationContext.getAnalytics();
  }, [conversationContext]);

  // Get current state for reactive updates
  const currentContext = getContext();

  return {
    // Methods
    addConversationTurn,
    getContext,
    getRecentHistory,
    getRecentRecommendations,
    getMentionedPreferences,
    getPendingQuestions,
    setCurrentDestination,
    setCurrentTopic,
    updateMentionedPreferences,
    clearContext,
    isFollowUpQuestion,
    hasRecentRecommendations,
    wasRecentlyDiscussed,
    getDominantTopic,
    getContextualSuggestions,
    getResponseStrategy,
    getAnalytics,
    
    // Current state (reactive)
    currentDestination: currentContext.currentDestination,
    currentTopic: currentContext.currentTopic,
    conversationState: currentContext.state,
    isAwaitingFollowUp: currentContext.state.awaitingFollowUp,
    lastIntent: currentContext.lastIntent,
  };
}

// Additional helper hooks for specific use cases

/**
 * Hook for getting conversation suggestions based on current context
 */
export function useConversationSuggestions() {
  const { getContextualSuggestions, conversationState } = useUnifiedConversationContext();
  
  return useMemo(() => {
    return getContextualSuggestions();
  }, [getContextualSuggestions, conversationState]);
}

/**
 * Hook for tracking conversation flow state
 */
export function useConversationFlow() {
  const { conversationState, getRecentHistory } = useUnifiedConversationContext();
  
  return useMemo(() => {
    const recentHistory = getRecentHistory(5);
    
    return {
      phase: conversationState.phase,
      activeLocation: conversationState.activeLocation,
      activeRecommendationType: conversationState.activeRecommendationType,
      isAwaitingFollowUp: conversationState.awaitingFollowUp,
      conversationFlow: conversationState.conversationFlow,
      recentTurns: recentHistory.length,
      lastUserIntent: recentHistory.filter(t => t.role === 'user').pop()?.intent,
    };
  }, [conversationState, getRecentHistory]);
}

/**
 * Hook for recommendation context
 */
export function useRecommendationContext() {
  const { 
    getRecentRecommendations, 
    hasRecentRecommendations, 
    conversationState 
  } = useUnifiedConversationContext();
  
  return useMemo(() => {
    const recentRecommendations = getRecentRecommendations();
    const hasRecent = hasRecentRecommendations();
    
    return {
      recentRecommendations,
      hasRecentRecommendations: hasRecent,
      activeRecommendationType: conversationState.activeRecommendationType,
      lastRecommendationTimestamp: conversationState.lastRecommendationTimestamp,
      recommendationCount: recentRecommendations.length,
    };
  }, [getRecentRecommendations, hasRecentRecommendations, conversationState]);
} 