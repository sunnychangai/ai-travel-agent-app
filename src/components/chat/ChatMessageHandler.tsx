import { useCallback } from 'react';
import { useAgentItinerary } from '../../hooks/useAgentItinerary';
import { useItinerary } from '../../contexts/ItineraryContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { performanceConfig } from '../../config/performance';
import { intentClassificationService } from '../../services/intentClassificationService';
import { promptTemplateService } from '../../services/promptTemplateService';
import { ConversationContextService } from '../../services/conversationContextService';
import { ChatIntent } from '../../services/intentClassificationService';
import { openaiService } from '../../services/openaiService';

type ChatMessageHandlerProps = {
  onDestinationDetected?: (destination: string) => void;
  addUserMessage: (content: string) => string;
  addAIMessage: (content: string) => string;
  detectDestination: (message: string, onDetected?: (destination: string) => void) => string | null;
  setCurrentDestination: (destination: string) => void;
  updateSuggestionsForDestination: (destination: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  setErrorMessage: (message: string | null) => void;
  showConfirmation: (title: string, description: string, onConfirm: () => void) => Promise<void>;
  showSaveOrReplaceDialog: (
    title: string,
    description: string,
    onContinue: () => void,
    onSaveCurrent: () => void,
    options?: {
      continueText?: string;
      saveCurrentText?: string;
      cancelText?: string;
    }
  ) => Promise<void>;
};

/**
 * Hook that contains message handling logic with intent recognition
 */
export function useChatMessageHandler({
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
}: ChatMessageHandlerProps) {
  const {
    isGenerating,
    isUpdating,
    generateItinerary,
    updateItinerary,
    shouldConfirmReplacement,
    updateUserPreferencesFromConversation,
    hasPreviousItinerary,
    restorePreviousItinerary
  } = useAgentItinerary();
  
  const { itineraryDays, saveItinerary } = useItinerary();
  const { preferences, updatePreferences } = useUserPreferences();
  
  // Initialize conversation context service
  const conversationContext = new ConversationContextService();

  // Generate and display an itinerary
  const handleItineraryRequest = useCallback(async (message: string, parameters: any) => {
    try {
      if (shouldConfirmReplacement()) {
        await showSaveOrReplaceDialog(
          'Save Current Itinerary?',
          'You have an existing itinerary. Would you like to save it before creating a new one?',
          async () => {
            await generateItinerary(parameters);
          },
          async () => {
            await saveItinerary();
            await generateItinerary(parameters);
          }
        );
      } else {
        await generateItinerary(parameters);
      }
    } catch (err: any) {
      console.error('Error generating itinerary:', err);
      setErrorMessage(err.message || 'Error generating itinerary');
      addAIMessage('I encountered an error while generating your itinerary. Please try again.');
    }
  }, [generateItinerary, shouldConfirmReplacement, showSaveOrReplaceDialog, saveItinerary, setErrorMessage, addAIMessage]);

  // Handle itinerary updates
  const handleItineraryUpdate = useCallback(async (message: string, requestType: string, details: any) => {
    try {
      await updateItinerary(requestType, details);
      addAIMessage("I've updated your itinerary with the requested changes. Please review them in the itinerary view.");
    } catch (err: any) {
      console.error('Error updating itinerary:', err);
      setErrorMessage(err.message || 'Error updating itinerary');
      addAIMessage('I encountered an error while updating your itinerary. Please try again.');
    }
  }, [updateItinerary, addAIMessage, setErrorMessage]);

  // Handle recommendations
  const handleRecommendations = useCallback(async (message: string, parameters: any) => {
    try {
      const systemPrompt = promptTemplateService.getSystemPrompt(
        ChatIntent.GET_RECOMMENDATIONS,
        {
          userPreferences: preferences,
          currentDestination: parameters.location || conversationContext.getContext().currentDestination
        }
      );

      const userPrompt = promptTemplateService.getUserPrompt(
        ChatIntent.GET_RECOMMENDATIONS,
        parameters,
        {
          userPreferences: preferences,
          currentDestination: parameters.location || conversationContext.getContext().currentDestination
        }
      );

      const response = await openaiService.generateChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const aiResponse = response.choices[0].message.content;
      addAIMessage(aiResponse);
      
      // Track the recommendations in context
      conversationContext.addConversationTurn('assistant', aiResponse, ChatIntent.GET_RECOMMENDATIONS, parameters);
    } catch (err: any) {
      console.error('Error getting recommendations:', err);
      setErrorMessage(err.message || 'Error getting recommendations');
      addAIMessage('I encountered an error while getting recommendations. Please try again.');
    }
  }, [preferences, addAIMessage, setErrorMessage]);

  // Handle questions
  const handleQuestions = useCallback(async (message: string, parameters: any) => {
    try {
      const systemPrompt = promptTemplateService.getSystemPrompt(
        ChatIntent.ASK_QUESTIONS,
        {
          userPreferences: preferences,
          currentDestination: conversationContext.getContext().currentDestination
        }
      );

      const userPrompt = promptTemplateService.getUserPrompt(
        ChatIntent.ASK_QUESTIONS,
        parameters,
        {
          userPreferences: preferences,
          currentDestination: conversationContext.getContext().currentDestination
        }
      );

      const response = await openaiService.generateChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const aiResponse = response.choices[0].message.content;
      addAIMessage(aiResponse);
      
      // Track the question in context
      conversationContext.addConversationTurn('assistant', aiResponse, ChatIntent.ASK_QUESTIONS, parameters);
    } catch (err: any) {
      console.error('Error answering question:', err);
      setErrorMessage(err.message || 'Error answering question');
      addAIMessage('I encountered an error while answering your question. Please try again.');
    }
  }, [preferences, addAIMessage, setErrorMessage]);

  // Handle general chat
  const handleGeneralChat = useCallback(async (message: string, parameters: any) => {
    try {
      const systemPrompt = promptTemplateService.getSystemPrompt(
        ChatIntent.GENERAL_CHAT,
        {
          userPreferences: preferences,
          currentDestination: conversationContext.getContext().currentDestination
        }
      );

      const userPrompt = promptTemplateService.getUserPrompt(
        ChatIntent.GENERAL_CHAT,
        parameters,
        {
          userPreferences: preferences,
          currentDestination: conversationContext.getContext().currentDestination
        }
      );

      const response = await openaiService.generateChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const aiResponse = response.choices[0].message.content;
      addAIMessage(aiResponse);
      
      // Track the conversation in context
      conversationContext.addConversationTurn('assistant', aiResponse, ChatIntent.GENERAL_CHAT, parameters);
    } catch (err: any) {
      console.error('Error in general chat:', err);
      setErrorMessage(err.message || 'Error processing message');
      addAIMessage('I encountered an error while processing your message. Please try again.');
    }
  }, [preferences, addAIMessage, setErrorMessage]);

  // Handle user sending a message with intent recognition
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Add the user message to the chat
    addUserMessage(message);
    startTyping();
    
    try {
      // Extract any destination mentioned in the message
      const destination = detectDestination(message, onDestinationDetected);
      
      // Classify the message intent
      const classification = await intentClassificationService.classifyIntent(message, {
        hasExistingItinerary: itineraryDays.length > 0,
        currentDestination: destination || conversationContext.getContext().currentDestination
      });

      // Track the user message in context
      conversationContext.addConversationTurn('user', message, classification.intent, classification.parameters);
      
      // Update user preferences if any are mentioned
      if (classification.parameters) {
        await updateUserPreferencesFromConversation(message);
      }

      // Handle the message based on intent
      switch (classification.intent) {
        case ChatIntent.NEW_ITINERARY:
          await handleItineraryRequest(message, classification.parameters);
          break;

        case ChatIntent.MODIFY_EXISTING:
          await handleItineraryUpdate(
            message,
            classification.parameters.modificationDetails?.type || 'modify',
            classification.parameters.modificationDetails
          );
          break;

        case ChatIntent.GET_RECOMMENDATIONS:
          await handleRecommendations(message, classification.parameters);
          break;

        case ChatIntent.ASK_QUESTIONS:
          await handleQuestions(message, classification.parameters);
          break;

        case ChatIntent.GENERAL_CHAT:
        default:
          await handleGeneralChat(message, classification.parameters);
          break;
      }

      // Update suggestions if needed
      if (destination) {
        updateSuggestionsForDestination(destination);
      }
    } catch (err: any) {
      console.error('Error processing message:', err);
      setErrorMessage(err.message || 'An error occurred while processing your message.');
      addAIMessage("I'm sorry, I encountered an error: " + (err.message || 'Unknown error'));
    } finally {
      stopTyping();
    }
  }, [
    addUserMessage,
    startTyping,
    detectDestination,
    onDestinationDetected,
    itineraryDays.length,
    updateUserPreferencesFromConversation,
    handleItineraryRequest,
    handleItineraryUpdate,
    handleRecommendations,
    handleQuestions,
    handleGeneralChat,
    updateSuggestionsForDestination,
    setErrorMessage,
    addAIMessage,
    stopTyping
  ]);

  // Handle restoring previous itinerary
  const handleRestorePreviousItinerary = useCallback(async () => {
    try {
      if (hasPreviousItinerary) {
        await showConfirmation(
          'Restore Previous Itinerary?',
          'This will replace your current itinerary. Would you like to continue?',
          async () => {
            await restorePreviousItinerary();
            addAIMessage("I've restored your previous itinerary. You can view it in the itinerary panel.");
          }
        );
      }
    } catch (err: any) {
      console.error('Error restoring previous itinerary:', err);
      setErrorMessage(err.message || 'Error restoring previous itinerary');
      addAIMessage('I encountered an error while restoring your previous itinerary. Please try again.');
    }
  }, [hasPreviousItinerary, showConfirmation, restorePreviousItinerary, addAIMessage, setErrorMessage]);

  return {
    handleSendMessage,
    handleItineraryRequest,
    handleItineraryUpdate,
    handleRecommendations,
    handleQuestions,
    handleGeneralChat,
    handleRestorePreviousItinerary,
    isGenerating,
    isUpdating
  };
}

export default useChatMessageHandler; 