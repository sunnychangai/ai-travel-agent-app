import { OpenAI } from 'openai';
import { RequestManager } from './openaiService';
import * as promptTemplates from './promptTemplates';
import { ApiCache } from '../utils/cacheUtils';
import { withRetry, ApiError } from '../utils/apiUtils';

// Initialize OpenAI client
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const openai = new OpenAI({ 
  apiKey,
  dangerouslyAllowBrowser: true // Note: In production, you should use a backend proxy
});

// Cache for responses using shared ApiCache utility
const responseCache = new ApiCache<any>('EnhancedOpenAI', 24 * 60 * 60 * 1000); // 24 hours cache

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
    }>,
    options: { signal?: AbortSignal; useCache?: boolean } = {}
  ): Promise<T[]> {
    const { signal, useCache = true } = options;
    
    // Check cache for all requests first
    if (useCache) {
      const cachedResults = requests.map(req => {
        if (!req.cacheKey) return null;
        
        const cached = responseCache.get(req.cacheKey);
        if (cached) {
          return cached;
        }
        return null;
      });
      
      // If all results are cached, return them
      if (cachedResults.every(r => r !== null)) {
        return cachedResults as T[];
      }
    }
    
    // Make parallel requests for uncached items
    const promises = requests.map(async (req, index) => {
      const { prompt, model = 'gpt-4-turbo-preview', temperature = 0.7, parseResponse, cacheKey } = req;
      
      // Check cache for this specific request
      if (useCache && cacheKey) {
        const cached = responseCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }
      
      // Make the API call with retry logic
      try {
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
          throw new Error(`Empty response for request ${index}`);
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
          responseCache.set(cacheKey, parsedResult);
        }
        
        return parsedResult;
      } catch (error) {
        // If the error is an abort, just rethrow it
        if (error.name === 'AbortError') {
          throw error;
        }
        
        console.error(`Error in batch request ${index}:`, error);
        throw new ApiError(`Failed to process request ${index}: ${error.message}`, {
          status: error.status,
          isNetworkError: error.isNetworkError,
          isRateLimitError: error.isRateLimitError
        });
      }
    });
    
    return Promise.all(promises);
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
    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Create cache keys
    const baseKey = `itinerary:${destination}:${startDate}:${endDate}:${interests.join(',')}`;
    const attractionKey = `${baseKey}:attractions`;
    const restaurantKey = `${baseKey}:restaurants`;
    
    // Step 1: Make parallel requests for attractions and restaurants
    const [attractions, restaurants] = await this.batchRequests(
      [
        {
          prompt: promptTemplates.ATTRACTION_PROMPT
            .replace('{destination}', destination)
            .replace('{count}', Math.min(dayCount * 3, 15).toString())
            .replace('{interests}', interests.join(', ')),
          temperature: 0.8,
          cacheKey: attractionKey,
        },
        {
          prompt: promptTemplates.RESTAURANT_PROMPT
            .replace('{destination}', destination)
            .replace('{count}', Math.min(dayCount * 2, 10).toString())
            .replace('{preferences}', preferences.dietaryPreferences.join(', ')),
          temperature: 0.8,
          cacheKey: restaurantKey,
        },
      ],
      { signal: options.signal }
    );
    
    // Step 2: Generate day-by-day plan in parallel
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
        cacheKey: `${baseKey}:day${i + 1}`,
      });
    }
    
    const dailyPlans = await this.batchRequests(dayPrompts, { signal: options.signal });
    
    // Step 3: Balance the itinerary as a whole
    const draftItinerary = {
      destination,
      startDate,
      endDate,
      days: dailyPlans.map((plan, i) => ({
        dayNumber: i + 1,
        date: new Date(new Date(startDate).setDate(start.getDate() + i)).toISOString().split('T')[0],
        activities: plan.orderedActivities || [],
      })),
    };
    
    const [balancedItinerary] = await this.batchRequests(
      [
        {
          prompt: promptTemplates.ITINERARY_BALANCING_PROMPT
            .replace('{destination}', destination)
            .replace('{startDate}', startDate)
            .replace('{endDate}', endDate)
            .replace('{draftItinerary}', JSON.stringify(draftItinerary)),
          temperature: 0.7,
          cacheKey: `${baseKey}:balanced`,
        },
      ],
      { signal: options.signal }
    );
    
    // Step 4: Personalize based on user preferences
    const [personalizedItinerary] = await this.batchRequests(
      [
        {
          prompt: promptTemplates.PERSONALIZATION_PROMPT
            .replace('{destination}', destination)
            .replace('{travelStyle}', preferences.travelStyle)
            .replace('{interests}', interests.join(', '))
            .replace('{travelGroup}', preferences.travelGroup)
            .replace('{budget}', preferences.budget)
            .replace('{dietaryPreferences}', preferences.dietaryPreferences.join(', ')),
          model: 'gpt-4-turbo-preview',
          temperature: 0.8,
          cacheKey: `${baseKey}:personalized`,
        },
      ],
      { signal: options.signal, useCache: false } // Don't cache personalization
    );
    
    return personalizedItinerary;
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
        cacheKey: `description:${destination}:${activity.id}`,
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
};

export default enhancedOpenAIService; 