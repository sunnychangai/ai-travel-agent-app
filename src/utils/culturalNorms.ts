/**
 * Cultural meal time norms for different countries and regions
 * Helps ensure itineraries respect local dining customs
 */

export interface MealTimeNorms {
  breakfast: {
    earliest: string;
    typical: string;
    latest: string;
  };
  lunch: {
    earliest: string;
    typical: string;
    latest: string;
  };
  dinner: {
    earliest: string;
    typical: string;
    latest: string;
  };
  notes?: string;
}

/**
 * Cultural meal time norms by country/region
 */
export const CULTURAL_MEAL_TIMES: Record<string, MealTimeNorms> = {
  // European countries with late dinner times
  spain: {
    breakfast: { earliest: '8:00 AM', typical: '9:00 AM', latest: '10:00 AM' },
    lunch: { earliest: '1:30 PM', typical: '2:30 PM', latest: '3:30 PM' },
    dinner: { earliest: '8:30 PM', typical: '9:30 PM', latest: '11:00 PM' },
    notes: 'Spanish dinner is typically very late, often after 9:30 PM'
  },
  italy: {
    breakfast: { earliest: '7:30 AM', typical: '8:30 AM', latest: '9:30 AM' },
    lunch: { earliest: '12:30 PM', typical: '1:30 PM', latest: '2:30 PM' },
    dinner: { earliest: '7:30 PM', typical: '8:30 PM', latest: '10:00 PM' },
    notes: 'Italian dinner is usually after 8:00 PM, especially in the south'
  },
  france: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '7:30 PM', typical: '8:30 PM', latest: '10:00 PM' },
    notes: 'French dinner is typically after 8:00 PM'
  },
  portugal: {
    breakfast: { earliest: '7:30 AM', typical: '8:30 AM', latest: '9:30 AM' },
    lunch: { earliest: '12:30 PM', typical: '1:30 PM', latest: '2:30 PM' },
    dinner: { earliest: '7:30 PM', typical: '8:30 PM', latest: '10:00 PM' },
    notes: 'Portuguese dinner is usually after 8:00 PM'
  },
  greece: {
    breakfast: { earliest: '7:30 AM', typical: '8:30 AM', latest: '9:30 AM' },
    lunch: { earliest: '1:00 PM', typical: '2:00 PM', latest: '3:00 PM' },
    dinner: { earliest: '8:00 PM', typical: '9:00 PM', latest: '11:00 PM' },
    notes: 'Greek dinner is very late, often after 9:00 PM'
  },
  germany: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '7:00 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'German dinner is earlier than Mediterranean countries but still typically after 7:00 PM'
  },
  austria: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '7:00 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'Austrian dinner customs similar to Germany'
  },
  netherlands: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '12:30 PM', latest: '1:30 PM' },
    dinner: { earliest: '6:30 PM', typical: '7:00 PM', latest: '8:00 PM' },
    notes: 'Dutch dinner is earlier than most European countries'
  },
  belgium: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '7:00 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'Belgian dinner times are moderate'
  },
  'united kingdom': {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '6:30 PM', typical: '7:00 PM', latest: '8:30 PM' },
    notes: 'British dinner is earlier than continental Europe'
  },
  'czech republic': {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '7:00 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'Czech dinner times are moderate'
  },
  hungary: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '7:00 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'Hungarian dinner times are moderate'
  },
  poland: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '1:00 PM', typical: '2:00 PM', latest: '3:00 PM' },
    dinner: { earliest: '7:00 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'Polish dinner times are moderate'
  },
  
  // Asian countries
  japan: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '11:30 AM', typical: '12:30 PM', latest: '1:30 PM' },
    dinner: { earliest: '6:00 PM', typical: '7:00 PM', latest: '8:30 PM' },
    notes: 'Japanese dinner is typically earlier than European standards'
  },
  china: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '11:30 AM', typical: '12:30 PM', latest: '1:30 PM' },
    dinner: { earliest: '6:00 PM', typical: '7:00 PM', latest: '8:30 PM' },
    notes: 'Chinese dinner is typically earlier'
  },
  'south korea': {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '11:30 AM', typical: '12:30 PM', latest: '1:30 PM' },
    dinner: { earliest: '6:30 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'Korean dinner times are moderate'
  },
  thailand: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '6:30 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'Thai dinner times are flexible'
  },
  
  // North American countries
  'united states': {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '11:30 AM', typical: '12:30 PM', latest: '1:30 PM' },
    dinner: { earliest: '6:00 PM', typical: '7:00 PM', latest: '8:30 PM' },
    notes: 'American dinner is typically earlier than European standards'
  },
  canada: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '11:30 AM', typical: '12:30 PM', latest: '1:30 PM' },
    dinner: { earliest: '6:00 PM', typical: '7:00 PM', latest: '8:30 PM' },
    notes: 'Canadian dinner times similar to US'
  },
  
  // Default for other regions
  default: {
    breakfast: { earliest: '7:00 AM', typical: '8:00 AM', latest: '9:00 AM' },
    lunch: { earliest: '12:00 PM', typical: '1:00 PM', latest: '2:00 PM' },
    dinner: { earliest: '7:00 PM', typical: '7:30 PM', latest: '9:00 PM' },
    notes: 'General meal times with 7:00 PM minimum for dinner'
  }
};

