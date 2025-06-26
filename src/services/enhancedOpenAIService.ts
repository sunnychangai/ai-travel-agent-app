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

if (!apiKey) {
  console.warn('OpenAI API key missing. Check your .env file.');
}

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
   * Test API key configuration and connectivity
   * @returns Promise with test results
   */
  async testApiConfiguration(): Promise<{
    success: boolean;
    message: string;
    details: {
      hasApiKey: boolean;
      apiKeyFormat: string;
      networkConnectivity: boolean;
      apiResponse: boolean;
    };
  }> {
    const details = {
      hasApiKey: false,
      apiKeyFormat: 'invalid',
      networkConnectivity: false,
      apiResponse: false,
    };

    try {
      // Check if API key exists
      const currentApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      details.hasApiKey = Boolean(currentApiKey);
      
      if (!currentApiKey) {
        return {
          success: false,
          message: 'VITE_OPENAI_API_KEY environment variable is missing',
          details
        };
      }

      // Check API key format
      if (currentApiKey === 'your_openai_api_key' || currentApiKey.length < 20) {
        details.apiKeyFormat = 'placeholder';
        return {
          success: false,
          message: 'API key appears to be a placeholder or invalid',
          details
        };
      }

      if (currentApiKey.startsWith('sk-')) {
        details.apiKeyFormat = 'valid';
      } else {
        details.apiKeyFormat = 'unknown';
      }

      // Test network connectivity with a simple API call
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5,
        });

        details.networkConnectivity = true;
        details.apiResponse = Boolean(response.choices?.[0]?.message);

        return {
          success: true,
          message: 'API configuration is working correctly',
          details
        };
      } catch (apiError: any) {
        details.networkConnectivity = true; // We reached the API
        
        if (apiError.message?.includes('rate limit')) {
          return {
            success: false,
            message: 'API key is valid but rate limited. Try again later.',
            details
          };
        }
        
        if (apiError.message?.includes('authentication') || apiError.message?.includes('API key')) {
          return {
            success: false,
            message: 'API key is invalid or unauthorized',
            details
          };
        }

        return {
          success: false,
          message: `API error: ${apiError.message}`,
          details
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Configuration test failed: ${error.message}`,
        details
      };
    }
  },

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
          shouldRetry: (error: any) => {
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
    // Format dates consistently
    const formattedStartDate = startDate;
    const formattedEndDate = endDate;
    
    // Calculate number of days with safe date parsing
    const start = safeParseDate(formattedStartDate);
    const end = safeParseDate(formattedEndDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Create enhanced cache keys with proper specificity
    const baseKeyParams = {
      destination,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
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
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      interests,
      preferences,
      days: dailyPlans.map((plan, i) => {
        // Create a Date object for this day by adding i days to the start date
        const currentDate = safeParseDate(formattedStartDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        return {
          dayNumber: i + 1,
          date: currentDate.toISOString().split('T')[0], // Format to YYYY-MM-DD
          activities: (plan as any).orderedActivities || [],
        };
      }),
    };
    
    const [balancedItinerary, personalizedItinerary] = await Promise.all([
      // Balance the itinerary
      this.processRequestWithSwr({
        prompt: promptTemplates.ITINERARY_BALANCING_PROMPT
          .replace('{destination}', destination)
          .replace('{startDate}', formattedStartDate)
          .replace('{endDate}', formattedEndDate)
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
      ...(balancedItinerary as any),
      ...(personalizedItinerary as any),
      destination,
      startDate: formattedStartDate,
      endDate: formattedEndDate
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
          enhancedActivities[index].description = (enhancedDescriptions[j] as string);
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
      categorizationMap.set((cat as any).id, { 
        category: (cat as any).category, 
        subcategory: (cat as any).subcategory 
      });
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
    // Detect mobile device for better error handling
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    try {
      // Validate API key first
      const currentApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!currentApiKey || currentApiKey === 'your_openai_api_key') {
        throw new Error('OpenAI API key is missing or not configured. Please check your environment variables in Vercel deployment settings.');
      }

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

      // Check cache first
      const cachedResult = responseCache.get(cacheKey);
      if (cachedResult) {
        console.log('Returning cached itinerary result');
        return cachedResult;
      }

      // Report progress
      if (onProgress) onProgress('Preparing your travel plan...');

      // Generate the comprehensive prompt - use the existing createItineraryPrompt method
      const prompt = this.createItineraryPrompt(
        destination,
        formattedStartDate,
        formattedEndDate,
        userPreferences
      );

      console.log('Generating itinerary with prompt length:', prompt.length);

      // Report progress
      if (onProgress) onProgress('Generating your personalized itinerary...');

      // Mobile-specific timeout and retry settings
      const mobileTimeout = isMobile ? 45000 : 30000; // Longer timeout for mobile
      const mobileRetries = isMobile ? 2 : 1; // More retries for mobile

      // Make the API call with mobile-optimized settings
      const response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), mobileTimeout);
          
          try {
            const result = await openai.chat.completions.create({
              model: userPreferences.generationQuality === 'premium' ? 'gpt-4' : 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: userPreferences.generationQuality === 'premium' ? 4000 : 3000,
              temperature: 0.7,
              response_format: { type: 'json_object' },
            }, {
              signal: options.signal || controller.signal,
            });
            
            clearTimeout(timeoutId);
            return result;
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        },
        {
          maxRetries: mobileRetries,
          initialDelay: isMobile ? 2000 : 1000,
          maxDelay: isMobile ? 8000 : 5000,
          shouldRetry: (error: any) => {
            // Mobile-specific retry logic
            if (isMobile) {
              return error.name === 'AbortError' || 
                     error.message?.includes('network') ||
                     error.message?.includes('timeout') ||
                     error.message?.includes('Failed to fetch') ||
                     (isIOS && error.message?.includes('TypeError'));
            }
            return error.name === 'AbortError' || error.message?.includes('network');
          }
        }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Failed to generate itinerary - empty response');
      }

      // Report progress
      if (onProgress) onProgress('Processing your itinerary...');

      let parsedData;
      try {
        parsedData = JSON.parse(content);
      } catch (e) {
        console.error('Failed to parse itinerary JSON:', e);
        throw new Error('Failed to parse itinerary response');
      }

      // Validate and structure the response
      const itineraryData = this.validateAndStructureItinerary(parsedData);

      // Report progress
      if (onProgress) onProgress('Finalizing your travel plan...');

      // Cache the result
      responseCache.set(cacheKey, itineraryData);

      return itineraryData;

    } catch (error: any) {
      console.error('Error generating complete itinerary:', error);
      
      // Enhanced mobile-specific error handling
      if (isMobile) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out on mobile device. Please check your connection and try again.');
        }
        
        if (error.message?.includes('Failed to fetch') || error.message?.includes('TypeError')) {
          if (isIOS) {
            throw new Error('iOS/Safari compatibility issue detected. Try using a different browser like Chrome or Firefox, or switch to cellular data.');
          } else {
            throw new Error('Mobile network issue detected. Try switching between WiFi and cellular data, or move to a location with better signal.');
          }
        }
        
        if (error.message?.includes('SecurityError') || error.message?.includes('NotAllowedError')) {
          throw new Error('Mobile browser security restriction. Try clearing your browser cache and cookies, then refresh the page.');
        }
      }

      // Enhanced error context for debugging
      const errorContext = {
        destination,
        startDate: typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0],
        endDate: typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0],
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        isMobile,
        isIOS,
        errorType: error.constructor.name,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      };

      console.error('Error context:', errorContext);

      // Handle specific error types with user-friendly messages
      if (error.message?.includes('rate limit') || error.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.');
      }

      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Network error occurred. Please check your connection and try again.');
      }

      // Generic fallback error
      throw new Error(`Failed to generate itinerary: ${(error as Error).message || 'Unknown error'}`);
    }
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
          allActivities.map((activity: any) => 
            deduplicateRequest(
              `googlemaps:${options.destination}:${activity.title}`,
              () => googleMapsService.getPlaceDetails(activity.title)
                .then(details => {
                  if (details) {
                    // Update the activity with Google Maps data
                    const activityToUpdate = activitiesById.get(activity.id);
                    if (activityToUpdate) {
                      activityToUpdate.location = details.formatted_address || activityToUpdate.location;
                      activityToUpdate.rating = details.rating || activityToUpdate.rating;
                      activityToUpdate.mapUrl = details.url || activityToUpdate.mapUrl;
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
          allActivities.map((activity: any) => 
            deduplicateRequest(
              `tripadvisor:${options.destination}:${activity.title}`,
              () => tripAdvisorService.getLocationDetails(activity.title)
                .then((details: any) => {
                  if (details) {
                    // Update the activity with TripAdvisor data
                    const activityToUpdate = activitiesById.get(activity.id);
                    if (activityToUpdate) {
                      activityToUpdate.tripAdvisorRating = details.rating || activityToUpdate.tripAdvisorRating;
                      activityToUpdate.reviewCount = details.num_reviews || activityToUpdate.reviewCount;
                      activityToUpdate.tripAdvisorUrl = details.web_url || activityToUpdate.tripAdvisorUrl;
                      activityToUpdate.price = details.price_level || activityToUpdate.price;
                      activityToUpdate.category = details.category?.name || activityToUpdate.category;
                    }
                  }
                })
                .catch((error: any) => {
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
      return JSON.parse(extractedText || '{}');
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
${currentItinerary.itinerary.map((day: any) => `
${day.day}
${day.activities.map((activity: any) => `  - ${activity.time}: ${activity.name} at ${activity.address}`).join('\n')}
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
      const updatedItinerary = JSON.parse(updatedItineraryText || '{}');
      
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
      return JSON.parse(extractedText || '{}');
    } catch (error) {
      console.error('Error extracting user preferences:', error);
      // Return the current preferences if extraction fails
      return currentPreferences;
    }
  },

  // Add the new validateAndStructureItinerary method
  validateAndStructureItinerary(itineraryData: any) {
    // Validate and structure the itinerary data
    if (!itineraryData || typeof itineraryData !== 'object') {
      throw new Error('Invalid itinerary data received');
    }

    // Ensure we have the required structure
    const structuredData = {
      title: itineraryData.title || 'Your Travel Itinerary',
      destination: itineraryData.destination || '',
      startDate: itineraryData.startDate || '',
      endDate: itineraryData.endDate || '',
      days: Array.isArray(itineraryData.days) ? itineraryData.days : [],
      summary: itineraryData.summary || '',
      tips: Array.isArray(itineraryData.tips) ? itineraryData.tips : [],
      budget: itineraryData.budget || null
    };

    // Validate days array
    if (structuredData.days.length === 0) {
      throw new Error('No itinerary days found in the response');
    }

    // Validate each day structure
    structuredData.days = structuredData.days.map((day: any, index: number) => ({
      day: day.day || index + 1,
      date: day.date || '',
      title: day.title || `Day ${index + 1}`,
      activities: Array.isArray(day.activities) ? day.activities.map((activity: any) => ({
        id: activity.id || `activity-${index}-${Math.random().toString(36).substr(2, 9)}`,
        time: activity.time || '',
        title: activity.title || 'Untitled Activity',
        description: activity.description || '',
        location: activity.location || '',
        duration: activity.duration || '',
        cost: activity.cost || '',
        tips: Array.isArray(activity.tips) ? activity.tips : [],
        category: activity.category || 'general',
        coordinates: activity.coordinates || null,
        rating: activity.rating || null,
        photos: Array.isArray(activity.photos) ? activity.photos : []
      })) : []
    }));

    return structuredData;
  }
};

export default enhancedOpenAIService;