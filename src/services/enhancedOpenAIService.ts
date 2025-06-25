import { OpenAI } from 'openai';
import { RequestManager } from './openaiService';
import * as promptTemplates from './promptTemplates';
import { ApiCache } from '../utils/cacheUtils';
import { withRetry, ApiError, deduplicateRequest, debounceRequest } from '../utils/apiUtils';
import { safeParseDate } from '../utils/dateUtils';
import { googleMapsService } from '../services/googleMapsService';
import { tripAdvisorService } from '../services/tripAdvisorService';
import { performanceConfig } from '../config/performance';

// Initialize OpenAI client
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const openai = new OpenAI({ 
  apiKey,
  dangerouslyAllowBrowser: true // Note: In production, you should use a backend proxy
});

// Cache for responses using shared ApiCache utility - use performance settings
const responseCache = new ApiCache<any>(
  'EnhancedOpenAI', 
  performanceConfig.cache.ttl,
  performanceConfig.cache.maxItems,
  performanceConfig.cache.usePersistence,
  performanceConfig.cache.ttl * 2 // Stale TTL is double the fresh TTL
);

/**
 * Creates a standardized cache key with enhanced specificity for OpenAI requests
 * @param baseKey The base key (e.g., 'itinerary', 'attractions')
 * @param params Object containing all relevant parameters that affect the response
 * @returns A deterministic cache key string
 */
function createEnhancedCacheKey(baseKey: string, params: Record<string, any>) {
  // Filter out sensitive or irrelevant parameters
  const relevantParams = { ...params };
  
  // Don't include the full prompt in the cache key as it's too large and contains
  // highly dynamic content; instead focus on the key parameters
  if (relevantParams.prompt) {
    delete relevantParams.prompt;
  }
  
  return responseCache.generateKey(baseKey, relevantParams);
}

/**
 * Enhanced OpenAI service with parallel requests, batching, and specialized prompts
 */
