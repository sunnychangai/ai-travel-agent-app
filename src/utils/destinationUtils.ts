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

/**
 * Parses a complex location string and extracts a clean "{city}, {country}" format
 * @param locationString Complex location string (e.g., "75001 Paris, Rue de Rivoli, Port de la Bourdonnais, 75010 Paris...")
 * @returns Clean location string in "{city}, {country}" format
 */
export const parseLocationString = (locationString: string): string => {
  if (!locationString || typeof locationString !== 'string') {
    return 'Unknown Location';
  }

  // Split by commas and clean up each part
  const parts = locationString.split(',').map(part => part.trim());
  
  // Common country patterns
  const countryPatterns = [
    /United Kingdom/i,
    /France/i,
    /Italy/i,
    /Spain/i,
    /Germany/i,
    /Netherlands/i,
    /Belgium/i,
    /Austria/i,
    /Switzerland/i,
    /Portugal/i,
    /Greece/i,
    /Czech Republic/i,
    /Hungary/i,
    /Poland/i,
    /Japan/i,
    /China/i,
    /India/i,
    /Australia/i,
    /Canada/i,
    /USA/i,
    /United States/i
  ];

  // Find country
  let country = '';
  for (const part of parts) {
    for (const pattern of countryPatterns) {
      if (pattern.test(part)) {
        country = part.match(pattern)?.[0] || '';
        break;
      }
    }
    if (country) break;
  }

  // Major city patterns to look for
  const cityPatterns = [
    { name: 'Paris', variants: ['paris', '75001', '75002', '75003', '75004', '75005', '75006', '75007', '75008', '75009', '75010', '75011', '75012', '75013', '75014', '75015', '75016', '75017', '75018', '75019', '75020'] },
    { name: 'London', variants: ['london', 'soho', 'bloomsbury', 'camden', 'chelsea', 'kensington', 'notting hill', 'greenwich', 'knightsbridge', 'mayfair', 'covent garden'] },
    { name: 'Rome', variants: ['rome', 'roma', 'vatican', 'trastevere', 'colosseum'] },
    { name: 'Barcelona', variants: ['barcelona', 'barcelone', 'eixample', 'gothic quarter'] },
    { name: 'Madrid', variants: ['madrid', 'sol', 'malasaña', 'chueca'] },
    { name: 'Amsterdam', variants: ['amsterdam', 'jordaan', 'centrum'] },
    { name: 'Berlin', variants: ['berlin', 'mitte', 'kreuzberg', 'charlottenburg'] },
    { name: 'Vienna', variants: ['vienna', 'wien'] },
    { name: 'Prague', variants: ['prague', 'praha'] },
    { name: 'Florence', variants: ['florence', 'firenze'] },
    { name: 'Venice', variants: ['venice', 'venezia'] },
    { name: 'Milan', variants: ['milan', 'milano'] },
    { name: 'Munich', variants: ['munich', 'münchen'] },
    { name: 'Brussels', variants: ['brussels', 'bruxelles'] },
    { name: 'Zurich', variants: ['zurich', 'zürich'] },
    { name: 'Geneva', variants: ['geneva', 'genève'] },
    { name: 'Lisbon', variants: ['lisbon', 'lisboa'] },
    { name: 'Athens', variants: ['athens', 'athina'] },
    { name: 'Budapest', variants: ['budapest'] },
    { name: 'Warsaw', variants: ['warsaw', 'warszawa'] },
    { name: 'Tokyo', variants: ['tokyo', 'shibuya', 'shinjuku', 'harajuku'] },
    { name: 'New York', variants: ['new york', 'manhattan', 'brooklyn', 'queens'] },
    { name: 'Los Angeles', variants: ['los angeles', 'hollywood', 'beverly hills'] },
    { name: 'San Francisco', variants: ['san francisco', 'sf'] },
    { name: 'Sydney', variants: ['sydney', 'bondi'] },
    { name: 'Melbourne', variants: ['melbourne'] },
    { name: 'Toronto', variants: ['toronto'] },
    { name: 'Vancouver', variants: ['vancouver'] }
  ];

  // Find city
  let city = '';
  for (const cityPattern of cityPatterns) {
    for (const variant of cityPattern.variants) {
      if (parts.some(part => part.toLowerCase().includes(variant.toLowerCase()))) {
        city = cityPattern.name;
        break;
      }
    }
    if (city) break;
  }

  // If no city found using patterns, try to extract from first meaningful part
  if (!city) {
    for (const part of parts) {
      // Skip postcodes, street names, and other noise
      if (!/^\d+/.test(part) && 
          !/street|road|avenue|rue|via|str|plaza|square/i.test(part) &&
          part.length > 2) {
        city = part;
        break;
      }
    }
  }

  // Set default country based on city if not found
  if (!country && city) {
    const cityCountryMap: Record<string, string> = {
      'Paris': 'France',
      'London': 'United Kingdom',
      'Rome': 'Italy',
      'Barcelona': 'Spain',
      'Madrid': 'Spain',
      'Amsterdam': 'Netherlands',
      'Berlin': 'Germany',
      'Vienna': 'Austria',
      'Prague': 'Czech Republic',
      'Florence': 'Italy',
      'Venice': 'Italy',
      'Milan': 'Italy',
      'Munich': 'Germany',
      'Brussels': 'Belgium',
      'Zurich': 'Switzerland',
      'Geneva': 'Switzerland',
      'Lisbon': 'Portugal',
      'Athens': 'Greece',
      'Budapest': 'Hungary',
      'Warsaw': 'Poland',
      'Tokyo': 'Japan',
      'New York': 'United States',
      'Los Angeles': 'United States',
      'San Francisco': 'United States',
      'Sydney': 'Australia',
      'Melbourne': 'Australia',
      'Toronto': 'Canada',
      'Vancouver': 'Canada'
    };
    country = cityCountryMap[city] || '';
  }

  // Format the result
  if (city && country) {
    return `${city}, ${country}`;
  } else if (city) {
    return city;
  } else if (country) {
    return country;
  } else {
    // Last fallback - try to get something meaningful from the original string
    const cleanParts = parts.filter(part => 
      part.length > 2 && 
      !/^\d+$/.test(part) && 
      !/^[A-Z]{1,3}\d/.test(part)
    );
    return cleanParts.length > 0 ? cleanParts[0] : 'Unknown Location';
  }
}; 