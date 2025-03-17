import React, { useState, useEffect, useRef } from 'react';
import { openaiService, setupItineraryInterface } from '../../services/openaiService';
import ChatMessageList from '../TravelPlanner/ChatMessageList';
import ChatInputArea from '../TravelPlanner/ChatInputArea';
import { cn } from '../../lib/utils';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { agentRules } from '../../config/agentRules';
import { useAgentItinerary } from '../../hooks/useAgentItinerary';
import { 
  getWelcomeMessage, 
  INITIAL_SUGGESTIONS, 
  DESTINATION_SUGGESTIONS, 
  ITINERARY_SUGGESTIONS 
} from '../../constants/chatConstants';
import { extractDestination } from '../../utils/destinationUtils';
import { extractJsonFromText, safeJsonParse } from '../../utils/jsonUtils';
import { 
  OpenAIMessage, 
  UIMessage, 
  SuggestionChip, 
  ChatAgentProps, 
  ItineraryData 
} from '../../types/chat';

// Log to verify agentRules is imported correctly
console.log('ChatAgent: agentRules imported successfully', agentRules);

// Use these local types to avoid the conflicts with imported types
type OpenAIMessageType = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type UIMessageType = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
};

type SuggestionChipType = {
  id: string;
  text: string;
};

type ChatAgentPropsType = {
  onDestinationDetected?: (destination: string) => void;
};

type ItineraryDataType = {
  title?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  message?: string;
  days: Array<{
    dayNumber?: number;
    date?: string;
    activities: Array<{
      id?: string;
      title: string;
      description: string;
      location: string;
      time: string;
      type?: string;
      dayNumber?: number;
    }>;
  }>;
};

// Add this helper function at the top of the file or before it's used
/**
 * Attempts to repair malformed JSON with common issues like unterminated strings
 * @param jsonString Potentially malformed JSON string
 * @returns Repaired JSON string that can be parsed
 */
