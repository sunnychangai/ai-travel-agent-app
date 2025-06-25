import { OpenAI } from 'openai';
import { tripAdvisorService } from './tripAdvisorService';
import { googleMapsService } from './googleMapsService';
import { agentRules } from '../config/agentRules';
import { ApiCache } from '../utils/cacheUtils';
import { withRetry, ApiError } from '../utils/apiUtils';

/**
 * Manages a group of API requests that should be aborted together
 * Useful for component unmount scenarios
 */
export class RequestManager {
  private abortControllers: AbortController[] = [];
  private timeoutIds: NodeJS.Timeout[] = [];
  
  /**
   * Creates a new AbortController and adds it to the manager
   * @param timeoutMs Optional timeout in milliseconds
   */
  createSignal(timeoutMs?: number): AbortSignal {
    const controller = new AbortController();
    this.abortControllers.push(controller);
    
    if (timeoutMs) {
      const timeoutId = setTimeout(() => {
        this.abortControllers = this.abortControllers.filter(c => c !== controller);
        controller.abort();
      }, timeoutMs);
      this.timeoutIds.push(timeoutId);
    }
    
    return controller.signal;
  }
  
  /**
   * Aborts all managed requests
   */
  abortAll(): void {
    // Clear any pending timeouts
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];
    
    // Abort all controllers
    this.abortControllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    this.abortControllers = [];
  }
}

// Initialize OpenAI client
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  console.warn('OpenAI API key missing. Check your .env file.');
}

const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true // Note: In production, you should use a backend proxy
});

// Create a response cache with expiration
const responseCache = new ApiCache<any>('OpenAI', 60 * 60 * 1000); // 1 hour cache duration

// Custom error class for OpenAI service
export class OpenAIServiceError extends ApiError {
  constructor(message: string, options: { 
    status?: number; 
    isNetworkError?: boolean;
    isRateLimitError?: boolean;
  } = {}) {
    super(message, options);
    this.name = 'OpenAIServiceError';
  }
}

// Utility function for development logging
const logDev = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

// Function to call OpenAI API with retry logic
async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffFactor: 2,
    shouldRetry: (error) => {
      // Retry on network errors, rate limit errors, and certain OpenAI API errors
      if (error instanceof ApiError) {
        return (
          error.isNetworkError || 
          error.isRateLimitError || 
          error.status === 502 || // Bad Gateway
          error.status === 503 || // Service Unavailable
          error.status === 504    // Gateway Timeout
        );
      }
      
      // Also retry on generic OpenAI timeouts or capacity errors
      if (error.message && (
        error.message.includes('timeout') || 
        error.message.includes('capacity') ||
        error.message.includes('rate limit')
      )) {
        return true;
      }
      
      return false;
    }
  });
}

// Create an interface for itinerary manipulation functions
// This will be populated by the application
interface ItineraryInterface {
  createMockItinerary?: (
    destination: string,
    startDate: string,
    endDate: string,
    activities: Array<{
      title: string;
      description: string;
      location: string;
      time: string;
      type: string;
      dayNumber: number;
      imageUrl?: string;
      id?: string; // Make id optional to match the types/index.ts definition
    }>
  ) => Promise<{ success: boolean; message: string }>; // Make it return a Promise to match implementation
  
  addItineraryActivity?: (
    dayNumber: number,
    activity: {
      title: string;
      description: string;
      location: string;
      time: string;
      type: string;
      imageUrl?: string;
    }
  ) => { success: boolean; message: string };
  
  getCurrentItinerary?: () => any[];
  
  itineraryDays?: any[];
}

// Initialize with empty functions that will be replaced
export const agentItineraryInterface: ItineraryInterface = {
  createMockItinerary: undefined,
  addItineraryActivity: undefined,
  getCurrentItinerary: undefined,
  itineraryDays: undefined
};

