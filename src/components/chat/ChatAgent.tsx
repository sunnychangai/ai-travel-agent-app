import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useItinerary } from '../../contexts/ItineraryContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { performanceConfig } from '../../config/performance';
import { ChatAgentProps } from '../../types/chat';
import ConfirmationDialog from './ConfirmationDialog';
import ChatContainer from './ChatContainer';
import ChatInputArea from '../TravelPlanner/ChatInputArea';
import ConversationDebugPanel from './ConversationDebugPanel';
import { conversationFlowManager } from '../../services/conversationFlowManager';
import { useUnifiedConversationContext } from '../../hooks/useUnifiedConversationContext';
import { cn } from '../../lib/utils';

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
  const { itineraryDays, hasPreviousItinerary: contextHasPrevious, destination: itineraryDestination } = useItinerary();
  const { preferences } = useUserPreferences();
  
  // State management hooks
  const { 
    messages, 
    addUserMessage, 
    addAIMessage, 
    initializeWithWelcome,
    clearMessages,
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

  // Initialize unified conversation context
  const conversationContext = useUnifiedConversationContext();
  
  // Track if we've already synced to prevent duplicates
  const hasSyncedRef = useRef(false);
  
  // Track if conversation has been initialized to prevent duplicate welcome messages
  const isInitializedRef = useRef(false);
  const currentUserRef = useRef<string | undefined>(undefined);
  const [initTrigger, setInitTrigger] = useState(0);

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

  // Reset initialization when user changes
  useEffect(() => {
    const currentUserId = user?.id;
    const previousUserId = currentUserRef.current;
    
    if (currentUserId !== previousUserId) {
      console.log('User changed from', previousUserId, 'to', currentUserId);
      isInitializedRef.current = false;
      hasSyncedRef.current = false;
      currentUserRef.current = currentUserId;
      // Trigger initialization for the new user
      setInitTrigger(prev => prev + 1);
    }
  }, [user?.id]);

  // Trigger initial initialization on mount
  useEffect(() => {
    // Only trigger if we haven't initialized yet
    if (!isInitializedRef.current) {
      console.log('Triggering initial conversation initialization');
      setInitTrigger(prev => prev + 1);
    }
  }, []); // Run only once on mount

  // Initialize conversation session and restore context only - triggered by user changes or initial load
  useEffect(() => {
    const initializeConversation = async () => {
      // Prevent re-initialization if already done for this user
      if (isInitializedRef.current) {
        console.log('Conversation already initialized, skipping');
        return;
      }
      
      try {
        // Get existing session and conversation history
        const session = conversationFlowManager.getCurrentSession();
        const conversationHistory = conversationFlowManager.getConversationHistory();
        
        console.log('Initializing conversation...');
        console.log('Existing session:', session?.id);
        console.log('Conversation history length:', conversationHistory.length);
        console.log('Current UI messages length:', messages.length);
        console.log('Current user:', user?.id);
        
        // Check if session belongs to current user
        const sessionUserId = session?.userId;
        const currentUserId = user?.id;
        const isUserMismatch = sessionUserId && currentUserId && sessionUserId !== currentUserId;
        
        if (isUserMismatch) {
          console.log('User mismatch detected, clearing conversation history');
          conversationFlowManager.clearAllData();
          // Also clear UI messages for user switch
          clearMessages();
          // Reset flags for new user
          hasSyncedRef.current = false;
        }
        
        if (session && session.isActive && !isUserMismatch) {
          // Restore conversation context (but not messages - useMessages handles that)
          console.log('Restoring conversation session context:', session.id);
          
          // Update current destination if available
          if (session.destination) {
            setCurrentDestination(session.destination);
          }
          
          // If we have conversation history but no UI messages, restore them
          if (conversationHistory.length > 0 && messages.length === 0) {
            console.log('Restoring conversation history to UI messages immediately');
            
            conversationHistory.forEach(turn => {
              if (turn.role === 'user') {
                addUserMessage(turn.content);
              } else {
                addAIMessage(turn.content);
              }
            });
            
            // Mark as synced to prevent duplicate sync later
            hasSyncedRef.current = true;
          }
          
        } else {
          // Check current message count at the time of initialization
          const currentMessageCount = messages.length;
          
          if (currentMessageCount === 0) {
            console.log('Starting new conversation session with welcome message');
            console.log('Current message count at welcome time:', currentMessageCount);
            console.log('isInitializedRef.current:', isInitializedRef.current);
            const welcomeMessage = "Hi there! I'm your AI travel agent. I can help you plan your trip. Where would you like to go?";
            
            // Start new session with user ID
            conversationFlowManager.startSession(user?.id);
            
            // Initialize UI with welcome message (this checks for existing messages internally)
            console.log('About to call initializeWithWelcome');
            initializeWithWelcome(welcomeMessage);
            console.log('Called initializeWithWelcome');
            
            // Track welcome message in conversation flow (with delay to ensure UI message is added first)
            setTimeout(() => {
              console.log('Tracking welcome message in conversation flow');
              conversationFlowManager.trackConversationTurn('assistant', welcomeMessage);
            }, 100);
          } else {
            console.log('Existing messages found, starting session without welcome message. Message count:', currentMessageCount);
            // Just start a session without welcome message
            conversationFlowManager.startSession(user?.id);
            
            // Reset sync flag since we have existing messages to potentially sync
            hasSyncedRef.current = false;
          }
        }
        
        // Mark as initialized to prevent future runs
        isInitializedRef.current = true;
        console.log('Conversation initialization complete');
      } catch (error) {
        console.error('Error initializing conversation:', error);
      }
    };
    
    // Initialize after a small delay to ensure all hooks are ready
    const timeoutId = setTimeout(initializeConversation, 150);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [initTrigger, setCurrentDestination, initializeWithWelcome, addUserMessage, addAIMessage, clearMessages]); // Trigger on initTrigger changes

  // Sync conversation flow manager with UI messages after messages are loaded (one-time only)
  useEffect(() => {
    const syncConversationHistory = () => {
      if (hasSyncedRef.current) {
        console.log('Already synced, skipping sync');
        return;
      }
      
      const session = conversationFlowManager.getCurrentSession();
      const conversationHistory = conversationFlowManager.getConversationHistory();
      
      console.log('Secondary sync check:', {
        uiMessages: messages.length,
        conversationHistory: conversationHistory.length,
        hasSession: !!session,
        hasSynced: hasSyncedRef.current,
        isInitialized: isInitializedRef.current
      });
      
      // Only proceed if we have a valid session and haven't synced yet
      if (!session) {
        console.log('No session found, skipping sync');
        return;
      }
      
      // If already initialized, don't do secondary restore to prevent duplicates
      if (isInitializedRef.current) {
        console.log('Already initialized, skipping secondary sync to prevent duplicates');
        hasSyncedRef.current = true;
        return;
      }
      
      // Case 1: We have conversation history but no UI messages (restore from history)
      // Only do this if we haven't initialized yet
      if (conversationHistory.length > 0 && messages.length === 0) {
        console.log('Secondary restore: conversation history to UI messages');
        
        conversationHistory.forEach(turn => {
          if (turn.role === 'user') {
            addUserMessage(turn.content);
          } else {
            addAIMessage(turn.content);
          }
        });
        
        hasSyncedRef.current = true;
        return;
      }
      
      // Case 2: We have UI messages but no conversation history (sync to history)
      else if (messages.length > 0 && conversationHistory.length === 0) {
        console.log('Secondary sync: UI messages to conversation flow manager');
        
        messages.forEach(message => {
          conversationFlowManager.trackConversationTurn(
            message.sender === 'user' ? 'user' : 'assistant',
            message.content
          );
        });
        
        hasSyncedRef.current = true;
      }
      
      // Case 3: Both exist, mark as synced to prevent future attempts
      else if (conversationHistory.length > 0 && messages.length > 0) {
        console.log('Both conversation history and UI messages exist, marking as synced');
        hasSyncedRef.current = true;
      }
    };
    
    // Only run sync if we haven't initialized and haven't synced yet
    // This prevents the sync from running on tab switches
    if (!isInitializedRef.current && !hasSyncedRef.current && conversationFlowManager.getCurrentSession()) {
      console.log('Running secondary sync - not yet initialized');
      // Longer delay for secondary sync to avoid conflicts with primary restoration
      setTimeout(syncConversationHistory, 500);
    } else {
      console.log('Skipping secondary sync - already initialized:', isInitializedRef.current, 'or already synced:', hasSyncedRef.current);
    }
  }, [messages.length, addUserMessage, addAIMessage]);

  // Handle page unload and tab switching to preserve conversation state
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Update the last active time but don't end the session
      const session = conversationFlowManager.getCurrentSession();
      if (session) {
        console.log('Page unloading, updating session activity');
        // The auto-save timer in ConversationFlowManager will handle saving
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched tabs or minimized window
        console.log('Tab hidden, preserving conversation state');
      } else {
        // User returned to tab
        console.log('Tab visible again, conversation should remain stable');
        
        // Don't trigger any re-initialization - the existing state should be preserved
        // The useMessages hook and conversation flow manager already handle persistence
        console.log('Tab return - isInitialized:', isInitializedRef.current, 'hasSynced:', hasSyncedRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // No dependencies to prevent this from running multiple times

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

  // **DESTINATION SYNC**: Sync destination between conversation and itinerary contexts
  useEffect(() => {
    const session = conversationFlowManager.getCurrentSession();
    const conversationDestination = session?.destination;
    
    if (conversationDestination && !currentDestination) {
      console.log('🔄 ChatAgent: Syncing conversation destination to UI:', conversationDestination);
      setCurrentDestination(conversationDestination);
    } else if (currentDestination && (!conversationDestination || conversationDestination !== currentDestination)) {
      console.log('🔄 ChatAgent: Syncing UI destination to conversation:', currentDestination);
      conversationFlowManager.trackConversationTurn('user', `Destination context: ${currentDestination}`, undefined, { destination: currentDestination });
    }
  }, [currentDestination, setCurrentDestination]);

  // **DESTINATION SYNC**: Monitor for destination mismatches when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ ChatAgent: Tab visible, checking destination sync');
        
        const session = conversationFlowManager.getCurrentSession();
        const conversationDestination = session?.destination;
        
        // If we have both destinations but they don't match, prioritize conversation context
        if (conversationDestination && itineraryDestination && conversationDestination !== itineraryDestination) {
          console.log('🔄 ChatAgent: Destination mismatch on tab return, updating UI destination');
          console.log(`📍 Conversation: "${conversationDestination}"`);
          console.log(`🗺️ Itinerary: "${itineraryDestination}"`);
          
          setCurrentDestination(conversationDestination);
          
          // Update suggestions for the correct destination
          updateSuggestionsForDestination(conversationDestination);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [itineraryDestination, setCurrentDestination, updateSuggestionsForDestination]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white relative chat-container-mobile mobile-safari-viewport">
      {/* Messages area with bottom padding for fixed input */}
      <div className={cn(
        "flex-1 overflow-y-auto p-2 relative flex flex-col md:pb-24",
        suggestions && suggestions.length > 0 ? "messages-with-fixed-input" : "messages-no-suggestions"
      )}>
        <ChatContainer 
          messages={messages}
          isTyping={isTyping}
          error={error}
        />
      </div>
      
      {/* Fixed chat input area above tab navigation */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg z-40 fixed-chat-input md:relative md:bottom-auto md:border-t md:shadow-none md:z-auto keyboard-adjust">
        <div className="p-3 md:pb-6">
          <ChatInputArea
            onSend={handleSendMessage}
            isDisabled={isInputDisabled}
            isLoading={isTyping}
            suggestions={suggestions}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>
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
      
      {/* Debug panel for development */}
      {process.env.NODE_ENV === 'development' && <ConversationDebugPanel />}
    </div>
  );
}

export default React.memo(ChatAgent);