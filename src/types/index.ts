/**
 * Message type for chat interactions
 */
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

/**
 * Activity type for itinerary items
 */
export interface Activity {
  id?: string;
  title: string;
  description: string;
  location: string;
  time: string;
  type?: string;
  imageUrl?: string;
  dayNumber?: number;
  
  // Additional properties for edit functionality
  dayDate?: Date;
  displayStartTime?: string;
  displayEndTime?: string;
  parsedStartTime?: string;
  parsedEndTime?: string;
}

/**
 * ItineraryDay type for organizing activities by day
 */
export interface ItineraryDay {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

/**
 * SuggestionItem type for activity suggestions
 */
export interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  location: string;
  duration: string;
  imageUrl?: string;
  category?: string;
  rating?: number;
  price?: string;
} 