export const enhancedOpenAIService = {
  /**
   * Make multiple OpenAI API calls in parallel
   * @param requests Array of request configs
   * @param options Options including abort signal
   * @returns Results of parallel requests
   */
  async batchRequests<T>(
    requests: Array<{
      prompt: string;
      model?: string;
      temperature?: number;
      parseResponse?: (text: string) => T;
      cacheKey?: string;
      cacheParams?: Record<string, any>;
    }>,
    options: { signal?: AbortSignal; useCache?: boolean } = {}
  ): Promise<T[]> {
    const { signal, useCache = performanceConfig.cache.enabled } = options;
    
    // Early return for empty requests array
    if (requests.length === 0) {
      return [];
    }
    
    // Prepare arrays to track results
    const results: (T | null)[] = new Array(requests.length).fill(null);
    
    // Process requests in parallel with enhanced cache handling
    await Promise.all(requests.map(async (request, index) => {
      try {
        // Generate enhanced cache key with better specificity if cacheParams are provided
        const finalCacheKey = request.cacheParams 
          ? createEnhancedCacheKey(request.cacheKey || `request:${index}`, request.cacheParams)
          : request.cacheKey;
        
        // Use stale-while-revalidate pattern for better performance
        const result = await this.processRequestWithSwr(
          request, 
          { 
            signal, 
            useCache, 
            cacheKey: finalCacheKey 
          }
        );
        
        results[index] = result;
      } catch (error) {
        console.error(`Error in batch request ${index}:`, error);
        // For other errors, just log and continue
        // This allows other requests in the batch to complete even if one fails
        results[index] = null;
      }
    }));
    
    return results as T[];
  },
  
  /**
   * Process a request with stale-while-revalidate caching pattern
   */
  async processRequestWithSwr<T>(
    request: {
      prompt: string;
      model?: string;
      temperature?: number;
      parseResponse?: (text: string) => T;
      cacheKey?: string;
    },
    options: { 
      signal?: AbortSignal; 
      useCache?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<T> {
    const { signal, useCache = true, cacheKey } = options;
    
    // If cache is disabled or no cache key, process directly
    if (!useCache || !cacheKey) {
      return this.processRequest(request, { signal, useCache: false });
    }
    
    // Use stale-while-revalidate pattern
    return responseCache.getOrFetch<T>(
      cacheKey,
      // Fetch function to get fresh data
      () => this.processRequest(request, { signal, useCache: false }),
      {
        compress: performanceConfig.cache.useCompression,
        background: false // Only refresh in background if stale
      }
    );
  },
  
  /**
   * Process a single request with caching, deduplication and debouncing
   */
  async processRequest<T>(
    request: {
      prompt: string;
      model?: string;
      temperature?: number;
      parseResponse?: (text: string) => T;
      cacheKey?: string;
    },
    options: { signal?: AbortSignal; useCache?: boolean } = {}
  ): Promise<T> {
    const { signal, useCache = true } = options;
    const { 
      prompt, 
      model = performanceConfig.model, 
      temperature = 0.7, 
      parseResponse, 
      cacheKey 
    } = request;
    
    // Recheck cache right before making the API call
    if (useCache && cacheKey) {
      const cached = responseCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    // Create a unique request identifier for deduplication using a more efficient method
    // Only generate it once per function call to avoid redundant string operations
    const requestId = cacheKey || `${model}:${prompt.substring(0, 50)}:${temperature}`;
    
    // Debounce similar requests that happen in rapid succession
    // This helps prevent duplicate API calls for near-identical requests
    return debounceRequest(`openai:${model}`, () => {
      // Deduplicate identical concurrent requests
      return deduplicateRequest(`openai:${requestId}`, async () => {
        // Make the API call with retry logic
        const response = await withRetry(() => openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          response_format: { type: 'json_object' },
        }, {
          signal,
        }), {
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
        
        // Parse the response
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error(`Empty response for request`);
        }
        
        let parsedResult: any;
        
        try {
          // Try to parse as JSON first
          parsedResult = JSON.parse(content);
        } catch (e) {
          // If JSON parsing fails and we have a custom parser, use it
          if (parseResponse) {
            parsedResult = parseResponse(content);
          } else {
            // Otherwise, just use the raw text
            parsedResult = content;
          }
        }
        
        // Cache the result
        if (useCache && cacheKey) {
          responseCache.set(cacheKey, parsedResult, performanceConfig.cache.useCompression);
        }
        
        return parsedResult;
      });
    });
  },
  
  /**
   * Generate a complete itinerary with parallel API calls
   */
  async generateCompleteItinerary(
    destination: string,
    startDate: string,
    endDate: string,
    interests: string[],
    preferences: {
      travelStyle: string;
      travelGroup: string;
      budget: string;
      transportMode: string;
      dietaryPreferences: string[];
      pace: 'slow' | 'moderate' | 'fast';
    },
    options: { signal?: AbortSignal } = {}
  ) {
    // Calculate number of days with safe date parsing
    const start = safeParseDate(startDate);
    const end = safeParseDate(endDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Create enhanced cache keys with proper specificity
    const baseKeyParams = {
      destination,
      startDate,
      endDate,
      interests: interests.join(','),
      travelStyle: preferences.travelStyle,
      budget: preferences.budget,
      dayCount
    };
    
    // Step 1: Make parallel requests for attractions and restaurants
    const [attractions, restaurants] = await this.batchRequests(
      [
        {
          prompt: promptTemplates.ATTRACTION_PROMPT
            .replace('{destination}', destination)
            .replace('{count}', Math.min(dayCount * 3, 15).toString())
            .replace('{interests}', interests.join(', ')),
          temperature: 0.8,
          cacheParams: {
            ...baseKeyParams,
            type: 'attractions',
            count: Math.min(dayCount * 3, 15)
          }
        },
        {
          prompt: promptTemplates.RESTAURANT_PROMPT
            .replace('{destination}', destination)
            .replace('{count}', Math.min(dayCount * 2, 10).toString())
            .replace('{preferences}', preferences.dietaryPreferences.join(', ')),
          temperature: 0.8,
          cacheParams: {
            ...baseKeyParams,
            type: 'restaurants',
            count: Math.min(dayCount * 2, 10),
            dietaryPreferences: preferences.dietaryPreferences.join(',')
          }
        },
      ],
      { signal: options.signal }
    ) as [any[], any[]];
    
    // Step 2: Generate day-by-day plan in parallel - prepare all requests at once
    const dayPrompts = [];
    for (let i = 0; i < dayCount; i++) {
      // Calculate activities for this day
      const dayActivities = [
        ...attractions.slice(i * 2, i * 2 + 2),
        restaurants[i % restaurants.length],
      ];
      
      dayPrompts.push({
        prompt: promptTemplates.DAILY_PLAN_PROMPT
          .replace('{dayNumber}', (i + 1).toString())
          .replace('{destination}', destination)
          .replace('{activities}', JSON.stringify(dayActivities))
          .replace('{preferences}', preferences.dietaryPreferences.join(', '))
          .replace('{transportMode}', preferences.transportMode),
        temperature: 0.7,
        cacheParams: {
          ...baseKeyParams,
          type: 'daily',
          dayNumber: i + 1,
          transportMode: preferences.transportMode
        }
      });
    }
    
    // Process all day plans in parallel with improved batching
    const dailyPlans = await this.batchRequests(dayPrompts, { signal: options.signal });
    
    // Step 3 & 4: Run balancing and personalization in parallel instead of sequentially
    const draftItinerary = {
      destination,
      startDate,
      endDate,
      interests,
      preferences,
      days: dailyPlans.map((plan, i) => {
        // Create a Date object for this day by adding i days to the start date
        const currentDate = safeParseDate(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        return {
          dayNumber: i + 1,
          date: currentDate.toISOString().split('T')[0], // Format to YYYY-MM-DD
          activities: plan.orderedActivities || [],
        };
      }),
    };
    
    const [balancedItinerary, personalizedItinerary] = await Promise.all([
      // Balance the itinerary
      this.processRequestWithSwr({
        prompt: promptTemplates.ITINERARY_BALANCING_PROMPT
          .replace('{destination}', destination)
          .replace('{startDate}', startDate)
          .replace('{endDate}', endDate)
          .replace('{draftItinerary}', JSON.stringify(draftItinerary)),
        temperature: 0.7,
        cacheKey: createEnhancedCacheKey('balanced', {
          ...baseKeyParams,
          draftHash: JSON.stringify(draftItinerary).length // Include a hash/length of the draft to make the cache more specific
        })
      }, { signal: options.signal }),
      
      // Personalize the itinerary (run concurrently with balancing)
      this.processRequestWithSwr({
        prompt: promptTemplates.PERSONALIZATION_PROMPT
          .replace('{destination}', destination)
          .replace('{travelStyle}', preferences.travelStyle)
          .replace('{interests}', interests.join(', '))
          .replace('{travelGroup}', preferences.travelGroup)
          .replace('{budget}', preferences.budget)
          .replace('{dietaryPreferences}', preferences.dietaryPreferences.join(', ')),
        model: 'gpt-4-turbo-preview',
        temperature: 0.8,
        cacheKey: createEnhancedCacheKey('personalized', {
          ...baseKeyParams,
          travelGroup: preferences.travelGroup,
          pace: preferences.pace
        })
      }, { signal: options.signal, useCache: false }) // Don't cache personalization
    ]);
    
    // Merge the balanced and personalized results
    // (In practice, you'd need to implement a smarter merging algorithm)
    return {
      ...balancedItinerary,
      ...personalizedItinerary,
      destination,
      startDate,
      endDate
    };
  },
  
  /**
   * Enhance descriptions for activities in an itinerary
   */
  async enhanceActivityDescriptions(
    activities: Array<{ id: string; title: string; description: string }>,
    destination: string,
    options: { signal?: AbortSignal; batchSize?: number } = {}
  ) {
    const { batchSize = 5, signal } = options;
    const enhancedActivities = [...activities];
    
    // Process in batches to avoid rate limiting
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      // Create prompts for this batch
      const batchPrompts = batch.map(activity => ({
        prompt: promptTemplates.DESCRIPTION_ENHANCEMENT_PROMPT
          .replace('{activity}', activity.title)
          .replace('{description}', activity.description)
          .replace('{destination}', destination),
        temperature: 0.8,
        cacheParams: {
          destination,
          activity: activity.id,
          title: activity.title,
          type: 'description'
        }
      }));
      
      // Get enhanced descriptions in parallel
      const enhancedDescriptions = await this.batchRequests(batchPrompts, { signal });
      
      // Update the activities with enhanced descriptions
      for (let j = 0; j < batch.length; j++) {
        const index = i + j;
        if (index < enhancedActivities.length) {
          enhancedActivities[index].description = enhancedDescriptions[j];
        }
      }
    }
    
    return enhancedActivities;
  },
  
  /**
   * Categorize activities in an itinerary
   */
  async categorizeActivities(
    activities: Array<{ id: string; title: string; description: string }>,
    options: { signal?: AbortSignal } = {}
  ) {
    // Split into batches of ~20 activities for effective categorization
    const batches = [];
    for (let i = 0; i < activities.length; i += 20) {
      batches.push(activities.slice(i, i + 20));
    }
    
    const categorizedBatches = await Promise.all(
      batches.map(async batch => {
        const [categorization] = await this.batchRequests(
          [
            {
              prompt: promptTemplates.ACTIVITY_CATEGORIZATION_PROMPT.replace(
                '{activities}',
                JSON.stringify(batch.map(a => ({ id: a.id, title: a.title, description: a.description })))
              ),
              temperature: 0.3, // Low temperature for more deterministic categorization
              cacheKey: `categorization:${batch.map(a => a.id).join(',')}`,
            },
          ],
          { signal: options.signal }
        );
        
        return categorization;
      })
    );
    
    // Flatten and combine the results
    const categorizations = categorizedBatches.flatMap(batch => batch);
    
    // Create a map of id to categorization
    const categorizationMap = new Map();
    for (const cat of categorizations) {
      categorizationMap.set(cat.id, { category: cat.category, subcategory: cat.subcategory });
    }
    
    // Apply categorizations to original activities
    return activities.map(activity => ({
      ...activity,
      category: categorizationMap.get(activity.id)?.category || 'Activity',
      subcategory: categorizationMap.get(activity.id)?.subcategory || '',
    }));
  },
  
  /**
   * Cleanup resources associated with this service
   */
  cleanup() {
    // Implement any necessary cleanup
  },
  
  /**
   * Generate a complete itinerary based on user input
   * @param destination Destination for the itinerary
   * @param startDate Start date (can be string or Date)
   * @param endDate End date (can be string or Date)
   * @param userPreferences User preferences for personalization
   * @param options Additional options
   * @returns Generated itinerary data
   */
  async generateItinerary(
    destination: string,
    startDate: string | Date,
    endDate: string | Date,
    userPreferences: any = {},
    options: { 
      signal?: AbortSignal;
      useTripadvisor?: boolean;
      useGoogleMaps?: boolean;
      cacheKey?: string 
    } = {}
  ) {
    // Format dates consistently
    const formattedStartDate = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0];
    const formattedEndDate = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0];
    
    // Extract progress callback if provided
    const onProgress = userPreferences.onProgress;
    
    // Create a more specific cache key with relevant parameters
    const cacheParams = {
      destination,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      travelStyle: userPreferences.travelStyle || 'balanced',
      budget: userPreferences.budget || 'mid-range',
      interests: Array.isArray(userPreferences.interests) 
        ? userPreferences.interests.map((i: any) => i.label || i).join(',')
        : '',
      travelGroup: userPreferences.travelGroup || 'solo',
      generationQuality: userPreferences.generationQuality || 'standard',
      useExternalData: options.useTripadvisor || options.useGoogleMaps || false
    };
    
    const cacheKey = options.cacheKey || createEnhancedCacheKey('itinerary', cacheParams);
    
    // Use stale-while-revalidate pattern to immediately return cached data while refreshing
    return responseCache.getOrFetch(
      cacheKey,
      async () => {
        console.log('Generating new itinerary for', destination);
        
        try {
          // Create a faster, simplified version depending on preferences
          const useComprehensiveGeneration = userPreferences.generationQuality === 'comprehensive';
          
          let itineraryData;
          
          if (useComprehensiveGeneration) {
            // Use the more detailed but slower generation method
            itineraryData = await this.generateCompleteItinerary(
              destination,
              formattedStartDate,
              formattedEndDate,
              userPreferences.interests || [],
              {
                travelStyle: userPreferences.travelStyle || 'balanced',
                travelGroup: userPreferences.travelGroup || 'solo',
                budget: userPreferences.budget || 'mid-range',
                transportMode: userPreferences.transportation || 'walking',
                dietaryPreferences: userPreferences.dietary || [],
                pace: userPreferences.pace || 'moderate'
              },
              { signal: options.signal }
            );
          } else {
            // Report progress if callback provided
            if (onProgress) {
              onProgress(30, 'Generating itinerary...');
            }
            
            // Use a simpler, faster single API call approach
            const prompt = this.createItineraryPrompt(
              destination, 
              formattedStartDate, 
              formattedEndDate, 
              userPreferences
            );
            
            try {
              const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo-1106',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                response_format: { type: 'json_object' },
              }, {
                signal: options.signal,
              });
              
              if (onProgress) {
                onProgress(60, 'Processing results...');
              }
              
              const content = response.choices[0]?.message?.content;
              if (!content) {
                throw new Error('Failed to generate itinerary - empty response');
              }
              
              try {
                itineraryData = JSON.parse(content);
              } catch (e) {
                console.error('Failed to parse itinerary JSON:', e);
                throw new Error('Failed to parse itinerary response');
              }
            } catch (error) {
              // Check if this is an abort error
              if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                console.log('Itinerary generation aborted by user.');
                throw error; // Re-throw abort errors to be handled by caller
              }
              
              // For other errors, try to provide a more helpful message
              console.error('Error in OpenAI API call:', error);
              throw new Error(`Failed to generate itinerary: ${error.message || 'Unknown error'}`);
            }
          }
          
          // Add a title to the itinerary if not already present
          if (!itineraryData.title) {
            const durationDays = Math.ceil(
              (new Date(formattedEndDate).getTime() - new Date(formattedStartDate).getTime()) / 
              (1000 * 60 * 60 * 24)
            ) + 1;
            
            itineraryData.title = `${durationDays}-Day Trip to ${destination}`;
          }
          
          // Report progress if callback provided
          if (onProgress) {
            onProgress(75, 'Enhancing itinerary details...');
          }
          
          // Only enhance with external data if explicitly requested
          // These external API calls are often a significant performance bottleneck
          const shouldUseExternalData = 
            (options.useTripadvisor || options.useGoogleMaps) && 
            userPreferences.useExternalData;
          
          if (shouldUseExternalData) {
            itineraryData = await this.enhanceItineraryWithExternalData(
              itineraryData,
              {
                useTripadvisor: !!options.useTripadvisor,
                useGoogleMaps: !!options.useGoogleMaps,
                destination
              }
            );
          }
          
          // Final progress update
          if (onProgress) {
            onProgress(90, 'Finalizing your itinerary...');
          }
          
          return itineraryData;
        } catch (error: any) {
          console.error('Error generating complete itinerary:', error);
          
          // Better error context for debugging
          const errorContext = {
            destination,
            startDate,
            endDate,
            interests,
            preferences,
            dayCount
          };
          
          console.error('Error context:', errorContext);
          
          // Check if it's an API error and provide helpful message
          if ((error as Error).message?.includes('rate limit')) {
            throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.');
          }
          
          if ((error as Error).message?.includes('network') || (error as Error).message?.includes('timeout')) {
            throw new Error('Network error occurred. Please check your connection and try again.');
          }
          
          // Generic error with context
          throw new Error(`Failed to generate itinerary: ${(error as Error).message || 'Unknown error'}`);
        }
      },
      {
        compress: performanceConfig.cache.useCompression,
        background: true // Always refresh in background after a period
      }
    );
  },
  
  /**
   * Create a structured prompt for generating itineraries
   */
  createItineraryPrompt(
    destination: string,
    startDate: string,
    endDate: string,
    userPreferences: any = {}
  ) {
    // Ensure dates use at least 2025 as the year
    const ensureCorrectYear = (dateStr: string): string => {
      const date = new Date(dateStr);
      if (date.getFullYear() < 2025) {
        return dateStr.replace(/^\d{4}/, '2025');
      }
      return dateStr;
    };
    
    const formattedStartDate = ensureCorrectYear(startDate);
    const formattedEndDate = ensureCorrectYear(endDate);
    
    // Calculate the number of days in the trip
    const start = new Date(formattedStartDate);
    const end = new Date(formattedEndDate);
    const tripDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Extract user preferences for the prompt
    const {
      travelStyle = 'balanced',
      interests = [],
      travelGroup = 'solo',
      budget = 'medium',
      dietaryPreferences = [],
      pace = 'moderate'
    } = userPreferences;
    
    // Format the preferences for the prompt
    const interestsText = interests.length > 0
      ? interests.map((i: any) => i.label || i).join(', ')
      : 'sightseeing, food, culture, relaxation';
    
    const dietaryText = dietaryPreferences.length > 0
      ? dietaryPreferences.map((p: any) => p.label || p).join(', ')
      : 'no specific dietary restrictions';
    
    // Create the structured prompt
    return `
Generate a detailed ${tripDuration}-day travel itinerary for ${destination} from ${formattedStartDate} to ${formattedEndDate}.

TRAVELER PROFILE:
- Travel style: ${travelStyle}
- Interests: ${interestsText}
- Group type: ${travelGroup}
- Budget level: ${budget}
- Dietary preferences: ${dietaryText}
- Pace preference: ${pace}

REQUIREMENTS:
1. Create a day-by-day itinerary with 3-5 activities per day including meals.
2. Each day should start around 8-9 AM and end around 9-10 PM unless specified otherwise.
3. Include a mix of popular attractions and hidden gems based on the interests.
4. Schedule activities at realistic times with appropriate breaks and travel time between locations.
5. For meals, recommend specific restaurants that match the budget and dietary preferences.
6. Include exact addresses for all locations.
7. Add brief descriptions (2-3 sentences) for each activity.
8. Categorize activities as "food", "sightseeing", "cultural", "relaxation", or "active".
9. Create a catchy, descriptive title for this itinerary that captures its essence.

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "destination": "City Name", // Just the main city name (e.g., "New York" not "80 Spring St, New York, NY")
  "startDate": "${formattedStartDate}",
  "endDate": "${formattedEndDate}",
  "title": "Catchy Title for the Itinerary",
  "itinerary": [
    {
      "day": "Day 1",
      "date": "YYYY-MM-DD", 
      "activities": [
        {
          "time": "9:00 AM",
          "type": "food",
          "name": "Breakfast at [Place]",
          "address": "Full address",
          "description": "Brief description"
        },
        ...more activities
      ]
    },
    ...more days
  ]
}

IMPORTANT: All dates MUST be in YYYY-MM-DD format (example: 2025-05-01). DO NOT use natural language dates like "Thursday, May 1, 2025".

The response MUST be valid JSON without markdown formatting or code blocks.
`;
  },
  
  /**
   * Enhance itinerary with external data from Google Maps and TripAdvisor
   */
  async enhanceItineraryWithExternalData(
    itineraryData: any,
    options: {
      useTripadvisor?: boolean;
      useGoogleMaps?: boolean;
      destination: string;
    }
  ) {
    const enhancedItinerary = { ...itineraryData };
    
    // Extract all activities from all days
    const allActivities = enhancedItinerary.days.flatMap((day: any) => 
      day.activities.map((activity: any) => ({
        ...activity,
        dayNumber: day.dayNumber
      }))
    );
    
    // Skip if no activities
    if (allActivities.length === 0) {
      return enhancedItinerary;
    }
    
    // Use a Map to track activities by ID for updating later
    const activitiesById = new Map();
    allActivities.forEach((activity: any) => {
      // Generate an ID if none exists
      const id = activity.id || `activity-${Math.random().toString(36).substring(2, 10)}`;
      activity.id = id;
      activitiesById.set(id, activity);
    });
    
    // Prepare external data enhancement operations - run all in parallel
    const enhancementPromises: Promise<any>[] = [];
    
    if (options.useGoogleMaps) {
      // Get Google Maps data for all activities in parallel
      enhancementPromises.push(
        Promise.all(
          allActivities.map(activity => 
            deduplicateRequest(
              `googlemaps:${options.destination}:${activity.title}`,
              () => googleMapsService.getPlaceDetails(activity.title, options.destination)
                .then(details => {
                  if (details) {
                    // Update the activity with Google Maps data
                    const activityToUpdate = activitiesById.get(activity.id);
                    if (activityToUpdate) {
                      activityToUpdate.location = details.address || activityToUpdate.location;
                      activityToUpdate.rating = details.rating || activityToUpdate.rating;
                      activityToUpdate.mapUrl = details.mapUrl || activityToUpdate.mapUrl;
                      activityToUpdate.photos = details.photos || activityToUpdate.photos;
                    }
                  }
                })
                .catch(error => {
                  console.error(`Error getting Google Maps data for ${activity.title}:`, error);
                  // Continue with other activities even if one fails
                })
            )
          )
        )
      );
    }
    
    if (options.useTripadvisor) {
      // Get TripAdvisor data for all activities in parallel
      enhancementPromises.push(
        Promise.all(
          allActivities.map(activity => 
            deduplicateRequest(
              `tripadvisor:${options.destination}:${activity.title}`,
              () => tripAdvisorService.getAttractionDetails(activity.title, options.destination)
                .then(details => {
                  if (details) {
                    // Update the activity with TripAdvisor data
                    const activityToUpdate = activitiesById.get(activity.id);
                    if (activityToUpdate) {
                      activityToUpdate.tripAdvisorRating = details.rating || activityToUpdate.tripAdvisorRating;
                      activityToUpdate.reviewCount = details.reviewCount || activityToUpdate.reviewCount;
                      activityToUpdate.tripAdvisorUrl = details.url || activityToUpdate.tripAdvisorUrl;
                      activityToUpdate.price = details.price || activityToUpdate.price;
                      activityToUpdate.category = details.category || activityToUpdate.category;
                    }
                  }
                })
                .catch(error => {
                  console.error(`Error getting TripAdvisor data for ${activity.title}:`, error);
                  // Continue with other activities even if one fails
                })
            )
          )
        )
      );
    }
    
    // Process activity descriptions in optimized batches
    const enhanceDescriptionPromises = [];
    const batchSize = performanceConfig.itineraryGeneration.batchSize;
    
    for (let i = 0; i < allActivities.length; i += batchSize) {
      const batch = allActivities.slice(i, i + batchSize);
      
      enhanceDescriptionPromises.push(
        this.enhanceActivityDescriptions(batch, options.destination)
          .then(enhancedActivities => {
            // Update the descriptions in our activity map
            enhancedActivities.forEach(enhancedActivity => {
              const activityToUpdate = activitiesById.get(enhancedActivity.id);
              if (activityToUpdate) {
                activityToUpdate.description = enhancedActivity.description;
              }
            });
          })
          .catch(error => {
            console.error('Error enhancing activity descriptions:', error);
            // Continue with other activities even if one batch fails
          })
      );
    }
    
    // Add the description enhancement promises to our array
    enhancementPromises.push(Promise.all(enhanceDescriptionPromises));
    
    // Wait for all enhancement operations to complete
    await Promise.all(enhancementPromises);
    
    // Update the days in the itinerary with enhanced activities
    enhancedItinerary.days.forEach((day: any) => {
      day.activities = day.activities.map((activity: any) => {
        const enhancedActivity = activitiesById.get(activity.id || `activity-${Math.random().toString(36).substring(2, 10)}`);
        return enhancedActivity || activity;
      });
    });
    
    return enhancedItinerary;
  },
  
  /**
   * Parse a user request to extract itinerary parameters
   * @param userInput User's natural language input
   * @returns Extracted parameters (destination, dates, preferences)
   */
  async extractItineraryParameters(userInput: string) {
    try {
      const extractionPrompt = `
Parse the following travel request to extract key details for itinerary planning:

"${userInput}"

Extract the following information:
1. Destination (city, country, or region)
2. Start date (if provided)
3. End date (if provided)
4. Duration (number of days, if dates not explicitly provided)
5. Any specific preferences mentioned (e.g., budget, interests, accommodation type)

IMPORTANT NOTES ABOUT DATES:
- If specific dates are mentioned but without a year, assume the year is 2025.
- If dates are mentioned with years before 2025, update them to use 2025 instead.
- All dates must be returned in YYYY-MM-DD format, with YYYY being at least 2025.

Return ONLY a JSON object with these fields:
{
  "destination": "extracted destination or null if not found",
  "startDate": "extracted start date in YYYY-MM-DD format or null if not found",
  "endDate": "extracted end date in YYYY-MM-DD format or null if not found",
  "duration": "number of days as integer or null if not found",
  "preferences": ["array", "of", "extracted", "preferences"]
}
`;

      const response = await withRetry(() => openai.chat.completions.create({
        model: 'gpt-3.5-turbo-1106',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }));
      
      const extractedText = response.choices[0].message.content;
      return JSON.parse(extractedText);
    } catch (error) {
      console.error('Error extracting itinerary parameters:', error);
      throw new Error('Failed to parse your request. Please try again with more details.');
    }
  },
  
  /**
   * Process a request to update an existing itinerary
   * @param userInput User's natural language update request
   * @param currentItinerary Current itinerary data
   * @returns Updated itinerary data
   */
  async processItineraryUpdate(userInput: string, currentItinerary: any) {
    try {
      // Create a prompt for the update
      const updatePrompt = `
Based on the user's request, update the travel itinerary below. Make only the changes that are requested by the user, while preserving the rest of the itinerary's structure and content.

CURRENT ITINERARY:
Destination: ${currentItinerary.destination}
Start Date: ${currentItinerary.startDate}
End Date: ${currentItinerary.endDate}
${currentItinerary.itinerary.map(day => `
${day.day}
${day.activities.map(activity => `  - ${activity.time}: ${activity.name} at ${activity.address}`).join('\n')}
`).join('\n')}

USER REQUEST:
"${userInput}"

Provide the updated itinerary as a JSON object with the following structure:
{
  "destination": "Destination Name",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "title": "A descriptive title for the updated itinerary",
  "itinerary": [
    {
      "day": "Day 1",
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "time": "9:00 AM",
          "type": "food|sightseeing|cultural|relaxation|active",
          "name": "Activity Name",
          "address": "Activity Address",
          "description": "Activity Description"
        }
      ]
    }
  ]
}

IMPORTANT: All dates MUST be in YYYY-MM-DD format. DO NOT use natural language dates.
If the user is requesting to add, remove, or modify specific days or activities, make only those changes.
If the user's request doesn't specify changes to a particular day or activity, keep it exactly as it is.

Return ONLY the JSON response with no additional text or explanation.
`;

      // Call OpenAI to process the update
      const response = await withRetry(() => openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: updatePrompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      }));
      
      const updatedItineraryText = response.choices[0].message.content;
      const updatedItinerary = JSON.parse(updatedItineraryText);
      
      return updatedItinerary;
    } catch (error) {
      console.error('Error updating itinerary:', error);
      throw new Error('Failed to update your itinerary. Please try again with clearer instructions.');
    }
  },
  
  /**
   * Extract and update user preferences from conversation
   * @param userInput User's message
   * @param currentPreferences Current user preferences
   * @returns Updated user preferences
   */
  async extractUserPreferences(userInput: string, currentPreferences = {}) {
    try {
      const extractionPrompt = `
Analyze the following user message to identify any travel preferences:

"${userInput}"

Current known preferences:
${JSON.stringify(currentPreferences, null, 2)}

Extract any new preferences related to:
1. Travel style (e.g., luxury, budget, adventure, relaxed)
2. Interests (e.g., museums, food, outdoors, shopping)
3. Dietary requirements (e.g., vegetarian, halal, allergies)
4. Budget constraints (specific numbers or general level)
5. Accommodation preferences (e.g., hotel, hostel, Airbnb)
6. Transportation preferences (e.g., public transit, walking, car)
7. Accessibility needs
8. Travel pace (e.g., slow, moderate, fast-paced)

Only return preferences that are clearly stated or strongly implied.

Return a JSON object with the merged preferences (current + new):
{
  "travelStyle": "extracted preference or unchanged if not mentioned",
  "interests": ["array", "of", "interests"],
  "dietaryPreferences": ["array", "of", "dietary", "restrictions"],
  "budget": "budget preference or unchanged if not mentioned",
  "accommodation": "accommodation preference or unchanged if not mentioned",
  "transportation": "transportation preference or unchanged if not mentioned",
  "accessibility": ["array", "of", "accessibility", "needs"],
  "pace": "travel pace preference or unchanged if not mentioned"
}
`;

      const response = await withRetry(() => openai.chat.completions.create({
        model: 'gpt-3.5-turbo-1106',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }));
      
      const extractedText = response.choices[0].message.content;
      return JSON.parse(extractedText);
    } catch (error) {
      console.error('Error extracting user preferences:', error);
      // Return the current preferences if extraction fails
      return currentPreferences;
    }
  }
};

export default enhancedOpenAIService; 