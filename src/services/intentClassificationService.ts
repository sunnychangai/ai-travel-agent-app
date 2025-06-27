import { openaiService } from './openaiService';
import { withRetry } from '../utils/apiUtils';

// Intent types
export enum ChatIntent {
  NEW_ITINERARY = 'NEW_ITINERARY',
  MODIFY_EXISTING = 'MODIFY_EXISTING',
  GET_RECOMMENDATIONS = 'GET_RECOMMENDATIONS',
  ASK_QUESTIONS = 'ASK_QUESTIONS',
  GENERAL_CHAT = 'GENERAL_CHAT'
}

// Parameters that can be extracted for each intent
export interface IntentParameters {
  destination?: string;
  dates?: {
    start?: string;
    end?: string;
  };
  modificationDetails?: {
    day?: number;
    activity?: string;
    type?: 'add' | 'remove' | 'replace' | 'modify';
  };
  recommendationType?: 'restaurants' | 'activities' | 'hotels' | 'general';
  location?: string;
  cuisineType?: string;
  dietaryPreferences?: string[];
  priceRange?: string;
  specificType?: string;
  question?: {
    type: 'logistics' | 'culture' | 'weather' | 'transportation' | 'other';
    specificTopic?: string;
  };
}

// Classification result
export interface IntentClassification {
  intent: ChatIntent;
  confidence: number;
  parameters: IntentParameters;
}

