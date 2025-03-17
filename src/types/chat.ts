// OpenAI message type
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// UI message type for display in chat
export interface UIMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

// Suggestion chip for chat input area
export interface SuggestionChip {
  id: string;
  text: string;
}

// Props for ChatAgent component
export interface ChatAgentProps {
  onDestinationDetected?: (destination: string) => void;
}

// Itinerary data structure from API responses
export interface ItineraryData {
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
} 