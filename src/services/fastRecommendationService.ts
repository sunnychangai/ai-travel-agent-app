import { openaiService } from './openaiService';
import { googleMapsService } from './googleMapsService';
import { tripAdvisorService } from './tripAdvisorService';
import { unifiedApiCache } from './unifiedApiCacheService';

// Add performance logging for monitoring
const logPerformance = (operation: string, startTime: number) => {
  const duration = Date.now() - startTime;
  console.log(`Fast recommendation ${operation} took ${duration}ms`);
};

export interface FastRecommendationOptions {
  location: string;
  type: 'restaurants' | 'activities' | 'hotels' | 'general';
  userPreferences?: {
    interests?: string[];
    dietaryPreferences?: string[];
    budget?: string;
  };
  limit?: number;
}

export interface FastRecommendation {
  name: string;
  description: string;
  location?: string;
  rating?: number;
  priceRange?: string;
  category?: string;
  tip?: string;
}

export const fastRecommendationService = {
  /**
   * Clear the recommendation cache (useful for testing new formats)
   */
  async clearCache() {
    await unifiedApiCache.clearNamespaceCache('recommendations-api');
    console.log('Fast recommendation cache cleared');
  },

  /**
   * Infer cuisine type from restaurant name
   */
  getCuisineAndDescription(restaurantName: string): { cuisine: string; description: string } {
    const name = restaurantName.toLowerCase();
    
    // Define cuisine patterns
    const cuisinePatterns = [
      {
        patterns: ['seafood', 'navy', 'beach', 'ocean', 'fish', 'lobster', 'crab', 'oyster'],
        cuisine: '🦞 Seafood'
      },
      {
        patterns: ['pancake', 'breakfast', 'brunch', 'diner', 'cafe'],
        cuisine: '🥞 American Breakfast'
      },
      {
        patterns: ['grill', 'steakhouse', 'chophouse', 'tavern', 'pub'],
        cuisine: '🥩 American Grill'
      },
      {
        patterns: ['surf', 'beach', 'coastal', 'waterfront'],
        cuisine: '🏄 Coastal Dining'
      },
      {
        patterns: ['inn', 'house', 'lodge', 'club'],
        cuisine: '🏠 American Cuisine'
      },
      {
        patterns: ['pizza', 'italian', 'lombardi', 'trattoria', 'romano'],
        cuisine: '🍕 Italian'
      },
      {
        patterns: ['sushi', 'japanese', 'jiro', 'ramen', 'ichiran'],
        cuisine: '🍣 Japanese'
      },
      {
        patterns: ['indian', 'curry', 'tandoor', 'masala', 'bombay'],
        cuisine: '🍛 Indian'
      },
      {
        patterns: ['chinese', 'asian', 'thai', 'vietnamese'],
        cuisine: '🥡 Asian'
      },
      {
        patterns: ['mexican', 'taco', 'burrito', 'cantina'],
        cuisine: '🌮 Mexican'
      },
      {
        patterns: ['french', 'bistro', 'brasserie'],
        cuisine: '🇫🇷 French'
      },
      {
        patterns: ['british', 'english', 'fish and chips'],
        cuisine: '🇬🇧 British'
      },
      {
        patterns: ['deli', 'delicatessen', 'sandwich', 'katz'],
        cuisine: '🥪 Deli'
      },
      {
        patterns: ['bar', 'lounge', 'cocktail'],
        cuisine: '🍸 Bar & Grill'
      }
    ];

    // Find matching cuisine
    for (const pattern of cuisinePatterns) {
      if (pattern.patterns.some(p => name.includes(p))) {
        return {
          cuisine: pattern.cuisine,
          description: '' // We removed descriptions
        };
      }
    }

    // Smart fallback based on restaurant type keywords
    if (name.includes('restaurant') || name.includes('dining')) {
      return { cuisine: '🍽️ Fine Dining', description: '' };
    }
    
    if (name.includes('bar') || name.includes('pub')) {
      return { cuisine: '🍺 Gastropub', description: '' };
    }

    // Final fallback
    return {
      cuisine: '🍽️ Restaurant',
      description: ''
    };
  },

  /**
   * Get fast restaurant recommendations using ONLY Google Maps API
   */
  async getRestaurantRecommendations(options: FastRecommendationOptions): Promise<string> {
    // Include version in cache key to ensure new format is used
    const cacheKey = `restaurants-googlemaps-v5-${options.location}-${JSON.stringify(options.userPreferences)}`;
    const cached = await unifiedApiCache.get<string>('recommendations-api', cacheKey);
    if (cached) {
      return cached;
    }

    console.log(`🍽️ Getting restaurant recommendations for ${options.location} using Google Maps API only`);

    try {
      // Get coordinates for the location
      const coordinates = await googleMapsService.geocodeAddress(options.location);
      
      // Search for restaurants using Google Maps API ONLY
      const restaurants = await googleMapsService.searchNearbyRestaurants(
        coordinates,
        1500, // 1.5km radius for better coverage
        options.userPreferences?.dietaryPreferences?.[0]
      );

      if (restaurants.length === 0) {
        console.log(`No restaurants found via Google Maps API for ${options.location}`);
        const fallbackResponse = `I couldn't find specific restaurant data for ${options.location} through Google Maps, but I'd recommend checking out local food markets, trying traditional local cuisine, and asking locals for their favorite spots!`;
        await unifiedApiCache.set('recommendations-api', cacheKey, fallbackResponse);
        return fallbackResponse;
      }

      console.log(`Found ${restaurants.length} restaurants via Google Maps API for ${options.location}`);

      // Format top 3-5 restaurants with enhanced info
      const topRestaurants = restaurants.slice(0, Math.min(5, restaurants.length));
      let response = `🍽️ **Top restaurants in ${options.location} (via Google Maps):**\n\n`;
      
      topRestaurants.forEach((restaurant, index) => {
        const rating = restaurant.rating ? `⭐ ${restaurant.rating}` : '';
        const priceLevel = restaurant.price_level ? '💰'.repeat(restaurant.price_level) : '';
        const userRatings = restaurant.user_ratings_total ? `(${restaurant.user_ratings_total} reviews)` : '';
        
        // Infer cuisine type (without description)
        const cuisineInfo = this.getCuisineAndDescription(restaurant.name);
        
        // Create Google Maps link for the address
        const address = restaurant.formatted_address || restaurant.vicinity || '';
        const encodedAddress = encodeURIComponent(address);
        const mapsLink = address ? `[${address}](https://www.google.com/maps/search/?api=1&query=${encodedAddress})` : '';
        
        response += `**${index + 1}. ${restaurant.name}**\n`;
        response += `${rating} ${userRatings} ${priceLevel}\n`;
        response += `${cuisineInfo.cuisine}\n`;
        response += `📍 ${mapsLink}\n`;
        response += '\n';
      });

      response += `💡 **Tip:** All recommendations are sourced from Google Maps. Call ahead to check availability and make reservations!`;

      await unifiedApiCache.set('recommendations-api', cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error getting restaurant recommendations from Google Maps:', error);
      
      // Fallback that clearly states it's not using external APIs
      const fallbackResponse = `I encountered an issue accessing restaurant data for ${options.location}. This might be due to API limitations. I'd recommend:

🍽️ **General dining suggestions for ${options.location}:**
• Look for highly-rated restaurants on Google Maps directly
• Ask locals for their favorite dining spots
• Check recent reviews on travel websites
• Explore the main dining district or downtown area

Would you like me to help you with something else, or would you prefer to search for restaurants directly on Google Maps?`;
      
      await unifiedApiCache.set('recommendations-api', cacheKey, fallbackResponse);
      return fallbackResponse;
    }
  },

  /**
   * Get fast activity recommendations using TripAdvisor + minimal AI
   */
  async getActivityRecommendations(options: FastRecommendationOptions): Promise<string> {
    const cacheKey = `activities-${options.location}-${JSON.stringify(options.userPreferences)}`;
    const cached = await unifiedApiCache.get<string>('recommendations-api', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Search for attractions
      const attractions = await tripAdvisorService.searchLocations(options.location, 'attractions');

      if (attractions.length === 0) {
        const fallbackResponse = `I couldn't find specific attraction data for ${options.location}, but I'd recommend exploring the city center, visiting local museums, parks, and famous landmarks!`;
        await unifiedApiCache.set('recommendations-api', cacheKey, fallbackResponse);
        return fallbackResponse;
      }

      // Format top 3 attractions with concise info
      const topAttractions = attractions.slice(0, 3);
      let response = `🎯 **Top things to do in ${options.location}:**\n\n`;
      
      topAttractions.forEach((attraction, index) => {
        const rating = attraction.rating ? `⭐ ${attraction.rating}` : '';
        const reviews = attraction.num_reviews ? `(${attraction.num_reviews} reviews)` : '';
        const category = attraction.category?.name || 'Attraction';
        
        response += `**${index + 1}. ${attraction.name}**\n`;
        response += `${category} ${rating} ${reviews}\n`;
        if (attraction.description) {
          // Truncate long descriptions
          const shortDesc = attraction.description.length > 100 
            ? attraction.description.substring(0, 100) + '...' 
            : attraction.description;
          response += `${shortDesc}\n`;
        }
        response += '\n';
      });

      response += `💡 **Tip:** Check opening hours and book tickets online when possible!`;

      await unifiedApiCache.set('recommendations-api', cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error getting activity recommendations:', error);
      
      // Fast fallback using minimal AI
      const fallbackResponse = await this.getFallbackRecommendation(options);
      await unifiedApiCache.set('recommendations-api', cacheKey, fallbackResponse);
      return fallbackResponse;
    }
  },

  /**
   * Get fast hotel recommendations (simplified for now)
   */
  async getHotelRecommendations(options: FastRecommendationOptions): Promise<string> {
    const cacheKey = `hotels-${options.location}`;
    const cached = await unifiedApiCache.get<string>('recommendations-api', cacheKey);
    if (cached) {
      return cached;
    }

    // For now, provide general hotel advice - can be enhanced with hotel API later
    const response = `🏨 **Where to stay in ${options.location}:**

For the best experience, I recommend:
• **City Center** - Close to attractions and transport
• **Business District** - Modern hotels, good connectivity  
• **Historic Quarter** - Unique character and charm

💡 **Tip:** Book on Booking.com, Hotels.com, or directly with hotels for best rates!

Would you like specific hotel recommendations? I can help you search for hotels in a particular area or price range.`;

    await unifiedApiCache.set('recommendations-api', cacheKey, response);
    return response;
  },

  /**
   * Fast fallback recommendation using minimal OpenAI call
   * NOTE: For restaurants, we should always try Google Maps first
   */
  async getFallbackRecommendation(options: FastRecommendationOptions): Promise<string> {
    try {
      if (options.type === 'restaurants') {
        console.log(`⚠️ Restaurant fallback triggered for ${options.location} - this should use Google Maps instead`);
        
        // For restaurant fallbacks, provide clear guidance that we prefer Google Maps
        return `I encountered an issue getting restaurant data for ${options.location} from Google Maps. Here are some general suggestions:

🍽️ **Restaurant recommendations for ${options.location}:**
• Check Google Maps directly for highly-rated restaurants
• Look for local specialties and cuisine types
• Ask locals or hotel concierge for their favorites
• Check recent reviews online before visiting

Would you like me to try getting restaurant recommendations again, or help you with something else?`;
      }

      // For other types, use the original format
      const prompt = `Give 3 brief ${options.type} recommendations for ${options.location}. Keep it concise - just name, one sentence description, and one tip. Format as a short bulleted list.`;
      
      const response = await openaiService.generateChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-3.5-turbo', // Faster model
        temperature: 0.7,
        max_tokens: 300 // Limit response length
      });

      return response.choices[0].message.content || `I'd be happy to help you find ${options.type} in ${options.location}! Could you be more specific about what you're looking for?`;
    } catch (error) {
      console.error('Error in fallback recommendation:', error);
      return `I'd be happy to help you find ${options.type} in ${options.location}! Could you be more specific about what you're looking for?`;
    }
  },

  /**
   * Main entry point for fast recommendations
   */
  async getRecommendations(options: FastRecommendationOptions): Promise<string> {
    const startTime = Date.now();
    console.log(`Getting fast ${options.type} recommendations for ${options.location}`);
    
    // SPECIAL HANDLING: For restaurants, ensure we ONLY use Google Maps
    if (options.type === 'restaurants') {
      console.log(`🚫 Restaurant request detected - forcing Google Maps API only for ${options.location}`);
      return await this.getRestaurantRecommendations(options);
    }
    
    try {
      let result: string;
      
      switch (options.type) {
        case 'activities':
          result = await this.getActivityRecommendations(options);
          break;
        case 'hotels':
          result = await this.getHotelRecommendations(options);
          break;
        case 'general':
          // For general, provide a quick overview
          result = `Here are some quick suggestions for ${options.location}:

🍽️ **Food**: I can get restaurant recommendations using Google Maps - just ask!
🎯 **Activities**: Visit main attractions, walk historic areas, explore local markets
🏨 **Stay**: City center for convenience, local neighborhoods for authentic experience

What specifically would you like to know more about?`;
          break;
        default:
          result = await this.getFallbackRecommendation(options);
      }
      
      logPerformance(`${options.type} for ${options.location}`, startTime);
      return result;
    } catch (error) {
      console.error('Error in fast recommendations:', error);
      logPerformance(`ERROR ${options.type} for ${options.location}`, startTime);
      return this.getFallbackRecommendation(options);
    }
  }
}; 