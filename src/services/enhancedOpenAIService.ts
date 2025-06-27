import { OpenAI } from 'openai';
import { RequestManager } from './openaiService';
import * as promptTemplates from './promptTemplates';
import { unifiedApiCache } from './unifiedApiCacheService';
import { withRetry, ApiError, deduplicateRequest } from '../utils/apiUtils';
import { safeParseDate } from '../utils/dateUtils';
import { googleMapsService } from '../services/googleMapsService';
import { tripAdvisorService } from '../services/tripAdvisorService';
import { performanceConfig } from '../config/performance';
import { getMealTimeGuidance } from '../utils/culturalNorms';

// Enhanced Error Types for different failure modes
export class OpenAIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly isRetryable: boolean = false,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'OpenAIServiceError';
  }
}

export class RateLimitError extends OpenAIServiceError {
  constructor(retryAfter?: number) {
    super(
      'OpenAI API rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      'We\'re receiving a lot of requests right now. Please wait a moment and try again.',
      true,
      { retryAfter }
    );
  }
}

export class AuthenticationError extends OpenAIServiceError {
  constructor() {
    super(
      'OpenAI API authentication failed',
      'AUTHENTICATION_FAILED',
      'There\'s an issue with our AI service configuration. Please try again later or contact support.',
      false
    );
  }
}

export class NetworkError extends OpenAIServiceError {
  constructor(originalError?: string) {
    super(
      `Network connectivity issue: ${originalError}`,
      'NETWORK_ERROR',
      'Network connection problem. Please check your internet connection and try again.',
      true,
      { originalError }
    );
  }
}

export class QuotaExceededError extends OpenAIServiceError {
  constructor() {
    super(
      'OpenAI API quota exceeded',
      'QUOTA_EXCEEDED',
      'Our AI service has reached its usage limit. Please try again later.',
      false
    );
  }
}

export class InvalidRequestError extends OpenAIServiceError {
  constructor(details?: string) {
    super(
      `Invalid request to OpenAI API: ${details}`,
      'INVALID_REQUEST',
      'There was an issue with your request. Please try again with different parameters.',
      false,
      { details }
    );
  }
}

export class ServiceUnavailableError extends OpenAIServiceError {
  constructor() {
    super(
      'OpenAI API service temporarily unavailable',
      'SERVICE_UNAVAILABLE',
      'Our AI service is temporarily unavailable. Please try again in a few minutes.',
      true
    );
  }
}

export class ContentFilterError extends OpenAIServiceError {
  constructor() {
    super(
      'Content filtered by OpenAI safety systems',
      'CONTENT_FILTERED',
      'Your request contained content that couldn\'t be processed. Please try rephrasing your request.',
      false
    );
  }
}

// Circuit Breaker Pattern Implementation
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly halfOpenMaxRequests: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
        this.failureCount = 0;
      } else {
        throw new ServiceUnavailableError();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset() {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
}

// Create circuit breaker instance
const circuitBreaker = new CircuitBreaker();

// Enhanced error classification function
function classifyOpenAIError(error: any): OpenAIServiceError {
  // Handle abort errors first
  if (error.name === 'AbortError') {
    return new OpenAIServiceError(
      'Request was aborted',
      'REQUEST_ABORTED',
      'Request was canceled',
      false
    );
  }

  // Handle OpenAI API specific errors
  if (error.status) {
    switch (error.status) {
      case 401:
        return new AuthenticationError();
      case 429:
        const retryAfter = error.headers?.['retry-after'] ? parseInt(error.headers['retry-after']) : undefined;
        return new RateLimitError(retryAfter);
      case 400:
        return new InvalidRequestError(error.message);
      case 403:
        return new QuotaExceededError();
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServiceUnavailableError();
      default:
        return new OpenAIServiceError(
          `OpenAI API error: ${error.message}`,
          'API_ERROR',
          'An unexpected error occurred with our AI service. Please try again.',
          error.status >= 500,
          { status: error.status }
        );
    }
  }

  // Handle network errors
  if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'ENOTFOUND') {
    return new NetworkError(error.message);
  }

  // Handle JSON parsing errors
  if (error.message?.includes('JSON') || error.message?.includes('parse')) {
    return new OpenAIServiceError(
      `Failed to parse response: ${error.message}`,
      'PARSE_ERROR',
      'Received an invalid response from our AI service. Please try again.',
      true,
      { originalError: error.message }
    );
  }

  // Generic fallback
  return new OpenAIServiceError(
    error.message || 'Unknown error occurred',
    'UNKNOWN_ERROR',
    'An unexpected error occurred. Please try again.',
    false,
    { originalError: error.message }
  );
}

