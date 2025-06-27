import { useCallback } from 'react';
import { useAgentItinerary } from '../../hooks/useAgentItinerary';
import { useItinerary } from '../../contexts/ItineraryContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { performanceConfig } from '../../config/performance';
import { intentClassificationService } from '../../services/intentClassificationService';
import { promptTemplateService } from '../../services/promptTemplateService';
// Conversation context is now handled through conversationFlowManager
import { conversationFlowManager } from '../../services/conversationFlowManager';
import { ChatIntent } from '../../services/intentClassificationService';
import { openaiService } from '../../services/openaiService';
import { fastRecommendationService } from '../../services/fastRecommendationService';

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
  
  // Get conversation context from the flow manager
  const conversationContext = conversationFlowManager.getConversationContext();

  // Generate and display an itinerary
  const handleItineraryRequest = useCallback(async (message: string, parameters: any) => {
    try {
      const destination = parameters.destination || 'Unknown';
      const startDate = parameters.dates?.start || new Date().toISOString().split('T')[0];
      const endDate = parameters.dates?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // **DESTINATION SYNC**: Update conversation context with the new destination
      console.log('🔄 ChatMessageHandler: Syncing destination to conversation context:', destination);
      conversationFlowManager.trackConversationTurn('user', message, undefined, { destination, dates: { start: startDate, end: endDate } });
      setCurrentDestination(destination);
      
      // **FIX: Simplify date formatting to just show start date in YYYY-MM-DD format**
      const formatStartDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        // If year is before 2025, use 2025 instead
        if (date.getFullYear() < 2025) {
          date.setFullYear(2025);
        }
        // Return in YYYY-MM-DD format
        return date.toISOString().split('T')[0];
      };
      
      const formattedStartDate = formatStartDate(startDate);
      
      // Helper function to properly capitalize destination
      const capitalizeDestination = (dest: string) => {
        return dest.split(',').map(part => 
          part.trim().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ')
        ).join(', ');
      };
      
      const capitalizedDestination = capitalizeDestination(destination);
      
      // Add initial status message with simplified date format
      const statusMessage = `Perfect! I'm creating a personalized itinerary for your trip to ${capitalizedDestination} starting from ${formattedStartDate}. This will take just a moment...`;
      addAIMessage(statusMessage);
      
      const generateAndNotify = async () => {
        try {
          const result = await generateItinerary(destination, startDate, endDate, parameters);
          
          if (result.success) {
            // Add completion message
            const completionMessage = `🎉 Your ${capitalizedDestination} itinerary has been created! I've planned an amazing trip with activities, dining, and attractions tailored to your preferences. You can view and customize your itinerary in the sidebar.`;
            addAIMessage(completionMessage);
          } else {
            addAIMessage(`I encountered an issue creating your itinerary: ${result.message}. Please try again.`);
          }
        } catch (genErr: any) {
          console.error('Error in generateItinerary:', genErr);
          addAIMessage('I encountered an error while generating your itinerary. Please try again.');
        }
      };
      
      if (shouldConfirmReplacement(destination, startDate, endDate)) {
        await showSaveOrReplaceDialog(
          'Save Current Itinerary?',
          'You have an existing itinerary. Would you like to save it before creating a new one?',
          async () => {
            await generateAndNotify();
          },
          async () => {
            await saveItinerary('My Previous Itinerary');
            await generateAndNotify();
          }
        );
      } else {
        await generateAndNotify();
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
      // Add initial status message for updates
      addAIMessage("I'm updating your itinerary with the requested changes. This will take just a moment...");
      
      const result = await updateItinerary(message);
      
      if (result.success) {
        addAIMessage("✅ Perfect! I've updated your itinerary with the requested changes. You can review the updates in the itinerary sidebar.");
      } else {
        addAIMessage(`I encountered an issue updating your itinerary: ${result.message}. Please try again.`);
      }
    } catch (err: any) {
      console.error('Error updating itinerary:', err);
      setErrorMessage(err.message || 'Error updating itinerary');
      addAIMessage('I encountered an error while updating your itinerary. Please try again.');
    }
  }, [updateItinerary, addAIMessage, setErrorMessage]);

    // Handle recommendations with fast service and enhanced context
  const handleRecommendations = useCallback(async (message: string, parameters: any) => {
    try {
      const location = parameters.location || parameters.destination || conversationContext.getContext().currentDestination;
      
      if (!location) {
        addAIMessage("I'd be happy to help with recommendations! Could you let me know which city or location you're interested in?");
        return;
      }

      const recommendationType = parameters.recommendationType || 'general';
      
      console.log(`🔍 Processing ${recommendationType} recommendation request for ${location}`);
      console.log('📋 Request parameters:', parameters);
      
      // Check if this is a specific request (has cuisine type, dietary preferences, etc.)
      const hasSpecificCriteria = parameters.cuisineType || 
                                  parameters.dietaryPreferences || 
                                  parameters.priceRange ||
                                  parameters.specificType ||
                                  message.toLowerCase().includes('chinese') ||
                                  message.toLowerCase().includes('italian') ||
                                  message.toLowerCase().includes('mexican') ||
                                  message.toLowerCase().includes('indian') ||
                                  message.toLowerCase().includes('japanese') ||
                                  message.toLowerCase().includes('thai') ||
                                  message.toLowerCase().includes('french') ||
                                  message.toLowerCase().includes('american') ||
                                  message.toLowerCase().includes('pizza') ||
                                  message.toLowerCase().includes('burger') ||
                                  message.toLowerCase().includes('sushi') ||
                                  message.toLowerCase().includes('vegetarian') ||
                                  message.toLowerCase().includes('vegan') ||
                                  message.toLowerCase().includes('seafood') ||
                                  message.toLowerCase().includes('steakhouse') ||
                                  message.toLowerCase().includes('bbq') ||
                                  message.toLowerCase().includes('fast food') ||
                                  message.toLowerCase().includes('fine dining');
      
      console.log(`🎯 Has specific criteria: ${hasSpecificCriteria}`);
      
      // If it's a specific request, always process it as a new request
      if (hasSpecificCriteria) {
        console.log('✅ Processing as new specific request');
        
        // Add specific preferences to user preferences for this request
        const enhancedPreferences = preferences ? {
          interests: preferences.interests.map(interest => interest.label),
          dietaryPreferences: parameters.cuisineType ? [parameters.cuisineType] : preferences.dietaryPreferences.map(pref => pref.label),
          budget: parameters.priceRange || preferences.budget
        } : {
          dietaryPreferences: parameters.cuisineType ? [parameters.cuisineType] : undefined
        };
        
        const aiResponse = await fastRecommendationService.getRecommendations({
          location,
          type: recommendationType as 'restaurants' | 'activities' | 'hotels' | 'general',
          userPreferences: enhancedPreferences
        });
        
        addAIMessage(aiResponse);
      } else {
        // Check for recent similar recommendations only for general requests
        const recentRecs = conversationContext.getRecentRecommendations(recommendationType, 30);
        const isRepeatQuery = recentRecs.some(rec => rec.location.toLowerCase() === location.toLowerCase());
        
        console.log(`🔄 Is repeat query: ${isRepeatQuery}`);
        
        let aiResponse: string;
        
        if (isRepeatQuery && recentRecs.length > 0) {
          console.log('🔄 Handling as repeat/follow-up query');
          aiResponse = `I just gave you ${recommendationType} recommendations for ${location}. ${recentRecs[0].items.slice(0, 2).join(', ')} were among my top suggestions. Would you like:\n\n• More options in a different area?\n• A specific type of ${recommendationType}?\n• Recommendations for a different category?`;
        } else {
          console.log('✅ Processing as fresh general request');
          // Fresh recommendation request
          aiResponse = await fastRecommendationService.getRecommendations({
            location,
            type: recommendationType as 'restaurants' | 'activities' | 'hotels' | 'general',
            userPreferences: preferences ? {
              interests: preferences.interests.map(interest => interest.label),
              dietaryPreferences: preferences.dietaryPreferences.map(pref => pref.label),
              budget: preferences.budget
            } : undefined
          });
        }
        
        addAIMessage(aiResponse);
      }
      
      // Update enhanced context with the recommendation
      conversationFlowManager.trackConversationTurn('assistant', 'Recommendation provided', ChatIntent.GET_RECOMMENDATIONS, {
        ...parameters,
        location,
        recommendationType,
        hasSpecificCriteria
      });
      
      // Set current destination for future context
      setCurrentDestination(location);
      
    } catch (err: any) {
      console.error('Error getting recommendations:', err);
      setErrorMessage(err.message || 'Error getting recommendations');
      addAIMessage(`I encountered an error while getting recommendations for ${parameters.location || 'that location'}. Let me try a different approach - what specifically are you looking for?`);
    }
  }, [preferences, addAIMessage, setErrorMessage, setCurrentDestination]);

  // Handle questions
  const handleQuestions = useCallback(async (message: string, parameters: any) => {
    try {
      const systemPrompt = promptTemplateService.getSystemPrompt(
        ChatIntent.ASK_QUESTIONS,
        {
          userPreferences: preferences ? {
            travelStyle: preferences.travelStyle,
            interests: preferences.interests.map(interest => interest.label),
            dietaryPreferences: preferences.dietaryPreferences.map(pref => pref.label),
            budget: preferences.budget,
            pace: preferences.pace
          } : undefined,
          currentDestination: conversationContext.getContext().currentDestination
        }
      );

      const userPrompt = promptTemplateService.getUserPrompt(
        ChatIntent.ASK_QUESTIONS,
        parameters,
        {
          userPreferences: preferences ? {
            travelStyle: preferences.travelStyle,
            interests: preferences.interests.map(interest => interest.label),
            dietaryPreferences: preferences.dietaryPreferences.map(pref => pref.label),
            budget: preferences.budget,
            pace: preferences.pace
          } : undefined,
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
      conversationFlowManager.trackConversationTurn('assistant', aiResponse, ChatIntent.ASK_QUESTIONS, parameters);
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
          userPreferences: preferences ? {
            travelStyle: preferences.travelStyle,
            interests: preferences.interests.map(interest => interest.label),
            dietaryPreferences: preferences.dietaryPreferences.map(pref => pref.label),
            budget: preferences.budget,
            pace: preferences.pace
          } : undefined,
          currentDestination: conversationContext.getContext().currentDestination
        }
      );

      const userPrompt = promptTemplateService.getUserPrompt(
        ChatIntent.GENERAL_CHAT,
        parameters,
        {
          userPreferences: preferences ? {
            travelStyle: preferences.travelStyle,
            interests: preferences.interests.map(interest => interest.label),
            dietaryPreferences: preferences.dietaryPreferences.map(pref => pref.label),
            budget: preferences.budget,
            pace: preferences.pace
          } : undefined,
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
      conversationFlowManager.trackConversationTurn('assistant', aiResponse, ChatIntent.GENERAL_CHAT, parameters);
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

      // Track the user message in enhanced context with confidence
      conversationFlowManager.trackConversationTurn('user', message, classification.intent, classification.parameters, classification.confidence);
      
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
      if (hasPreviousItinerary()) {
        await showConfirmation(
          'Restore Previous Itinerary?',
          'This will replace your current itinerary. Would you like to continue?',
          async () => {
            restorePreviousItinerary();
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