const repairJsonString = (jsonString: string): string => {
  console.log('Repairing JSON string...');
  
  // Remove markdown code blocks
  let repairedString = jsonString
    .replace(/^```json\s*/g, '')
    .replace(/^```\s*/g, '')
    .replace(/\s*```$/g, '');
    
  // Fix common JSON issues
  repairedString = repairedString
    .replace(/,\s*}/g, '}')        // Remove trailing commas in objects
    .replace(/,\s*\]/g, ']')       // Remove trailing commas in arrays
    .replace(/\\n/g, ' ')          // Replace escaped newlines with spaces
    .replace(/\n/g, ' ')           // Replace literal newlines with spaces
    .replace(/\\"/g, '__QUOTE__')  // Temporarily replace escaped quotes
    
    // Fix property names without quotes or with single quotes
    .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')  // Add quotes to unquoted property names
    .replace(/([{,])\s*'([^']+)'\s*:/g, '$1"$2":')        // Replace single quotes with double quotes in property names
    
    // Fix issues with values
    .replace(/:\s*'([^']+)'/g, ':"$1"')     // Replace single-quoted values with double-quoted values
    
    .replace(/(?<!")"(?!")/g, '"') // Fix unbalanced quotes
    .replace(/__QUOTE__/g, '\\"'); // Restore escaped quotes
    
  // Check for unterminated strings
  const doubleQuotes = repairedString.match(/"/g);
  if (doubleQuotes && doubleQuotes.length % 2 !== 0) {
    // Add a closing quote at the end if needed
    repairedString += '"';
  }
  
  // Check for missing closing brackets
  const openBraces = (repairedString.match(/{/g) || []).length;
  const closeBraces = (repairedString.match(/}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repairedString += '}';
  }
  
  const openBrackets = (repairedString.match(/\[/g) || []).length;
  const closeBrackets = (repairedString.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repairedString += ']';
  }
  
  return repairedString.trim();
};

export const ChatAgent: React.FC<ChatAgentPropsType> = ({ onDestinationDetected }) => {
  const { userPreferences } = useUserPreferences();
  const agentItinerary = useAgentItinerary();
  
  // OpenAI messages for API calls
  const [apiMessages, setApiMessages] = useState<OpenAIMessageType[]>([
    { role: 'system', content: agentRules.systemPrompt }
  ]);
  
  // UI messages for display
  const [uiMessages, setUiMessages] = useState<UIMessageType[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionChipType[]>(INITIAL_SUGGESTIONS);

  // Refs to track state
  const hasInitializedMessages = useRef(false);
  const hasCreatedItinerary = useRef(false);
  const currentDestinationRef = useRef<string | null>(null);

  // Initialize itinerary interface once
  useEffect(() => {
    setupItineraryInterface({
      createMockItinerary: agentItinerary.createMockItinerary,
      addItineraryActivity: agentItinerary.addItineraryActivity,
      getCurrentItinerary: agentItinerary.getCurrentItinerary,
      itineraryDays: agentItinerary.itineraryDays,
    });
  }, []);

  // Set initial welcome message
  useEffect(() => {
    if (userPreferences && !hasInitializedMessages.current) {
      hasInitializedMessages.current = true;
      const userName = userPreferences.name?.split(' ')[0] || 'there';
      setUiMessages([getWelcomeMessage(userName) as UIMessageType]);
    } else if (!hasInitializedMessages.current) {
      hasInitializedMessages.current = true;
      setUiMessages([getWelcomeMessage() as UIMessageType]);
    }
  }, [userPreferences]);

  // Update suggestions when destination changes
  useEffect(() => {
    if (currentDestinationRef.current) {
      const destination = currentDestinationRef.current;
      const hasItinerary = agentItinerary.getCurrentItinerary() !== null;
      
      setSuggestions(hasItinerary 
        ? ITINERARY_SUGGESTIONS(destination) as SuggestionChipType[]
        : DESTINATION_SUGGESTIONS(destination) as SuggestionChipType[]);
    }
  }, [agentItinerary]);

  // Process the AI response to handle itinerary creation
  const processItineraryFromResponse = async (message: string): Promise<boolean> => {
    if (!hasCreatedItinerary.current && message.includes('itinerary')) {
      try {
        // Extract and parse JSON from response
        const jsonString = extractJsonFromText(message);
        if (!jsonString) return false;
        
        const cleanedJsonString = repairJsonString(jsonString);
        const itineraryData = safeJsonParse<ItineraryDataType>(cleanedJsonString);
        
        if (!itineraryData) return false;
        if (itineraryData.success === false) return false;
        
        if (itineraryData.title && itineraryData.days) {
          hasCreatedItinerary.current = true;
          
          // Set the destination from the title if available
          const destination = itineraryData.destination || itineraryData.title || "Unknown Destination";
          currentDestinationRef.current = destination;
          if (onDestinationDetected) {
            onDestinationDetected(destination);
          }
          
          // Create the itinerary
          const result = await createItineraryFromData(itineraryData);
          
          if (result) {
            // Send a confirmation message
            const confirmationMessage: UIMessageType = {
              id: Date.now().toString(),
              content: `I've created your itinerary for ${destination}! You can view the full details in the sidebar.`,
              sender: "ai",
              timestamp: new Date(),
            };
            
            // Update UI and API messages
            setUiMessages(prev => [...prev.slice(0, -1), confirmationMessage]);
            setApiMessages(prev => {
              // Replace the last assistant message with the confirmation
              const newMessages = [...prev];
              if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
                newMessages[newMessages.length - 1].content = confirmationMessage.content;
              }
              return newMessages;
            });
            
            return true;
          }
        }
      } catch (error) {
        console.error('Error processing itinerary from response:', error);
      }
    }
    return false;
  };

  // Helper function to create itinerary from parsed data
  const createItineraryFromData = async (itineraryData: ItineraryDataType): Promise<boolean> => {
    try {
      // Instead of trying to clear existing itinerary directly, we'll create a new one
      
      // Extract or generate the necessary parameters
      const today = new Date();
      const startDate = itineraryData.startDate || today.toISOString().split('T')[0];
      
      // Calculate end date based on number of days if not provided
      const dayCount = itineraryData.days.length || 1;
      const endDateObj = new Date(today);
      endDateObj.setDate(today.getDate() + dayCount - 1);
      const endDate = itineraryData.endDate || endDateObj.toISOString().split('T')[0];
      
      // Process activities
      const activities: any[] = [];
      
      // Flatten days into activities array with dayNumber
      itineraryData.days.forEach((day, index) => {
        const dayNumber = index + 1;
        
        if (Array.isArray(day.activities)) {
          day.activities.forEach(activity => {
            activities.push({
              ...activity,
              dayNumber: dayNumber,
              // Ensure required fields exist
              title: activity.title || `Activity ${activities.length + 1}`,
              description: activity.description || "",
              location: activity.location || currentDestinationRef.current || "",
              time: activity.time || "12:00 PM",
              type: activity.type || "Activity"
            });
          });
        }
      });
      
      // Create the itinerary
      const destination = currentDestinationRef.current || itineraryData.destination || itineraryData.title || "My Trip";
      const result = await agentItinerary.createMockItinerary(
        destination,
        startDate,
        endDate,
        activities
      );
      
      return !!result;
    } catch (error) {
      console.error('Error creating itinerary:', error);
      return false;
    }
  };

  // Function to handle sending a message from the user
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Create user message
    const userUiMessage: UIMessageType = {
      id: Date.now().toString(),
      content: message,
      sender: "user",
      timestamp: new Date(),
    };

    // Update UI and API message states
    setUiMessages(prev => [...prev, userUiMessage]);
    const userApiMessage: OpenAIMessageType = { role: 'user', content: message };
    setApiMessages(prev => [...prev, userApiMessage]);
    
    // Extract destination if present
    const destination = extractDestination(message);
    if (destination) {
      currentDestinationRef.current = destination;
      if (onDestinationDetected) {
        onDestinationDetected(destination);
      }
    }

    // Set loading state
    setIsLoading(true);

    try {
      // Get AI response
      const response = await openaiService.generateChatCompletion([
        ...apiMessages,
        userApiMessage
      ]);
      
      const assistantMessage = response.choices[0]?.message?.content || "I'm sorry, I couldn't process that request.";
      
      // Add assistant message
      const assistantUiMessage: UIMessageType = {
        id: Date.now().toString(),
        content: assistantMessage,
        sender: "ai",
        timestamp: new Date(),
      };
      
      setUiMessages(prev => [...prev, assistantUiMessage]);
      setApiMessages(prev => [
        ...prev, 
        { role: 'assistant', content: assistantMessage }
      ]);
      
      // Process itinerary from response if needed
      await processItineraryFromResponse(assistantMessage);
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Add error message to UI
      setUiMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: "I'm sorry, I encountered an error. Please try again or ask a different question.",
        sender: "ai",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: SuggestionChipType) => {
    handleSendMessage(suggestion.text);
  };

  return (
    <div className={cn("flex flex-col h-full w-full bg-white")}>
      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={uiMessages} isLoading={isLoading} />
      </div>
      <div className="mt-auto">
        <ChatInputArea
          onSendMessage={handleSendMessage}
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          isLoading={isLoading}
        />
        <div className="text-center text-xs text-gray-500 pb-[6px]">
          <p>© 2025 AI Travel Planner. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};