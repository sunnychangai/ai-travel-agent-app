import { useCallback } from 'react';
import { useAgentItinerary } from '../../hooks/useAgentItinerary';
import { useItinerary } from '../../contexts/ItineraryContext';
import { performanceConfig } from '../../config/performance';

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
  createConversationResponse: (message: string, hasItinerary: boolean) => string;
};

/**
 * Hook that contains message handling logic
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
  createConversationResponse
}: ChatMessageHandlerProps) {
  const {
    isGenerating,
    isUpdating,
    generateItinerary,
    updateItinerary,
    detectItineraryRequest,
    detectUpdateRequest,
    shouldConfirmReplacement,
    updateUserPreferencesFromConversation,
    hasPreviousItinerary,
    restorePreviousItinerary
  } = useAgentItinerary();
  
  const { itineraryDays, saveItinerary } = useItinerary();
  
  // Generate and display an itinerary - with optimized dependency array
  const generateAndDisplayItinerary = useCallback(async (params: any) => {
    try {
      // Calculate end date if not provided but duration is
      let startDate = params.startDate;
      let endDate = params.endDate;
      
      if (!endDate && params.duration && startDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + parseInt(params.duration) - 1);
        endDate = end.toISOString().split('T')[0];
      }
      
      // If we still don't have dates, use defaults
      if (!startDate) {
        const now = new Date();
        startDate = now.toISOString().split('T')[0];
      }
      
      if (!endDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 2); // Default 3-day trip
        endDate = end.toISOString().split('T')[0];
      }
      
      // Set generation quality based on performance config
      if (params && !params.generationQuality) {
        params.generationQuality = performanceConfig.itineraryGeneration.mode;
        params.useExternalData = performanceConfig.itineraryGeneration.useExternalData;
      }
      
      // Generate the itinerary
      const result = await generateItinerary(
        params.destination,
        startDate,
        endDate,
        { ...(params.preferences || {}) }
      );
      
      if (result.success) {
        // Add completion message
        addAIMessage(`I've created your itinerary for ${params.destination}! You can see it in the right panel. Feel free to ask me to make any changes.`);
        
        // Update suggestions to be more relevant for itinerary updates
        const destination = params.destination || '';
        updateSuggestionsForDestination(destination);
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      console.error('Error generating itinerary:', err);
      addAIMessage(`I'm sorry, I couldn't create the itinerary. ${err.message || 'Please try again with more details.'}`);
    }
  }, [
    addAIMessage, 
    generateItinerary, 
    updateSuggestionsForDestination,
    performanceConfig.itineraryGeneration.mode,
    performanceConfig.itineraryGeneration.useExternalData
  ]);
  
  // Handle itinerary generation requests
  const handleItineraryRequest = useCallback(async (message: string, params: any) => {
    try {
      // Format dates correctly with the appropriate year
      const formatDateWithYear = (dateStr: string | undefined) => {
        if (!dateStr) return 'the dates you mentioned';
        
        // Replace any year before 2025 with 2025
        const dateObj = new Date(dateStr);
        const year = dateObj.getFullYear();
        if (year < 2025) {
          const month = dateObj.getMonth();
          const day = dateObj.getDate();
          const newDate = new Date(2025, month, day);
          return newDate.toISOString().split('T')[0];
        }
        return dateStr;
      };
      
      // Format dates with correct year for display
      const displayStartDate = formatDateWithYear(params.startDate);
      
      // First send an acknowledgment message
      addAIMessage(`I'll create an itinerary for ${params.destination} from ${displayStartDate}. This will take a moment...`);
      
      // Update the current destination
      if (params.destination) {
        setCurrentDestination(params.destination);
      }
      
      // Check if there's an existing itinerary that would be replaced
      if (itineraryDays.length > 0 && shouldConfirmReplacement(
        params.destination,
        params.startDate || new Date(),
        params.endDate || new Date()
      )) {
        // Ask for confirmation with option to save current itinerary
        await showSaveOrReplaceDialog(
          'Replace existing itinerary?',
          `You already have an itinerary. Creating a new one for ${params.destination} will replace your current itinerary. Do you want to continue?`,
          async () => {
            // User chose to continue and replace
            await generateAndDisplayItinerary(params);
          },
          async () => {
            // User chose to save current first
            try {
              const savedId = await saveItinerary('My Saved Trip');
              if (savedId) {
                addAIMessage('I\'ve saved your current itinerary. Now creating your new one...');
                // Continue with generating the new itinerary
                await generateAndDisplayItinerary(params);
              } else {
                addAIMessage('I couldn\'t save your current itinerary. Please try again.');
              }
            } catch (error) {
              console.error('Error saving current itinerary:', error);
              addAIMessage('I encountered an error saving your current itinerary. Please try again.');
            }
          },
          {
            continueText: "Replace",
            saveCurrentText: "Save Current & Continue",
            cancelText: "Cancel"
          }
        );
      } else {
        // No existing itinerary or no confirmation needed
        await generateAndDisplayItinerary(params);
      }
    } catch (err: any) {
      console.error('Error generating itinerary:', err);
      addAIMessage(`I'm sorry, I couldn't create an itinerary for ${params.destination}. ${err.message || 'Please try again with more details.'}`);
    }
  }, [
    addAIMessage,
    setCurrentDestination,
    generateItinerary,
    shouldConfirmReplacement,
    showSaveOrReplaceDialog,
    generateAndDisplayItinerary,
    saveItinerary,
    itineraryDays.length
  ]);
  
  // Handle itinerary update requests
  const handleItineraryUpdate = useCallback(async (message: string, requestType: string, details: any) => {
    try {
      // First send an acknowledgment message
      addAIMessage(`I'll update your itinerary as requested. One moment...`);
      
      // Process the update
      const result = await updateItinerary(message);
      
      if (result.success) {
        // Add completion message
        let completionMessage: string;
        
        switch (requestType) {
          case 'change_time':
            completionMessage = `I've updated the time for the ${details.activity || 'activity'} as requested. Check the itinerary panel to see the changes.`;
            break;
          case 'add_activity':
            completionMessage = `I've added the new activity to your itinerary. You can see it in the right panel.`;
            break;
          case 'remove_activity':
            completionMessage = `I've removed the ${details.activityToRemove || 'activity'} from your itinerary as requested.`;
            break;
          default:
            completionMessage = `I've updated your itinerary as requested. Check the right panel to see the changes.`;
        }
        
        addAIMessage(completionMessage);
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      console.error('Error updating itinerary:', err);
      addAIMessage(`I'm sorry, I couldn't update your itinerary. ${err.message || 'Please try again with more details.'}`);
    }
  }, [addAIMessage, updateItinerary]);

  // Handle regular conversation messages
  const handleConversationMessage = useCallback(async (message: string) => {
    try {
      // Check if we have an itinerary
      const hasItinerary = itineraryDays.length > 0;
      
      // Get a response based on the message content and context
      const responseContent = createConversationResponse(message, hasItinerary);
      
      // Add the response to the messages
      addAIMessage(responseContent);
      
      // Update suggestions if needed
      const destination = detectDestination(message);
      if (!hasItinerary && destination) {
        // Use the current destination to generate suggestions
        updateSuggestionsForDestination(destination);
      }
    } catch (err: any) {
      console.error('Error processing conversation message:', err);
      addAIMessage(`I'm sorry, I encountered an error. ${err.message || 'Please try again.'}`);
    }
  }, [
    addAIMessage, 
    createConversationResponse, 
    detectDestination, 
    updateSuggestionsForDestination,
    itineraryDays.length
  ]);
  
  // Handle restoring the previous itinerary
  const handleRestorePreviousItinerary = useCallback(async () => {
    // Add user message
    addUserMessage('Restore my previous itinerary');
    
    // Set typing indicator
    startTyping();
    
    // Small delay to simulate thinking
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Restore the previous itinerary
    const success = restorePreviousItinerary();
    
    // Add AI response
    addAIMessage(success 
      ? "I've restored your previous itinerary. You can see it in the sidebar." 
      : "I couldn't find a previous itinerary to restore. Let's create a new one!");
    
    stopTyping();
    
    // Update suggestions based on the current state
    if (success) {
      updateSuggestionsForDestination('Your destination');
    }
  }, [
    addUserMessage, 
    startTyping, 
    restorePreviousItinerary, 
    addAIMessage, 
    stopTyping,
    updateSuggestionsForDestination
  ]);
  
  // Handle user sending a message with debounce protection
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Add the user message to the chat
    addUserMessage(message);
    
    // Only show typing indicator if enabled in performance config
    startTyping();
    
    try {
      // Extract any destination mentioned in the message
      const destination = detectDestination(message, onDestinationDetected);
      
      // Try to extract preferences from the message
      await updateUserPreferencesFromConversation(message);
      
      // Check if this is an itinerary generation request
      const { isItineraryRequest, extractedParams, isPreviousItineraryRequest } = await detectItineraryRequest(message);
      
      // Handle previous itinerary request
      if (isPreviousItineraryRequest) {
        return handleRestorePreviousItinerary();
      }
      
      if (isItineraryRequest) {
        // Update the destination if found in the extracted parameters
        if (extractedParams.destination) {
          setCurrentDestination(extractedParams.destination);
        }
        
        // Handle itinerary generation
        return await handleItineraryRequest(message, extractedParams);
      }
      
      // Check if this is an itinerary update request
      const { isUpdateRequest, requestType, details } = await detectUpdateRequest(message);
      
      if (isUpdateRequest) {
        // Handle itinerary update
        return await handleItineraryUpdate(message, requestType, details);
      }
      
      // Otherwise, process as a regular conversation message
      await handleConversationMessage(message);
    } catch (err: any) {
      console.error('Error processing message:', err);
      setErrorMessage(err.message || 'An error occurred while processing your message.');
      
      // Add error message to chat
      addAIMessage(`I'm sorry, I encountered an error: ${err.message || 'Unknown error'}`);
    } finally {
      stopTyping();
    }
  }, [
    addUserMessage,
    startTyping,
    detectDestination,
    onDestinationDetected,
    updateUserPreferencesFromConversation,
    detectItineraryRequest,
    handleRestorePreviousItinerary,
    setCurrentDestination,
    handleItineraryRequest,
    detectUpdateRequest,
    handleItineraryUpdate,
    handleConversationMessage,
    setErrorMessage,
    addAIMessage,
    stopTyping
  ]);

  return {
    handleSendMessage,
    handleItineraryRequest,
    handleItineraryUpdate,
    handleConversationMessage,
    handleRestorePreviousItinerary,
    isGenerating,
    isUpdating
  };
}

export default useChatMessageHandler; 