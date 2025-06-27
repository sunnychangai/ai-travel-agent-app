import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useItinerary } from '../../contexts/ItineraryContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { performanceConfig } from '../../config/performance';
import { ChatAgentProps } from '../../types/chat';
import ConfirmationDialog from './ConfirmationDialog';
import ChatContainer from './ChatContainer';
import ChatInputArea from '../TravelPlanner/ChatInputArea';
import { ConversationContextService } from '../../services/conversationContextService';

// Custom hooks
import useMessages from '../../hooks/useMessages';
import useSuggestions from '../../hooks/useSuggestions';
import useConversation from '../../hooks/useConversation';
import useConfirmDialog from '../../hooks/useConfirmDialog';
import { useChatMessageHandler } from './ChatMessageHandler';

/**
 * Main chat agent component for interacting with the travel planner AI
 */
export function ChatAgent({ onDestinationDetected }: ChatAgentProps) {
  // Context hooks
  const { user } = useAuth();
  const { itineraryDays, hasPreviousItinerary: contextHasPrevious } = useItinerary();
  const { preferences } = useUserPreferences();
  
  // State management hooks
  const { 
    messages, 
    addUserMessage, 
    addAIMessage, 
    initializeWithWelcome,
  } = useMessages();
  
  const {
    suggestions,
    setSuggestions,
    areSuggestionsCollapsed,
    suggestionsStyle,
    toggleSuggestions,
    toggleSuggestionStyle,
    updateSuggestionsForDestination
  } = useSuggestions(contextHasPrevious, itineraryDays.length);
  
  const {
    currentDestination,
    setCurrentDestination,
    isTyping,
    startTyping,
    stopTyping,
    error,
    setErrorMessage,
    detectDestination,
  } = useConversation();
  
  const {
    dialog,
    showConfirmation,
    showSaveOrReplaceDialog,
    hideConfirmation,
    setDialogState
  } = useConfirmDialog();

  // Initialize conversation context service
  const conversationContext = useMemo(() => new ConversationContextService(), []);

  // Message handling logic with intent recognition
  const {
    handleSendMessage,
    handleItineraryRequest,
    handleItineraryUpdate,
    handleRecommendations,
    handleQuestions,
    handleGeneralChat,
    handleRestorePreviousItinerary,
    isGenerating,
    isUpdating
  } = useChatMessageHandler({
    onDestinationDetected,
    addUserMessage,
    addAIMessage,
    detectDestination,
    setCurrentDestination,
    updateSuggestionsForDestination,
    startTyping,
    stopTyping,
    setErrorMessage,
    showConfirmation,
    showSaveOrReplaceDialog,
  });

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage = "Hi there! I'm your AI travel agent. I can help you plan your trip. Where would you like to go?";
    initializeWithWelcome(welcomeMessage);
    
    // Add the welcome message to conversation context
    conversationContext.addConversationTurn('assistant', welcomeMessage);
  }, [initializeWithWelcome, conversationContext]);

  // Compute input disabled state
  const isInputDisabled = useMemo(() => {
    return isGenerating || isUpdating || isTyping || dialog.open;
  }, [isGenerating, isUpdating, isTyping, dialog.open]);

  // Handle suggestion chip clicks
  const handleSuggestionClick = React.useCallback((suggestion: any) => {
    // Special handling for restore previous itinerary chip
    if (suggestion.id === 'restore-previous') {
      handleRestorePreviousItinerary();
      return;
    }
    
    // Process the suggestion text as if it was typed by the user
    handleSendMessage(suggestion.text);
  }, [handleSendMessage, handleRestorePreviousItinerary]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto p-2 relative flex flex-col">
        <ChatContainer 
          messages={messages}
          isTyping={isTyping}
          error={error}
        />
      </div>
      
      <div className="p-3 pb-20 md:pb-6 border-t">
        <ChatInputArea
          onSend={handleSendMessage}
          isDisabled={isInputDisabled}
          isLoading={isTyping}
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
        />
      </div>
      
      <ConfirmationDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        onOpenChange={(open) => setDialogState({ open })}
        onConfirm={dialog.onConfirm}
        onSaveCurrent={dialog.onSaveCurrent}
        confirmText={dialog.confirmText}
        saveCurrentText={dialog.saveCurrentText}
        cancelText={dialog.cancelText}
      />
    </div>
  );
}

export default React.memo(ChatAgent);