import { DESTINATION_MAP, TRIP_PATTERNS } from '../constants/chatConstants';

/**
 * Extracts destination from user message using various patterns and known destination mappings
 * @param message User's message text
 * @returns Standardized destination name or null if not found
 */
export const extractDestination = (message: string): string | null => {
  // First try to match exact destinations from our map
  for (const [city, formattedName] of Object.entries(DESTINATION_MAP)) {
    // Use word boundaries to avoid partial matches
    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
    if (cityRegex.test(message)) {
      return formattedName;
    }
  }
  
  // If no match found, try to extract any potential destination mentioned
  for (const pattern of TRIP_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const potentialDestination = match[1].trim();
      
      // Check if this is a known destination with a different format
      for (const [city, formattedName] of Object.entries(DESTINATION_MAP)) {
        if (potentialDestination.toLowerCase().includes(city.toLowerCase())) {
          return formattedName;
        }
      }
      
      // If not found in our map, return the extracted destination with proper capitalization
      return potentialDestination; 
    }
  }
  
  // If no destination found, return null
  return null;
}; 