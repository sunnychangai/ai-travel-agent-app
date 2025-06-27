import { useState, useEffect, useCallback } from 'react';
import { conversationFlowManager, ConversationSession, ConversationAnalytics } from '../services/conversationFlowManager';
import { ConversationTurn } from '../services/unifiedConversationContext';
import { ChatIntent, IntentParameters } from '../services/intentClassificationService';

export interface ConversationFlowState {
  currentSession: ConversationSession | null;
  analytics: ConversationAnalytics;
  conversationHistory: ConversationTurn[];
  isSessionActive: boolean;
  contextualSuggestions: string[];
}

export function useConversationFlow(userId?: string) {
  const [state, setState] = useState<ConversationFlowState>({
    currentSession: null,
    analytics: conversationFlowManager.getAnalytics(),
    conversationHistory: [],
    isSessionActive: false,
    contextualSuggestions: []
  });

  // Update state from conversation flow manager
  const updateState = useCallback(() => {
    const currentSession = conversationFlowManager.getCurrentSession();
    const analytics = conversationFlowManager.getAnalytics();
    const conversationHistory = conversationFlowManager.getConversationHistory();
    const isSessionActive = currentSession?.isActive || false;
    const contextualSuggestions = conversationFlowManager.getContextualSuggestions();

    setState({
      currentSession,
      analytics,
      conversationHistory,
      isSessionActive,
      contextualSuggestions
    });
  }, []);

  // Initialize conversation session
  useEffect(() => {
    const session = conversationFlowManager.getCurrentSession();
    if (!session || !session.isActive) {
      conversationFlowManager.startSession(userId);
    }
    updateState();
  }, [userId, updateState]);

  // Update state periodically
  useEffect(() => {
    const interval = setInterval(updateState, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [updateState]);

  // Track conversation turn
  const trackConversationTurn = useCallback((
    role: 'user' | 'assistant',
    content: string,
    intent?: ChatIntent,
    parameters?: IntentParameters,
    confidence?: number
  ) => {
    conversationFlowManager.trackConversationTurn(role, content, intent, parameters, confidence);
    updateState();
  }, [updateState]);

  // Start new session
  const startNewSession = useCallback((destination?: string) => {
    conversationFlowManager.startSession(userId, destination);
    updateState();
  }, [userId, updateState]);

  // End current session
  const endSession = useCallback(() => {
    conversationFlowManager.endSession();
    updateState();
  }, [updateState]);

  // Check if message is a follow-up
  const isFollowUpQuestion = useCallback((message: string) => {
    return conversationFlowManager.isFollowUpQuestion(message);
  }, []);

  // Get contextual suggestions
  const getContextualSuggestions = useCallback(() => {
    return conversationFlowManager.getContextualSuggestions();
  }, []);

  // Export conversation data
  const exportConversationData = useCallback(() => {
    return conversationFlowManager.exportConversationData();
  }, []);

  // Clear all conversation data
  const clearAllData = useCallback(() => {
    conversationFlowManager.clearAllData();
    updateState();
  }, [updateState]);

  return {
    // State
    ...state,
    
    // Actions
    trackConversationTurn,
    startNewSession,
    endSession,
    isFollowUpQuestion,
    getContextualSuggestions,
    exportConversationData,
    clearAllData,
    updateState
  };
}

export default useConversationFlow; 