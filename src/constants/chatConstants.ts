import { SuggestionChip, UIMessage } from '../types/chat';

// Initial suggestions for chat
export const INITIAL_SUGGESTIONS: SuggestionChip[] = [
  { id: "1", text: "I want to visit Paris" },
  { id: "2", text: "Plan a trip to Tokyo" },
  { id: "3", text: "Weekend in New York" },
];

// Suggestions when a destination is selected but no itinerary exists
export const DESTINATION_SUGGESTIONS = (destination: string): SuggestionChip[] => [
  { id: "13", text: `What are the top attractions in ${destination}?` },
  { id: "14", text: `Where should I eat in ${destination}?` },
  { id: "15", text: `Create an itinerary for ${destination}` },
];

// Suggestions when an itinerary already exists
export const ITINERARY_SUGGESTIONS = (destination: string): SuggestionChip[] => [
  { id: "10", text: `Create a 3-day itinerary for ${destination}` },
  { id: "11", text: `What should I do on my first day in ${destination}?` },
  { id: "12", text: `Plan a family-friendly day in ${destination}` },
];

// Welcome message template
export const getWelcomeMessage = (userName: string = 'there'): UIMessage => ({
  id: "1",
  content: `Hi ${userName}! I'm your AI travel assistant. I can help you plan your trip. Where would you like to go?`,
  sender: "ai",
  timestamp: new Date(),
});

// Destination mapping for standardized location names
export const DESTINATION_MAP: Record<string, string> = {
  'Paris': 'Paris, France',
  'Tokyo': 'Tokyo, Japan',
  'New York': 'New York, USA',
  'NYC': 'New York, USA',
  'London': 'London, UK',
  'Rome': 'Rome, Italy',
  'Barcelona': 'Barcelona, Spain',
  'Sydney': 'Sydney, Australia',
  'Dubai': 'Dubai, UAE',
  'Singapore': 'Singapore',
  'Hong Kong': 'Hong Kong',
  'Bangkok': 'Bangkok, Thailand',
  'Istanbul': 'Istanbul, Turkey',
  'Prague': 'Prague, Czech Republic',
  'Amsterdam': 'Amsterdam, Netherlands',
  'Vienna': 'Vienna, Austria',
  'Berlin': 'Berlin, Germany',
  'Madrid': 'Madrid, Spain',
  'Venice': 'Venice, Italy',
  'Florence': 'Florence, Italy',
  'Athens': 'Athens, Greece',
  'France': 'France',
  'Japan': 'Japan',
  'USA': 'USA',
  'UK': 'UK',
  'Italy': 'Italy',
  'Spain': 'Spain',
  'Australia': 'Australia',
  'UAE': 'UAE',
  'Thailand': 'Thailand',
  'Turkey': 'Turkey',
  'Czech Republic': 'Czech Republic',
  'Netherlands': 'Netherlands',
  'Austria': 'Austria',
  'Germany': 'Germany',
  'Greece': 'Greece',
  'Fredericksburg': 'Fredericksburg, Texas',
  'Fredericksburg, Texas': 'Fredericksburg, Texas',
  'Texas': 'Texas, USA'
};

// Patterns for destination extraction from user messages
export const TRIP_PATTERNS = [
  /(?:trip|travel|go|going|visit|visiting|vacation)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  /(?:plan|create|make)(?:\s+an?)?\s+(?:itinerary|trip)(?:\s+to)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  /(?:my|a|the)\s+(?:trip|travel|vacation)\s+(?:in|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  /(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:\s+from)/i,
  /for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
]; 