// Enhanced retry configuration
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true
};

// Enhanced retry function with exponential backoff and jitter
async function enhancedRetry<T>(
  operation: () => Promise<T>,
  config: Partial<typeof retryConfig> = {}
): Promise<T> {
  const finalConfig = { ...retryConfig, ...config };
  let lastError: any;
  
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const classifiedError = classifyOpenAIError(error);
      
      // Don't retry non-retryable errors
      if (!classifiedError.isRetryable || attempt === finalConfig.maxRetries) {
        throw classifiedError;
      }
      
      // Calculate delay with exponential backoff and jitter
      let delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
        finalConfig.maxDelay
      );
      
      if (finalConfig.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5); // Add ±50% jitter
      }
      
      console.log(`[OpenAI] Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${delay}ms delay`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw classifyOpenAIError(lastError);
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

/**
 * Creates standardized cache keys using unified cache service capabilities
 * @param type The request type (e.g., 'itinerary', 'attractions')
 * @param params Key parameters that affect the response
 * @returns Cache key and params for unified cache service
 */
function createCacheKeyAndParams(type: string, params: Record<string, any>) {
  // Clean and normalize parameters
  const cleanParams = Object.keys(params)
    .sort()
    .reduce((clean, key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        // Normalize string values
        if (typeof value === 'string') {
          clean[key] = value.toLowerCase().trim();
        } else {
          clean[key] = value;
        }
      }
      return clean;
    }, {} as Record<string, any>);

  // Create semantic cache key - let unified cache handle user scoping
  const cacheKey = `openai-${type}`;
  
  return {
    cacheKey,
    cacheParams: cleanParams
  };
}

/**
 * Enhanced OpenAI service with simplified caching and request processing
 */