export const intentClassificationService = {
  /**
   * Extract cuisine type and specific preferences from a message
   */
  extractCuisineAndPreferences(message: string): {
    cuisineType?: string;
    dietaryPreferences?: string[];
    priceRange?: string;
    specificType?: string;
  } {
    const messageL = message.toLowerCase();
    
    // Cuisine type patterns
    const cuisineTypes = [
      'chinese', 'italian', 'mexican', 'indian', 'japanese', 'thai', 'french',
      'american', 'korean', 'vietnamese', 'spanish', 'greek', 'turkish',
      'mediterranean', 'lebanese', 'moroccan', 'brazilian', 'german',
      'british', 'irish', 'russian', 'ethiopian', 'peruvian', 'argentinian'
    ];
    
    const specificTypes = [
      'pizza', 'burger', 'sushi', 'ramen', 'taco', 'bbq', 'steakhouse',
      'seafood', 'fast food', 'fine dining', 'casual dining', 'buffet',
      'bakery', 'cafe', 'coffee shop', 'bar', 'pub', 'deli'
    ];
    
    const dietaryPrefs = [
      'vegetarian', 'vegan', 'gluten free', 'halal', 'kosher', 'organic',
      'healthy', 'low carb', 'keto'
    ];
    
    const priceRanges = [
      'cheap', 'budget', 'affordable', 'expensive', 'upscale', 'fine dining',
      'high end', 'luxury', 'mid range', 'moderate'
    ];
    
    let cuisineType: string | undefined;
    let specificType: string | undefined;
    let dietaryPreferences: string[] = [];
    let priceRange: string | undefined;
    
    // Extract cuisine type
    for (const cuisine of cuisineTypes) {
      if (messageL.includes(cuisine)) {
        cuisineType = cuisine;
        break;
      }
    }
    
    // Extract specific type
    for (const type of specificTypes) {
      if (messageL.includes(type)) {
        specificType = type;
        break;
      }
    }
    
    // Extract dietary preferences
    for (const pref of dietaryPrefs) {
      if (messageL.includes(pref)) {
        dietaryPreferences.push(pref);
      }
    }
    
    // Extract price range
    for (const price of priceRanges) {
      if (messageL.includes(price)) {
        priceRange = price;
        break;
      }
    }
    
    console.log(`🍽️ Extracted preferences from "${message}":`, {
      cuisineType,
      specificType,
      dietaryPreferences,
      priceRange
    });
    
    return {
      cuisineType,
      specificType,
      dietaryPreferences: dietaryPreferences.length > 0 ? dietaryPreferences : undefined,
      priceRange
    };
  },

  /**
   * Extract location from a message using pattern matching
   */
  extractLocation(message: string): string | undefined {
    // More precise location patterns
    const locationPatterns = [
      // "in [City]" patterns
      /\b(?:in|at)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*[\?,!.]|$)/i,
      // "to [City]" patterns
      /\b(?:to|visit|travel\s+to|go\s+to)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*[\?,!.]|$)/i,
      // Location before activity words
      /\b([A-Za-z]+(?:\s+[A-Za-z]+)*?)\s+(?:restaurant|food|activities|attractions|hotels?)\b/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        let location = match[1].trim();
        
        // Clean up common prefixes/suffixes that get captured
        location = location.replace(/^(should|could|can|would|will|are|is|do|you|i|we|they|have|has|get|find|some|any|good|best|nice|great|the|a|an)\s+/i, '');
        location = location.replace(/\s+(should|could|can|would|will|are|is|do|you|i|we|they|have|has|get|find|some|any|good|best|nice|great|the|a|an)$/i, '');
        
        // Filter out common non-location words and ensure minimum length
        const nonLocationWords = ['should', 'could', 'can', 'would', 'will', 'are', 'is', 'do', 'you', 'i', 'we', 'they', 'have', 'has', 'get', 'find', 'some', 'any', 'good', 'best', 'nice', 'great', 'the', 'a', 'an', 'what', 'where', 'when', 'how', 'why'];
        
        if (!nonLocationWords.includes(location.toLowerCase()) && location.length > 2 && /^[A-Za-z\s]+$/.test(location)) {
          return location;
        }
      }
    }
    
    return undefined;
  },

  /**
   * Pre-process message for common recommendation patterns
   */
  preProcessRecommendationPatterns(message: string, context: { currentDestination?: string }): IntentClassification | null {
    const messageL = message.toLowerCase();
    
    // Restaurant recommendation patterns (enhanced with meal terms)
    const restaurantPatterns = [
      /where.*(?:should|can|could).*(?:eat|dine|restaurant|food|lunch|breakfast|dinner|brunch)/i,
      /(?:what|which).*(?:restaurant|food|place.*eat|dine|lunch|breakfast|dinner|brunch)/i,
      /(?:recommend|suggest).*(?:restaurant|food|place.*eat|dine|lunch|breakfast|dinner|brunch)/i,
      /(?:best|good).*(?:restaurant|food|place.*eat|dine|lunch|breakfast|dinner|brunch)/i,
      /where.*(?:to\s+)?(?:eat|dine|get\s+(?:food|lunch|breakfast|dinner|brunch)|grab\s+(?:lunch|breakfast|dinner|brunch))/i,
      /where.*(?:should|can|could).*(?:get|have|grab).*(?:lunch|breakfast|dinner|brunch)/i,
      /(?:lunch|breakfast|dinner|brunch).*(?:place|spot|recommendation)/i
    ];

    // Activity/attraction recommendation patterns  
    const activityPatterns = [
      /where.*(?:should|can|could).*(?:visit|go|see)/i,
      /(?:what|which).*(?:do|see|visit).*(?:in|at)/i,
      /(?:things|stuff).*(?:to\s+)?(?:do|see)/i,
      /(?:recommend|suggest).*(?:activities|attractions|things.*do)/i,
      /(?:best|good).*(?:activities|attractions|things.*do)/i,
      /what.*(?:activities|attractions)/i
    ];

    // General location-based recommendation patterns
    const generalLocationPatterns = [
      /(?:what|where).*(?:should|can).*(?:in|at)\s+([A-Za-z\s]+)/i,
      /(?:recommend|suggest).*(?:in|at)\s+([A-Za-z\s]+)/i
    ];

    const extractedLocation = this.extractLocation(message) || context.currentDestination;

    // Check restaurant patterns
    for (const pattern of restaurantPatterns) {
      if (pattern.test(message)) {
        // Extract cuisine and preferences for restaurant requests
        const preferences = this.extractCuisineAndPreferences(message);
        
        return {
          intent: ChatIntent.GET_RECOMMENDATIONS,
          confidence: 0.9,
          parameters: {
            recommendationType: 'restaurants',
            location: extractedLocation,
            destination: extractedLocation,
            ...preferences
          }
        };
      }
    }

    // Check activity patterns
    for (const pattern of activityPatterns) {
      if (pattern.test(message)) {
        return {
          intent: ChatIntent.GET_RECOMMENDATIONS,
          confidence: 0.9,
          parameters: {
            recommendationType: 'activities',
            location: extractedLocation,
            destination: extractedLocation
          }
        };
      }
    }

    // Hotel/accommodation recommendation patterns
    const hotelPatterns = [
      /where.*(?:should|can|could).*(?:stay|sleep|lodge)/i,
      /(?:what|which).*(?:hotel|accommodation|place.*stay)/i,
      /(?:recommend|suggest).*(?:hotel|accommodation|place.*stay)/i,
      /(?:best|good).*(?:hotel|accommodation|place.*stay)/i
    ];

    // Check hotel patterns
    for (const pattern of hotelPatterns) {
      if (pattern.test(message)) {
        return {
          intent: ChatIntent.GET_RECOMMENDATIONS,
          confidence: 0.9,
          parameters: {
            recommendationType: 'hotels',
            location: extractedLocation,
            destination: extractedLocation
          }
        };
      }
    }

    // Check general location patterns
    for (const pattern of generalLocationPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          intent: ChatIntent.GET_RECOMMENDATIONS,
          confidence: 0.8,
          parameters: {
            recommendationType: 'general',
            location: extractedLocation,
            destination: extractedLocation
          }
        };
      }
    }

    return null;
  },

  /**
   * Classify the user's message intent using pattern matching + OpenAI
   */
  async classifyIntent(message: string, context: { 
    hasExistingItinerary: boolean;
    currentDestination?: string;
  }): Promise<IntentClassification> {
    
    // First, try pre-processing with pattern matching for common cases
    const preProcessedResult = this.preProcessRecommendationPatterns(message, context);
    if (preProcessedResult) {
      console.log('Intent classified using pattern matching:', preProcessedResult);
      return preProcessedResult;
    }

    // Enhanced OpenAI classification prompt
    const classificationPrompt = `
Analyze the following user message in the context of a travel planning conversation:

"${message}"

Context:
- User ${context.hasExistingItinerary ? 'has' : 'does not have'} an existing itinerary
${context.currentDestination ? `- Current destination being discussed: ${context.currentDestination}` : ''}

Classification Rules:
1. NEW_ITINERARY - When user explicitly asks to create/plan a new trip/itinerary
2. MODIFY_EXISTING - When user wants to change something in their current itinerary
3. GET_RECOMMENDATIONS - When user asks about:
   - Things to do/activities/attractions
   - Places to visit
   - Restaurants/food/dining ("where should I eat", "best restaurants", "food recommendations")
   - Hotels/accommodation
   - Shopping/entertainment
   - Day trips/tours
   - Any "what/where/which" questions about specific types of places or activities
4. ASK_QUESTIONS - When user asks about:
   - Travel logistics (how to get somewhere, transport options)
   - Cultural information
   - Weather
   - General travel advice
   - Any "how/why/when" questions about travel processes
5. GENERAL_CHAT - Greetings, thank you, or very general conversation

CRITICAL RULES:
- "Where should I eat in [location]?" = GET_RECOMMENDATIONS with recommendationType: "restaurants"
- "What should I do in [location]?" = GET_RECOMMENDATIONS with recommendationType: "activities"  
- "Where should I stay in [location]?" = GET_RECOMMENDATIONS with recommendationType: "hotels"
- Questions about "what to do" or "things to do" should ALWAYS be classified as GET_RECOMMENDATIONS
- If the message mentions both a specific location and activities/things to do, classify as GET_RECOMMENDATIONS
- When in doubt between ASK_QUESTIONS and GET_RECOMMENDATIONS, prefer GET_RECOMMENDATIONS if the user is asking about places or activities

CRITICAL DATE RANGE PARSING RULES:
- When parsing date ranges like "july 9-11", "august 2-4", "may 15-18", or "december 1-3":
  * The first number is the START date (e.g., "july 9-11" means START on July 9th)
  * The second number is the END date (e.g., "july 9-11" means END on July 11th)
  * "july 9-11" should be parsed as start: "2025-07-09", end: "2025-07-11"
  * "august 2-4" should be parsed as start: "2025-08-02", end: "2025-08-04"
  * "may 15-18" should be parsed as start: "2025-05-15", end: "2025-05-18"
- When parsing phrases like "from july 9 to 11" or "from july 9-11":
  * This means START on July 9th and END on July 11th
  * NOT July 8th to July 10th
- Always interpret the numbers in date ranges as literal calendar dates, not as day counts or durations
- If specific dates are mentioned but without a year, assume the year is 2025
- All dates must be returned in YYYY-MM-DD format, with YYYY being at least 2025

EXAMPLES:
- "plan a trip to boston from july 9-11" → start: "2025-07-09", end: "2025-07-11"
- "visit paris may 15-18" → start: "2025-05-15", end: "2025-05-18"
- "go to tokyo from december 1 to 3" → start: "2025-12-01", end: "2025-12-03"

Return a JSON object in this format:
{
  "intent": "one of the intent categories",
  "confidence": "number between 0 and 1",
  "parameters": {
    "destination": "destination name if mentioned",
    "dates": {
      "start": "start date if mentioned in YYYY-MM-DD format",
      "end": "end date if mentioned in YYYY-MM-DD format"
    },
    "modificationDetails": {
      "day": "day number if mentioned",
      "activity": "activity to modify if mentioned",
      "type": "add/remove/replace/modify if clear"
    },
    "recommendationType": "restaurants/activities/hotels/general if asking for recommendations",
    "location": "specific location for recommendations if different from main destination",
    "question": {
      "type": "logistics/culture/weather/transportation/other for questions",
      "specificTopic": "specific topic being asked about"
    }
  }
}`;

    try {
      const response = await withRetry(() => openaiService.generateChatCompletion([
        { role: 'user', content: classificationPrompt }
      ], {
        model: 'gpt-3.5-turbo-1106',
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }));

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Enhanced post-processing
      const messageL = message.toLowerCase();
      
      // Override for restaurant queries that might be missed
      if (messageL.includes('eat') || messageL.includes('restaurant') || messageL.includes('food') || messageL.includes('dine') || 
          messageL.includes('lunch') || messageL.includes('breakfast') || messageL.includes('dinner') || messageL.includes('brunch')) {
        if (messageL.includes('where') || messageL.includes('what') || messageL.includes('recommend') || messageL.includes('get') || messageL.includes('have')) {
          const preferences = this.extractCuisineAndPreferences(message);
          result.intent = ChatIntent.GET_RECOMMENDATIONS;
          result.parameters = {
            ...result.parameters,
            recommendationType: 'restaurants',
            location: this.extractLocation(message) || result.parameters?.location || context.currentDestination,
            ...preferences
          };
        }
      }
      
      // Override for activity queries
      if ((messageL.includes('what') && (messageL.includes('to do') || messageL.includes('activities'))) ||
          (messageL.includes('things') && messageL.includes('do'))) {
        result.intent = ChatIntent.GET_RECOMMENDATIONS;
        result.parameters = {
          ...result.parameters,
          recommendationType: 'activities',
          location: this.extractLocation(message) || result.parameters?.location || context.currentDestination
        };
      }

      // Ensure location is extracted if not already present
      if (result.intent === ChatIntent.GET_RECOMMENDATIONS && !result.parameters?.location) {
        const extractedLocation = this.extractLocation(message);
        if (extractedLocation) {
          result.parameters = {
            ...result.parameters,
            location: extractedLocation,
            destination: extractedLocation
          };
        }
      }
      
      console.log('Intent classified using OpenAI:', result);
      return result as IntentClassification;
    } catch (error) {
      console.error('Error classifying intent:', error);
      
      // Enhanced fallback logic
      const messageL = message.toLowerCase();
      if (messageL.includes('eat') || messageL.includes('restaurant') || messageL.includes('food') || 
          messageL.includes('lunch') || messageL.includes('breakfast') || messageL.includes('dinner') || messageL.includes('brunch')) {
        const preferences = this.extractCuisineAndPreferences(message);
        return {
          intent: ChatIntent.GET_RECOMMENDATIONS,
          confidence: 0.6,
          parameters: {
            recommendationType: 'restaurants',
            location: this.extractLocation(message) || context.currentDestination,
            ...preferences
          }
        };
      }
      
      if (messageL.includes('do') || messageL.includes('visit') || messageL.includes('see')) {
        return {
          intent: ChatIntent.GET_RECOMMENDATIONS,
          confidence: 0.6,
          parameters: {
            recommendationType: 'activities',
            location: this.extractLocation(message) || context.currentDestination
          }
        };
      }
      
      // Default fallback
      return {
        intent: ChatIntent.GENERAL_CHAT,
        confidence: 0.5,
        parameters: {}
      };
    }
  }
}; 