/**
 * Extract country from destination string
 * @param destination Destination string (e.g., "Paris, France", "Tokyo", "Barcelona")
 * @returns Normalized country name or null if not found
 */
export function extractCountryFromDestination(destination: string): string | null {
  if (!destination) return null;
  
  const dest = destination.toLowerCase().trim();
  
  // Direct country matches
  const countryMappings: Record<string, string> = {
    'spain': 'spain',
    'italy': 'italy', 
    'france': 'france',
    'portugal': 'portugal',
    'greece': 'greece',
    'germany': 'germany',
    'austria': 'austria',
    'netherlands': 'netherlands',
    'belgium': 'belgium',
    'united kingdom': 'united kingdom',
    'uk': 'united kingdom',
    'england': 'united kingdom',
    'scotland': 'united kingdom',
    'wales': 'united kingdom',
    'czech republic': 'czech republic',
    'czechia': 'czech republic',
    'hungary': 'hungary',
    'poland': 'poland',
    'japan': 'japan',
    'china': 'china',
    'south korea': 'south korea',
    'korea': 'south korea',
    'thailand': 'thailand',
    'united states': 'united states',
    'usa': 'united states',
    'us': 'united states',
    'america': 'united states',
    'canada': 'canada'
  };
  
  // Check for direct country match
  for (const [key, value] of Object.entries(countryMappings)) {
    if (dest.includes(key)) {
      return value;
    }
  }
  
  // City-to-country mappings for major cities
  const cityMappings: Record<string, string> = {
    'madrid': 'spain',
    'barcelona': 'spain',
    'seville': 'spain',
    'valencia': 'spain',
    'rome': 'italy',
    'florence': 'italy',
    'venice': 'italy',
    'milan': 'italy',
    'naples': 'italy',
    'paris': 'france',
    'lyon': 'france',
    'marseille': 'france',
    'nice': 'france',
    'lisbon': 'portugal',
    'porto': 'portugal',
    'athens': 'greece',
    'santorini': 'greece',
    'mykonos': 'greece',
    'berlin': 'germany',
    'munich': 'germany',
    'hamburg': 'germany',
    'cologne': 'germany',
    'vienna': 'austria',
    'salzburg': 'austria',
    'amsterdam': 'netherlands',
    'brussels': 'belgium',
    'london': 'united kingdom',
    'edinburgh': 'united kingdom',
    'manchester': 'united kingdom',
    'prague': 'czech republic',
    'budapest': 'hungary',
    'warsaw': 'poland',
    'tokyo': 'japan',
    'osaka': 'japan',
    'kyoto': 'japan',
    'beijing': 'china',
    'shanghai': 'china',
    'seoul': 'south korea',
    'bangkok': 'thailand',
    'new york': 'united states',
    'los angeles': 'united states',
    'chicago': 'united states',
    'san francisco': 'united states',
    'toronto': 'canada',
    'vancouver': 'canada',
    'montreal': 'canada'
  };
  
  // Check for city matches
  for (const [city, country] of Object.entries(cityMappings)) {
    if (dest.includes(city)) {
      return country;
    }
  }
  
  return null;
}

/**
 * Get cultural meal time norms for a destination
 * @param destination Destination string
 * @returns MealTimeNorms object with cultural guidelines
 */
export function getCulturalMealTimes(destination: string): MealTimeNorms {
  const country = extractCountryFromDestination(destination);
  
  if (country && CULTURAL_MEAL_TIMES[country]) {
    return CULTURAL_MEAL_TIMES[country];
  }
  
  return CULTURAL_MEAL_TIMES.default;
}

/**
 * Generate meal time guidance text for prompts
 * @param destination Destination string
 * @returns Formatted guidance text about meal times
 */
export function getMealTimeGuidance(destination: string): string {
  const norms = getCulturalMealTimes(destination);
  const country = extractCountryFromDestination(destination);
  
  let guidance = `MEAL TIME CULTURAL GUIDELINES for ${destination}:\n`;
  
  if (country) {
    guidance += `- Based on ${country.charAt(0).toUpperCase() + country.slice(1)} dining customs\n`;
  }
  
  guidance += `- Breakfast: Typically around ${norms.breakfast.typical} (${norms.breakfast.earliest} - ${norms.breakfast.latest})\n`;
  guidance += `- Lunch: Typically around ${norms.lunch.typical} (${norms.lunch.earliest} - ${norms.lunch.latest})\n`;
  guidance += `- Dinner: Typically around ${norms.dinner.typical} (MINIMUM ${norms.dinner.earliest} - ${norms.dinner.latest})\n`;
  
  if (norms.notes) {
    guidance += `- Cultural Note: ${norms.notes}\n`;
  }
  
  guidance += `\nIMPORTANT: Dinner must NEVER be scheduled before ${norms.dinner.earliest}. This respects local dining customs and ensures restaurants are open and serving dinner.`;
  
  return guidance;
} 