export const enhancedOpenAIService = {
  /**
   * Test API key configuration and connectivity
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
        const response = await enhancedRetry(async () => {
          return await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Test' }],
            max_tokens: 5,
          });
        }, { maxRetries: 1 }); // Only one retry for config test

        details.networkConnectivity = true;
        details.apiResponse = Boolean(response.choices?.[0]?.message);

        return {
          success: true,
          message: 'API configuration is working correctly',
          details
        };
      } catch (apiError: any) {
        details.networkConnectivity = true; // We reached the API
        
        // Use enhanced error classification
        const classifiedError = classifyOpenAIError(apiError);
        
        return {
          success: false,
          message: classifiedError.userMessage,
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
   * Enhanced batch request processing with error handling and partial failure support
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
    options: { 
      signal?: AbortSignal; 
      useCache?: boolean;
      allowPartialFailure?: boolean;
      failFastOnCriticalError?: boolean;
    } = {}
  ): Promise<T[]> {
    const { 
      signal, 
      useCache = performanceConfig.cache.enabled,
      allowPartialFailure = true,
      failFastOnCriticalError = true
    } = options;
    
    if (requests.length === 0) {
      return [];
    }
    
    console.log(`[OpenAI] Processing ${requests.length} requests in batch`);
    
    // Track batch statistics
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ index: number; error: OpenAIServiceError }> = [];
    
    // Process requests in parallel with enhanced error handling
    const promises = requests.map(async (request, index) => {
      try {
        const result = await this.processRequest(request, { signal, useCache });
        successCount++;
        return result;
      } catch (error: any) {
        failureCount++;
        
        // Classify the error
        const classifiedError = error instanceof OpenAIServiceError 
          ? error 
          : classifyOpenAIError(error);
        
                 // Add batch context by creating new error with combined context
         const enhancedError = new OpenAIServiceError(
           classifiedError.message,
           classifiedError.code,
           classifiedError.userMessage,
           classifiedError.isRetryable,
           {
             ...classifiedError.context,
             batchIndex: index,
             batchSize: requests.length,
             operation: 'batchRequests'
           }
         );
        
                 errors.push({ index, error: enhancedError });
         
         console.error(`[OpenAI] Batch request ${index} failed:`, {
           error: enhancedError.message,
           code: enhancedError.code,
           retryable: enhancedError.isRetryable
         });
         
         // Fail fast on critical errors if specified
         if (failFastOnCriticalError && !enhancedError.isRetryable) {
           throw enhancedError;
         }
         
         // Return null for partial failure mode, throw for strict mode
         if (allowPartialFailure) {
           return null;
         } else {
           throw enhancedError;
         }
      }
    });
    
    try {
      const results = await Promise.all(promises);
      
      // Log batch statistics
      console.log(`[OpenAI] Batch completed: ${successCount} successful, ${failureCount} failed`);
      
      // If we have failures in strict mode, throw an aggregate error
      if (!allowPartialFailure && errors.length > 0) {
        const aggregateError = new OpenAIServiceError(
          `Batch request failed with ${errors.length} errors`,
          'BATCH_FAILURE',
          `Failed to process ${errors.length} out of ${requests.length} requests`,
          errors.some(e => e.error.isRetryable),
          {
            errors: errors.map(e => ({ index: e.index, code: e.error.code, message: e.error.message })),
            successCount,
            failureCount
          }
        );
        throw aggregateError;
      }
      
      return results as T[];
    } catch (error: any) {
      // Handle Promise.all rejection (fail-fast scenario)
      if (error instanceof OpenAIServiceError) {
        throw error;
      }
      
      throw classifyOpenAIError(error);
    }
  },
  
  /**
   * Enhanced request processing with circuit breaker, retry logic, and error handling
   */
  async processRequest<T>(
    request: {
      prompt: string;
      model?: string;
      temperature?: number;
      parseResponse?: (text: string) => T;
      cacheKey?: string;
      cacheParams?: Record<string, any>;
    },
    options: { signal?: AbortSignal; useCache?: boolean } = {}
  ): Promise<T> {
    const { signal, useCache = true } = options;
    const { 
      prompt, 
      model = performanceConfig.model, 
      temperature = 0.7, 
      parseResponse, 
      cacheKey,
      cacheParams
    } = request;
    
    // Check cache first if enabled
    if (useCache && cacheKey) {
      try {
        const cached = await unifiedApiCache.get<T>('openai-api', cacheKey);
        if (cached) {
          console.log(`[OpenAI] Cache hit for: ${cacheKey}`);
          return cached;
        }
      } catch (error) {
        console.warn('[OpenAI] Cache lookup failed:', error);
      }
    }
    
    // Use circuit breaker and enhanced retry for API calls
    const makeApiCall = async (): Promise<T> => {
      return await circuitBreaker.execute(async () => {
        return await enhancedRetry(async () => {
          console.log(`[OpenAI] Making API request with model: ${model}`);
          
          // Check for abort signal before making request
          if (signal?.aborted) {
            throw new Error('Request was aborted');
          }
          
          try {
            const response = await openai.chat.completions.create({
              model,
              messages: [{ role: 'user', content: prompt }],
              temperature,
              response_format: { type: 'json_object' }
            }, { signal });
            
            const content = response.choices?.[0]?.message?.content;
            if (!content) {
              throw new OpenAIServiceError(
                'Empty response from OpenAI API',
                'EMPTY_RESPONSE',
                'Received an empty response from our AI service. Please try again.',
                true
              );
            }
            
            // Parse the response with better error handling
            let parsedResult: any;
            try {
              parsedResult = JSON.parse(content);
            } catch (parseError) {
              if (parseResponse) {
                try {
                  parsedResult = parseResponse(content);
                } catch (customParseError) {
                  throw new OpenAIServiceError(
                    `Custom parse function failed: ${customParseError}`,
                    'CUSTOM_PARSE_ERROR',
                    'Failed to process the AI response. Please try again.',
                    true,
                    { content: content.substring(0, 200) }
                  );
                }
              } else {
                throw new OpenAIServiceError(
                  `Failed to parse JSON response: ${parseError}`,
                  'JSON_PARSE_ERROR',
                  'Received an invalid response format. Please try again.',
                  true,
                  { content: content.substring(0, 200) }
                );
              }
            }
            
            // Cache the successful result
            if (useCache && cacheKey) {
              try {
                await unifiedApiCache.set('openai-api', cacheKey, parsedResult);
              } catch (cacheError) {
                console.warn('[OpenAI] Failed to cache result:', cacheError);
                // Don't fail the request if caching fails
              }
            }
            
            return parsedResult;
          } catch (apiError: any) {
            // Classify and throw appropriate error
            throw classifyOpenAIError(apiError);
          }
        });
      });
    };
    
    try {
      return await makeApiCall();
    } catch (error: any) {
      // Log error details for debugging
      console.error('[OpenAI] Request failed:', {
        error: error.message,
        code: error.code,
        model,
        promptLength: prompt.length,
        cacheKey,
        circuitBreakerState: circuitBreaker.getState()
      });
      
      // Re-throw the classified error
      throw error;
    }
  },
  
  /**
   * Generate a complete itinerary with simplified parallel processing
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
    const start = safeParseDate(startDate);
    const end = safeParseDate(endDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Get cultural meal time guidance for this destination
    const mealTimeGuidance = getMealTimeGuidance(destination);
    
    // Create base parameters for cache keys
    const baseParams = {
      destination,
      startDate,
      endDate,
      interests: interests.join(','),
      travelStyle: preferences.travelStyle,
      budget: preferences.budget,
      dayCount
    };
    
    // Step 1: Get attractions and restaurants in parallel
    const attractionCache = createCacheKeyAndParams('attractions', { 
      ...baseParams, 
      count: Math.min(dayCount * 3, 15) 
    });
    const restaurantCache = createCacheKeyAndParams('restaurants', { 
      ...baseParams, 
      count: Math.min(dayCount * 2, 10),
      dietaryPreferences: preferences.dietaryPreferences.join(',')
    });
    
    const [attractions, restaurants] = await this.batchRequests([
      {
        prompt: promptTemplates.ATTRACTION_PROMPT
          .replace('{destination}', destination)
          .replace('{count}', Math.min(dayCount * 3, 15).toString())
          .replace('{interests}', interests.join(', ')),
        temperature: 0.8,
        cacheKey: attractionCache.cacheKey,
        cacheParams: attractionCache.cacheParams
      },
      {
        prompt: `${mealTimeGuidance}\n\n${promptTemplates.RESTAURANT_PROMPT}`
          .replace('{destination}', destination)
          .replace('{count}', Math.min(dayCount * 2, 10).toString())
          .replace('{preferences}', preferences.dietaryPreferences.join(', ')),
        temperature: 0.8,
        cacheKey: restaurantCache.cacheKey,
        cacheParams: restaurantCache.cacheParams
      }
    ], { signal: options.signal }) as [any[], any[]];
    
    // Step 2: Generate daily plans in parallel
    const dayPrompts = [];
    for (let i = 0; i < dayCount; i++) {
      const dayActivities = [
        ...attractions.slice(i * 2, i * 2 + 2),
        restaurants[i % restaurants.length]
      ];
      
      const dailyCache = createCacheKeyAndParams('daily', { 
        ...baseParams, 
        dayNumber: i + 1,
        transportMode: preferences.transportMode
      });
      
      dayPrompts.push({
        prompt: `${mealTimeGuidance}\n\n${promptTemplates.DAILY_PLAN_PROMPT}`
          .replace('{dayNumber}', (i + 1).toString())
          .replace('{destination}', destination)
          .replace('{activities}', JSON.stringify(dayActivities))
          .replace('{preferences}', preferences.dietaryPreferences.join(', '))
          .replace('{transportMode}', preferences.transportMode),
        temperature: 0.7,
        cacheKey: dailyCache.cacheKey,
        cacheParams: dailyCache.cacheParams
      });
    }
    
    const dailyPlans = await this.batchRequests(dayPrompts, { signal: options.signal });
    
    // Step 3: Create draft itinerary
    const draftItinerary = {
      destination,
      startDate,
      endDate,
      interests,
      preferences,
      days: dailyPlans.map((plan, i) => {
        const currentDate = safeParseDate(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        return {
          dayNumber: i + 1,
          date: currentDate.toISOString().split('T')[0],
          activities: (plan as any).orderedActivities || []
        };
      })
    };
    
    // Step 4: Balance and personalize in parallel
    const balancedCache = createCacheKeyAndParams('balanced', { 
      ...baseParams, 
      draftLength: JSON.stringify(draftItinerary).length 
    });
    const personalizedCache = createCacheKeyAndParams('personalized', { 
      ...baseParams,
      travelGroup: preferences.travelGroup,
      pace: preferences.pace
    });
    
    const [balancedItinerary, personalizedItinerary] = await Promise.all([
      this.processRequest({
        prompt: promptTemplates.ITINERARY_BALANCING_PROMPT
          .replace('{destination}', destination)
          .replace('{startDate}', startDate)
          .replace('{endDate}', endDate)
          .replace('{draftItinerary}', JSON.stringify(draftItinerary)),
        temperature: 0.7,
        cacheKey: balancedCache.cacheKey,
        cacheParams: balancedCache.cacheParams
      }, { signal: options.signal }),
      
      this.processRequest({
        prompt: promptTemplates.PERSONALIZATION_PROMPT
          .replace('{destination}', destination)
          .replace('{travelStyle}', preferences.travelStyle)
          .replace('{interests}', interests.join(', '))
          .replace('{travelGroup}', preferences.travelGroup)
          .replace('{budget}', preferences.budget)
          .replace('{dietaryPreferences}', preferences.dietaryPreferences.join(', ')),
        model: 'gpt-4-turbo-preview',
        temperature: 0.8,
        cacheKey: personalizedCache.cacheKey,
        cacheParams: personalizedCache.cacheParams
      }, { signal: options.signal, useCache: false })
    ]);
    
    // Merge results
    return {
      ...(balancedItinerary as any),
      ...(personalizedItinerary as any),
      destination,
      startDate,
      endDate
    };
  },
  
  /**
   * Simplified activity description enhancement
   */
  async enhanceActivityDescriptions(
    activities: Array<{ id: string; title: string; description: string }>,
    destination: string,
    options: { signal?: AbortSignal } = {}
  ) {
    const { signal } = options;
    
    if (activities.length === 0) {
      return activities;
    }
    
    // Create enhancement requests for all activities
    const enhancementRequests = activities.map(activity => {
      const descriptionCache = createCacheKeyAndParams('description', {
        destination,
        activityId: activity.id,
        title: activity.title
      });
      
      return {
        prompt: promptTemplates.DESCRIPTION_ENHANCEMENT_PROMPT
          .replace('{activity}', activity.title)
          .replace('{description}', activity.description)
          .replace('{destination}', destination),
        temperature: 0.8,
        cacheKey: descriptionCache.cacheKey,
        cacheParams: descriptionCache.cacheParams
      };
    });
    
    // Process all enhancements in parallel
    const enhancedDescriptions = await this.batchRequests(enhancementRequests, { signal });
    
    // Update activities with enhanced descriptions
    return activities.map((activity, index) => ({
      ...activity,
      description: (enhancedDescriptions[index] as string) || activity.description
    }));
  },
  
  /**
   * Simplified activity categorization
   */
  async categorizeActivities(
    activities: Array<{ id: string; title: string; description: string }>,
    options: { signal?: AbortSignal } = {}
  ) {
    if (activities.length === 0) {
      return activities;
    }
    
    // Categorize all activities in one request (or split if too large)
    const batchSize = 20;
    const results = [];
    
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      const batchIds = batch.map(a => a.id).join(',');
      
      const categorizationCache = createCacheKeyAndParams('categorization', { 
        batchIds,
        batchSize: batch.length 
      });
      
      const categorization = await this.processRequest({
        prompt: promptTemplates.ACTIVITY_CATEGORIZATION_PROMPT.replace(
          '{activities}',
          JSON.stringify(batch.map(a => ({ id: a.id, title: a.title, description: a.description })))
        ),
        temperature: 0.3,
        cacheKey: categorizationCache.cacheKey,
        cacheParams: categorizationCache.cacheParams
      }, { signal: options.signal });
      
      results.push(categorization);
    }
    
    // Flatten results and create categorization map
    const categorizations = results.flatMap(batch => batch);
    const categorizationMap = new Map();
    for (const cat of categorizations) {
      categorizationMap.set((cat as any).id, { 
        category: (cat as any).category, 
        subcategory: (cat as any).subcategory 
      });
    }
    
    // Apply categorizations to activities
    return activities.map(activity => ({
      ...activity,
      category: categorizationMap.get(activity.id)?.category || 'Activity',
      subcategory: categorizationMap.get(activity.id)?.subcategory || ''
    }));
  },
  
  /**
   * Get current service health status including circuit breaker state
   */
  getServiceHealth() {
    const circuitState = circuitBreaker.getState();
    
    return {
      circuitBreaker: {
        state: circuitState.state,
        failureCount: circuitState.failureCount,
        lastFailureTime: circuitState.lastFailureTime,
        isHealthy: circuitState.state === 'closed'
      },
      apiKeyConfigured: Boolean(apiKey && apiKey !== 'your_openai_api_key'),
      recommendation: this.getHealthRecommendation(circuitState.state)
    };
  },

  /**
   * Reset circuit breaker (useful for admin/debug purposes)
   */
  resetCircuitBreaker() {
    circuitBreaker.reset();
    console.log('[OpenAI] Circuit breaker reset');
  },

  /**
   * Get health recommendation based on circuit breaker state
   */
  getHealthRecommendation(state: string): string {
    switch (state) {
      case 'open':
        return 'Service is temporarily unavailable. Please wait a moment before trying again.';
      case 'half-open':
        return 'Service is recovering. Limited requests are being processed.';
      case 'closed':
        return 'Service is operating normally.';
      default:
        return 'Service status unknown.';
    }
  },

  /**
   * Enhanced error logging with structured data
   */
  logError(error: OpenAIServiceError, context?: Record<string, any>) {
    const logData = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        userMessage: error.userMessage,
        isRetryable: error.isRetryable,
        context: error.context
      },
      circuitBreakerState: circuitBreaker.getState(),
      additionalContext: context
    };

    console.error('[OpenAI] Structured Error Log:', logData);
    
    // In a real application, you might want to send this to an error tracking service
    // Example: errorTrackingService.logError(logData);
  },

  /**
   * Check if an error is recoverable and suggest next steps
   */
  analyzeError(error: any): {
    isRecoverable: boolean;
    suggestedAction: string;
    retryDelay?: number;
    shouldResetCircuitBreaker?: boolean;
  } {
    const classifiedError = error instanceof OpenAIServiceError ? error : classifyOpenAIError(error);
    
    switch (classifiedError.code) {
      case 'RATE_LIMIT_EXCEEDED':
        return {
          isRecoverable: true,
          suggestedAction: 'Wait and retry automatically',
          retryDelay: classifiedError.context?.retryAfter ? classifiedError.context.retryAfter * 1000 : 60000
        };
      
      case 'NETWORK_ERROR':
      case 'SERVICE_UNAVAILABLE':
        return {
          isRecoverable: true,
          suggestedAction: 'Check connection and retry',
          retryDelay: 5000
        };
      
      case 'AUTHENTICATION_FAILED':
      case 'QUOTA_EXCEEDED':
        return {
          isRecoverable: false,
          suggestedAction: 'Contact support or check API configuration'
        };
      
      case 'PARSE_ERROR':
        return {
          isRecoverable: true,
          suggestedAction: 'Retry with different parameters',
          retryDelay: 1000
        };
      
      default:
        return {
          isRecoverable: classifiedError.isRetryable,
          suggestedAction: classifiedError.isRetryable ? 'Retry operation' : 'Contact support',
          retryDelay: classifiedError.isRetryable ? 2000 : undefined
        };
    }
  },

  /**
   * Cleanup resources associated with this service
   */
  cleanup() {
    circuitBreaker.reset();
    console.log('[OpenAI] Service cleanup completed');
  },
  
  /**
   * Simplified itinerary generation
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
    // Validate API key
    const currentApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!currentApiKey || currentApiKey === 'your_openai_api_key') {
      throw new Error('OpenAI API key is missing or not configured. Please check your environment variables.');
    }

    // Format dates consistently
    const formattedStartDate = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0];
    const formattedEndDate = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0];
    
    const onProgress = userPreferences.onProgress;
    
    // Create standardized cache key - simplified approach
    const itineraryCache = createCacheKeyAndParams('itinerary', {
      destination,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      travelStyle: userPreferences.travelStyle || 'balanced',
      budget: userPreferences.budget || 'mid-range',
      interests: Array.isArray(userPreferences.interests) 
        ? userPreferences.interests.map((i: any) => i.label || i).join(',')
        : ''
    });
    
    const cacheKey = options.cacheKey || itineraryCache.cacheKey;
    
    // Check cache first
    try {
      const cached = await unifiedApiCache.get('openai-api', cacheKey);
      if (cached) {
        console.log(`[OpenAI] Cache hit for itinerary: ${cacheKey}`);
        if (onProgress) onProgress(100, 'Loading your cached itinerary...');
        return cached;
      }
    } catch (error) {
      console.warn('[OpenAI] Cache lookup failed, generating new itinerary:', error);
    }

    // **SIMPLIFIED GENERATION PROCESS**
    console.log(`[OpenAI] Generating new itinerary for ${destination}`);
    
    try {
      // Single progress update for start
      if (onProgress) onProgress(20, 'Creating your personalized itinerary...');
      
      // **SINGLE API CALL APPROACH** - Generate complete itinerary in one request
      const prompt = this.createItineraryPrompt(
        destination, 
        formattedStartDate, 
        formattedEndDate, 
        userPreferences
      );
      
      const response = await circuitBreaker.execute(async () => {
        return await enhancedRetry(async () => {
          return await openai.chat.completions.create({
            model: 'gpt-3.5-turbo-1106',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }, { signal: options.signal });
        });
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Failed to generate itinerary - empty response');
      }
      
      let itineraryData = JSON.parse(content);
      
      // Basic validation and cleanup
      if (!itineraryData.destination) {
        itineraryData.destination = destination;
      }
      
      if (!itineraryData.title) {
        const durationDays = Math.ceil(
          (new Date(formattedEndDate).getTime() - new Date(formattedStartDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        ) + 1;
        itineraryData.title = `${durationDays}-Day Trip to ${destination}`;
      }
      
      // Progress update for main generation complete
      if (onProgress) onProgress(80, 'Finalizing your itinerary...');
      
      // **OPTIONAL LIGHTWEIGHT ENHANCEMENT** - Only if explicitly requested
      if ((options.useTripadvisor || options.useGoogleMaps) && userPreferences.useExternalData) {
        try {
          itineraryData = await this.enhanceItineraryLightweight(
            itineraryData,
            {
              useTripadvisor: !!options.useTripadvisor,
              useGoogleMaps: !!options.useGoogleMaps,
              destination
            }
          );
        } catch (enhancementError) {
          // Don't fail the entire generation if enhancement fails
          console.warn('External data enhancement failed, using base itinerary:', enhancementError);
        }
      }
      
      // Final progress update
      if (onProgress) onProgress(100, 'Your itinerary is ready!');
      
      // Cache the result
      try {
        await unifiedApiCache.set('openai-api', cacheKey, itineraryData);
        console.log(`[OpenAI] Cached itinerary result for: ${cacheKey}`);
      } catch (error) {
        console.warn('[OpenAI] Failed to cache itinerary result:', error);
      }
      
      return itineraryData;
      
    } catch (error: any) {
      console.error('Error generating itinerary:', error);
      
      // **SIMPLIFIED ERROR HANDLING**
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        throw new OpenAIServiceError(
          'Itinerary generation was canceled',
          'REQUEST_ABORTED',
          'Itinerary generation was canceled',
          false
        );
      }
      
      // Re-throw classified errors, or create simple error for others
      if (error instanceof OpenAIServiceError) {
        throw error;
      }
      
      throw new OpenAIServiceError(
        error.message || 'Failed to generate itinerary',
        'GENERATION_FAILED',
        'Failed to generate your itinerary. Please try again.',
        true,
        { destination, operation: 'generateItinerary' }
      );
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
    
    // Get cultural meal time guidance for this destination
    const mealTimeGuidance = getMealTimeGuidance(destination);
    
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

${mealTimeGuidance}

REQUIREMENTS:
1. Create a day-by-day itinerary with 3-5 activities per day including meals.
2. Each day should start around 8-9 AM and end around 9-10 PM unless specified otherwise.
3. Include a mix of popular attractions and hidden gems based on the interests.
4. Schedule activities at realistic times with appropriate breaks and travel time between locations.
5. For meals, recommend specific restaurants that match the budget and dietary preferences. STRICTLY follow the meal time guidelines above.
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
   * Simplified lightweight external data enhancement - optional and fast
   */
  async enhanceItineraryLightweight(
    itineraryData: any,
    options: {
      useTripadvisor?: boolean;
      useGoogleMaps?: boolean;
      destination: string;
    }
  ) {
    if (!itineraryData.days || itineraryData.days.length === 0) {
      return itineraryData;
    }
    
    const enhancedItinerary = { ...itineraryData };
    
    // Extract only restaurant activities for lightweight enhancement
    const restaurantActivities = enhancedItinerary.days.flatMap((day: any) => 
      day.activities.filter((activity: any) => 
        activity.type === 'food' || 
        activity.name?.toLowerCase().includes('restaurant') ||
        activity.name?.toLowerCase().includes('dinner') ||
        activity.name?.toLowerCase().includes('lunch') ||
        activity.name?.toLowerCase().includes('breakfast')
      )
    );
    
    // Only enhance a maximum of 3 restaurants to keep it fast
    const topRestaurants = restaurantActivities.slice(0, 3);
    
    if (topRestaurants.length === 0) {
      return enhancedItinerary;
    }
    
    console.log(`[OpenAI] Lightweight enhancement for ${topRestaurants.length} key restaurants`);
    
    // **SIMPLIFIED ENHANCEMENT** - Only for key restaurants, with timeout
    const enhancementPromises = topRestaurants.map(async (restaurant: any) => {
      try {
        // Quick Google Maps lookup with short timeout
        if (options.useGoogleMaps) {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000)
          );
          
          const mapsPromise = googleMapsService.getPlaceDetails(restaurant.name);
          
          const details = await Promise.race([mapsPromise, timeoutPromise]);
          if (details) {
            restaurant.location = details.formatted_address || restaurant.location;
            restaurant.rating = details.rating || restaurant.rating;
          }
        }
      } catch (error) {
        // Silently fail enhancement - don't log unless debugging
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Enhancement failed for ${restaurant.name}:`, error);
        }
      }
    });
    
    // Wait for all enhancements with overall timeout
    try {
      await Promise.race([
        Promise.all(enhancementPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Enhancement timeout')), 5000))
      ]);
    } catch (error) {
      console.debug('Some enhancements timed out, using base itinerary');
    }
    
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

CRITICAL DATE RANGE PARSING RULES:
- When parsing date ranges like "august 2-4", "may 15-18", or "december 1-3":
  * The first number is the START date (e.g., "august 2-4" means START on August 2nd)
  * The second number is the END date (e.g., "august 2-4" means END on August 4th)
  * "august 2-4" should be parsed as startDate: "2025-08-02", endDate: "2025-08-04"
  * "may 15-18" should be parsed as startDate: "2025-05-15", endDate: "2025-05-18"
  * "december 1-3" should be parsed as startDate: "2025-12-01", endDate: "2025-12-03"
- When parsing phrases like "from august 2 to 4" or "from august 2-4":
  * This means START on August 2nd and END on August 4th
  * NOT August 1st to August 3rd
- Always interpret the numbers in date ranges as literal calendar dates, not as day counts or durations

EXAMPLES:
- "plan a trip to chicago from august 2-4" → startDate: "2025-08-02", endDate: "2025-08-04"
- "visit paris may 15-18" → startDate: "2025-05-15", endDate: "2025-05-18"
- "go to tokyo from december 1 to 3" → startDate: "2025-12-01", endDate: "2025-12-03"

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
  }
};

export default enhancedOpenAIService; 