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
 * Comprehensive definition including all properties used across components
 */
export interface Activity {
  // Core properties
  id?: string;
  title: string;
  description: string;
  location: string;
  time?: string;
  type?: string;
  imageUrl?: string;
  dayNumber?: number;
  
  // Properties for editing
  dayDate?: Date;
  date?: Date;
  startTime?: string;
  endTime?: string;
  displayStartTime?: string;
  displayEndTime?: string;
  parsedStartTime?: string;
  parsedEndTime?: string;
  
  // Optional properties for enhanced activities
  category?: string;
  subcategory?: string;
  duration?: string;
  price?: string;
  notes?: string;
  rating?: number;
}

/**
 * ActivityEditModalProps interface for the modal that edits activities
 * Type used specifically by the ActivityEditModal component
 */
export interface ActivityEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: {
    id: string;
    title: string;
    description: string;
    location: string;
    date?: Date;
    startTime?: string;
    endTime?: string;
    imageUrl?: string;
    type?: string;
    time?: string;
    displayStartTime?: string;
    displayEndTime?: string;
    dayNumber?: number;
  };
  onSave: (activity: Activity) => void;
  isNewActivity?: boolean;
  placeholders?: {
    title?: string;
    description?: string;
    location?: string;
  };
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