// Function to set up the itinerary interface
export const setupItineraryInterface = (
  itineraryFunctions: ItineraryInterface
) => {
  // Copy functions to our interface
  Object.assign(agentItineraryInterface, itineraryFunctions);
};

export const openaiService = {
  /**
   * Creates a new request manager for handling multiple API requests
   * @returns A new RequestManager instance
   */
  createRequestManager(): RequestManager {
    return new RequestManager();
  },

  /**
   * Generate a chat completion using OpenAI's API with caching
   */
  async generateChatCompletion(messages: any[], options: any = {}) {
    try {
      // Add system prompt from agentRules if no system message is present
      const hasSystemMessage = messages.some(message => message.role === 'system');
      const updatedMessages = hasSystemMessage 
        ? [...messages] 
        : [{ role: "system", content: agentRules.systemPrompt }, ...messages];
      
      // Create a cache key based on messages and important options
      const cacheKeyObj = {
        messages: updatedMessages,
        model: options.model || "gpt-4-turbo-preview",
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        // Don't include signal in cache key
      };
      const cacheKey = JSON.stringify(cacheKeyObj);
      
      // Check cache first
      const cachedResponse = responseCache.get(cacheKey);
      if (cachedResponse && !options.skipCache) {
        logDev('Using cached OpenAI response');
        return cachedResponse;
      }
      
      // Extract AbortSignal if present
      const { signal, ...restOptions } = options;
      
      // Make API call with retry logic
      const response = await callWithRetry(() => openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: updatedMessages,
        temperature: 0.7,
        max_tokens: 1000,
        ...restOptions,
        signal, // Pass signal for abort support
      }));
      
      // Cache the successful response
      responseCache.set(cacheKey, response);
      
      return response;
    } catch (error: any) {
      // Don't log AbortError as an error since it's expected
      if (error.name === 'AbortError') {
        logDev('OpenAI request was aborted');
        throw error;
      }
      
      console.error('Error generating chat completion:', error);
      throw error;
    }
  },

  /**
   * Generate a travel itinerary suggestion
   */
  async generateTravelSuggestion(destination: string, duration: number, interests: string[], signal?: AbortSignal) {
    const prompt = `Create a ${duration}-day travel itinerary for ${destination}. 
    The traveler is interested in: ${interests.join(', ')}.
    Format the response as a structured itinerary with daily activities.`;
    
    const messages = [
      { role: "system", content: agentRules.systemPrompt },
      { role: "user", content: prompt }
    ];
    
    return this.generateChatCompletion(messages, { signal });
  },

  /**
   * Generate attraction recommendations using TripAdvisor data
   */
  async generateAttractionRecommendations(destination: string, interests: string[], signal?: AbortSignal) {
    try {
      // If no destination, return early with error
      if (!destination) {
        throw new Error('Destination is required for attraction recommendations');
      }
      
      // Search for attractions on TripAdvisor
      const attractions = await tripAdvisorService.searchLocations(destination, 'attractions');
      
      // If no attractions found, handle gracefully
      if (!attractions || attractions.length === 0) {
        return this.generateChatCompletion([
          { role: "system", content: agentRules.systemPrompt },
          { role: "user", content: `I'm looking for attractions in ${destination}` },
          { role: "system", content: `No attractions data found for ${destination}. Suggest some general attractions based on your knowledge.` }
        ], { signal });
      }
      
      // Format attractions data for the prompt - limit to top 5 for efficiency
      const attractionsData = attractions.slice(0, 5).map(attraction => ({
        name: attraction.name,
        description: attraction.description || 'No description available',
        rating: attraction.rating || 'No rating available',
        num_reviews: attraction.num_reviews || 0,
        category: attraction.category?.name || 'Attraction'
      }));
      
      const prompt = `Based on the following TripAdvisor attractions in ${destination} and the traveler's interests (${interests.join(', ')}), 
      recommend the top 3 attractions they should visit and explain why each is a good match for their interests.
      
      TripAdvisor Attractions:
      ${JSON.stringify(attractionsData, null, 2)}
      
      Provide your recommendations in a structured format with the name of each attraction and a brief explanation of why it's recommended.`;
      
      const messages = [
        { role: "system", content: agentRules.systemPrompt },
        { role: "user", content: prompt }
      ];
      
      return this.generateChatCompletion(messages, { signal });
    } catch (error) {
      console.error('Error generating attraction recommendations:', error);
      
      // Fallback to general recommendations if API fails
      return this.generateChatCompletion([
        { role: "system", content: agentRules.systemPrompt },
        { role: "user", content: `I'm looking for attractions in ${destination} related to: ${interests.join(', ')}` }
      ], { signal });
    }
  },

  /**
   * Generate restaurant recommendations using Google Maps data
   */
  async generateRestaurantRecommendations(destination: string, cuisinePreferences: string[]) {
    try {
      // First geocode the destination to get coordinates
      const coordinates = await googleMapsService.geocodeAddress(destination);
      
      // Search for restaurants on Google Maps
      const restaurants = await googleMapsService.searchNearbyRestaurants(
        coordinates,
        1500,
        cuisinePreferences.length > 0 ? cuisinePreferences[0] : undefined
      );
      
      // Format restaurant data for the prompt
      const restaurantsData = restaurants.slice(0, 5).map(restaurant => ({
        name: restaurant.name,
        address: restaurant.vicinity || restaurant.formatted_address,
        rating: restaurant.rating || 'No rating available',
        price_level: restaurant.price_level !== undefined ? '$'.repeat(restaurant.price_level) : 'Price not available',
        open_now: restaurant.opening_hours?.open_now !== undefined ? 
          (restaurant.opening_hours.open_now ? 'Open now' : 'Closed') : 'Hours not available'
      }));
      
      const prompt = `Based on the following restaurants in ${destination} and the traveler's cuisine preferences (${cuisinePreferences.join(', ')}), 
      recommend the top 3 restaurants they should visit and explain why each is a good match for their preferences.
      
      Restaurants:
      ${JSON.stringify(restaurantsData, null, 2)}
      
      Provide your recommendations in a structured format with the name of each restaurant and a brief explanation of why it's recommended.`;
      
      const messages = [
        { role: "system", content: agentRules.systemPrompt },
        { role: "user", content: prompt }
      ];
      
      return this.generateChatCompletion(messages);
    } catch (error) {
      console.error('Error generating restaurant recommendations:', error);
      throw error;
    }
  },

  /**
   * Generate tour recommendations using TripAdvisor data
   */
  async generateTourRecommendations(destination: string, interests: string[]) {
    try {
      // Search for locations on TripAdvisor
      const locations = await tripAdvisorService.searchLocations(destination, 'attractions');
      
      if (locations.length === 0) {
        throw new Error('No locations found for the destination');
      }
      
      // Get tours for the first location
      const tours = await tripAdvisorService.searchTours(locations[0].location_id);
      
      // Format tours data for the prompt
      const toursData = tours.slice(0, 5).map(tour => ({
        name: tour.name,
        description: tour.description || 'No description available',
        rating: tour.rating || 'No rating available',
        num_reviews: tour.num_reviews || 0,
        price: tour.booking_options && tour.booking_options[0]?.price ? 
          `${tour.booking_options[0].price.amount} ${tour.booking_options[0].price.currency}` : 'Price not available'
      }));
      
      const prompt = `Based on the following tours and activities in ${destination} and the traveler's interests (${interests.join(', ')}), 
      recommend the top 3 tours they should consider and explain why each is a good match for their interests.
      
      Tours and Activities:
      ${JSON.stringify(toursData, null, 2)}
      
      Provide your recommendations in a structured format with the name of each tour and a brief explanation of why it's recommended.`;
      
      const messages = [
        { role: "system", content: agentRules.systemPrompt },
        { role: "user", content: prompt }
      ];
      
      return this.generateChatCompletion(messages);
    } catch (error) {
      console.error('Error generating tour recommendations:', error);
      throw error;
    }
  },

  /**
   * Generate a comprehensive travel plan using both Google Maps and TripAdvisor data
   */
  async generateComprehensiveTravelPlan(destination: string, duration: number, interests: string[], cuisinePreferences: string[]) {
    try {
      // Get attractions from TripAdvisor
      const attractions = await tripAdvisorService.searchLocations(destination, 'attractions');
      const attractionsData = attractions.slice(0, 5).map(attraction => ({
        name: attraction.name,
        description: attraction.description || 'No description available',
        rating: attraction.rating || 'No rating available',
        category: attraction.category?.name || 'Attraction'
      }));
      
      // Get coordinates for the destination
      const coordinates = await googleMapsService.geocodeAddress(destination);
      
      // Get restaurants from Google Maps
      const restaurants = await googleMapsService.searchNearbyRestaurants(
        coordinates,
        1500,
        cuisinePreferences.length > 0 ? cuisinePreferences[0] : undefined
      );
      const restaurantsData = restaurants.slice(0, 5).map(restaurant => ({
        name: restaurant.name,
        address: restaurant.vicinity || restaurant.formatted_address,
        rating: restaurant.rating || 'No rating available',
        price_level: restaurant.price_level !== undefined ? '$'.repeat(restaurant.price_level) : 'Price not available'
      }));
      
      // Get tours if attractions are available
      let toursData: Array<{
        name: string;
        description: string;
        rating: string;
        price: string;
      }> = [];
      if (attractions.length > 0) {
        const tours = await tripAdvisorService.searchTours(attractions[0].location_id);
        toursData = tours.slice(0, 3).map(tour => ({
          name: tour.name,
          description: tour.description || 'No description available',
          rating: tour.rating || 'No rating available',
          price: tour.booking_options && tour.booking_options[0]?.price ? 
            `${tour.booking_options[0].price.amount} ${tour.booking_options[0].price.currency}` : 'Price not available'
        }));
      }
      
      const prompt = `Create a comprehensive ${duration}-day travel itinerary for ${destination}. 
      The traveler is interested in: ${interests.join(', ')}.
      Their cuisine preferences are: ${cuisinePreferences.join(', ')}.
      
      Use the following data from TripAdvisor and Google Maps to create a realistic and detailed itinerary:
      
      Top Attractions (TripAdvisor):
      ${JSON.stringify(attractionsData, null, 2)}
      
      Recommended Restaurants (Google Maps):
      ${JSON.stringify(restaurantsData, null, 2)}
      
      ${toursData.length > 0 ? `Available Tours (TripAdvisor):
      ${JSON.stringify(toursData, null, 2)}` : ''}
      
      Format the response as a structured day-by-day itinerary with:
      1. Morning activities
      2. Lunch recommendations
      3. Afternoon activities
      4. Dinner recommendations
      5. Evening activities (if applicable)
      
      For each activity or restaurant, include:
      - Name
      - Brief description
      - Why it's recommended based on the traveler's interests
      - Approximate time needed
      
      Also provide a brief summary of why this itinerary is well-suited to the traveler's interests and preferences.`;
      
      const messages = [
        { role: "system", content: agentRules.systemPrompt },
        { role: "user", content: prompt }
      ];
      
      return this.generateChatCompletion(messages);
    } catch (error) {
      console.error('Error generating comprehensive travel plan:', error);
      throw error;
    }
  }
};

// Export named functions for better tree-shaking
export const {
  createRequestManager,
  generateChatCompletion,
  generateTravelSuggestion,
  generateAttractionRecommendations,
  generateRestaurantRecommendations,
  generateTourRecommendations,
  generateComprehensiveTravelPlan
} = openaiService; 