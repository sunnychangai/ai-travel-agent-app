/**
 * Utilities for API requests with retry logic and error handling
 */

import { ApiCache } from './cacheUtils';

// Create caches for different API endpoints
export const tripAdvisorCache = new ApiCache<any>('TripAdvisor', 60 * 60 * 1000); // 1 hour expiration
export const googleMapsCache = new ApiCache<any>('GoogleMaps', 24 * 60 * 60 * 1000); // 24 hours expiration
export const generalApiCache = new ApiCache<any>('GeneralAPI', 30 * 60 * 1000); // 30 minutes expiration

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryBackoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

interface CacheOptions {
  useCache?: boolean;
  cacheKey?: string;
  cacheDuration?: number;
  cache?: ApiCache<any>;
}

/**
 * Error class for API errors with additional properties for better error handling
 */
export class ApiError extends Error {
  status?: number;
  isNetworkError: boolean;
  isRateLimitError: boolean;
  
  constructor(
    message: string, 
    options: { status?: number; isNetworkError?: boolean; isRateLimitError?: boolean } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.isNetworkError = options.isNetworkError || false;
    this.isRateLimitError = options.isRateLimitError || false;
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param options Retry options
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff, capped at maxDelay
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      // Add some jitter to prevent thundering herd problem
      const jitter = Math.random() * 0.3 * delay;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
}

/**
 * Wrap a fetch call with consistent error handling
 * @param url URL to fetch
 * @param options Fetch options
 * @returns Promise that resolves with the fetch response
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}: ${response.statusText}`, {
        status: response.status,
        isRateLimitError: response.status === 429
      });
    }
    
    return response;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Check if it's a network error
    if (error instanceof TypeError && (error as Error).message.includes('network')) {
      throw new ApiError('Network error: Failed to reach the server', {
        isNetworkError: true
      });
    }
    
    // Other errors
    throw new ApiError(`Fetch error: ${(error as Error).message}`, {});
  }
}

/**
 * Fetch with retry logic
 * @param url URL to fetch
 * @param options Fetch options
 * @param retryOptions Retry options
 * @returns Promise that resolves with the fetch response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(() => safeFetch(url, options), retryOptions);
}

/**
 * Fetch with caching and retry logic
 * @param url URL to fetch
 * @param options Fetch options
 * @param cacheOptions Cache options
 * @param retryOptions Retry options
 * @returns Promise that resolves with the parsed JSON response
 */
export async function fetchWithCache<T = any>(
  url: string,
  options: RequestInit = {},
  cacheOptions: CacheOptions = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const {
    useCache = true,
    cacheKey = url,
    cache = generalApiCache
  } = cacheOptions;

  // Check if we should use the cache
  if (useCache) {
    // Try to get from cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      // If we have cached data, use it
      console.log(`[ApiCache] Cache hit for: ${cacheKey}`);
      return cachedData as T;
    }
  }

  // If no cache hit or caching disabled, proceed with the fetch
  console.log(`[ApiCache] Cache miss for: ${cacheKey}`);
  const response = await fetchWithRetry(url, options, retryOptions);
  const data = await response.json();

  // Cache the result if caching is enabled
  if (useCache) {
    cache.set(cacheKey, data);
  }

  return data as T;
}

/**
 * Clear all API caches
 */
export function clearAllApiCaches(): void {
  tripAdvisorCache.clear();
  googleMapsCache.clear();
  generalApiCache.clear();
}

// In-memory request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicates identical API requests that happen simultaneously
 * @param cacheKey A unique key identifying the request
 * @param apiCall The function that makes the API call
 * @param expiryMs How long to keep the request cached (default: 1000ms)
 * @returns The API call result
 */
export function deduplicateRequest<T>(
  cacheKey: string,
  apiCall: () => Promise<T>,
  expiryMs: number = 1000
): Promise<T> {
  // If this exact request is already in progress, return the existing promise
  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }
  
  // Otherwise, make the request and cache the promise
  const request = apiCall();
  pendingRequests.set(cacheKey, request);
  
  // Remove the request from the cache after it completes or after expiry
  const cleanup = () => {
    // Use setTimeout to ensure the request is kept in cache for at least expiryMs
    setTimeout(() => {
      // Only remove if it's still the same promise (not replaced)
      if (pendingRequests.get(cacheKey) === request) {
        pendingRequests.delete(cacheKey);
      }
    }, expiryMs);
  };
  
  // Clean up after request completes (success or failure)
  request.then(cleanup).catch(cleanup);
  
  return request;
}

// Track the last time each request type was made
const lastRequestTimes = new Map<string, number>();
const pendingDebouncedRequests = new Map<string, { 
  resolve: (value: any) => void; 
  reject: (reason: any) => void;
  request: () => Promise<any>;
  timeoutId: NodeJS.Timeout;
}>();

/**
 * Debounces API requests by type to prevent rapid duplicates
 * @param requestType A key identifying the type of request
 * @param apiCall The function that makes the API call 
 * @param debounceMs The debounce window in milliseconds
 * @returns A promise that resolves with the API result
 */
export function debounceRequest<T>(
  requestType: string,
  apiCall: () => Promise<T>,
  debounceMs: number = 300
): Promise<T> {
  const now = Date.now();
  const lastRequest = lastRequestTimes.get(requestType) || 0;
  const timeSinceLast = now - lastRequest;
  
  // If a request of this type is pending debounce, cancel it and resolve with this call instead
  if (pendingDebouncedRequests.has(requestType)) {
    const { resolve, reject, timeoutId } = pendingDebouncedRequests.get(requestType)!;
    clearTimeout(timeoutId);
    pendingDebouncedRequests.delete(requestType);
    
    // We'll resolve this previous promise with the result of our new call
    return new Promise<T>((newResolve, newReject) => {
      // Execute the request immediately (no debounce) since we're replacing a pending one
      apiCall().then(result => {
        resolve(result); // Resolve the old promise
        newResolve(result); // Resolve our new promise
        lastRequestTimes.set(requestType, Date.now());
      }).catch(error => {
        reject(error); // Reject the old promise
        newReject(error); // Reject our new promise
      });
    });
  }
  
  // If we've recently made this request type and we're within the debounce window
  if (timeSinceLast < debounceMs) {
    return new Promise<T>((resolve, reject) => {
      // Setup a timeout to make the call after the debounce period
      const timeoutId = setTimeout(() => {
        pendingDebouncedRequests.delete(requestType);
        apiCall().then(resolve).catch(reject).finally(() => {
          lastRequestTimes.set(requestType, Date.now());
        });
      }, debounceMs - timeSinceLast);
      
      // Store this pending request
      pendingDebouncedRequests.set(requestType, { 
        resolve, 
        reject, 
        request: apiCall,
        timeoutId
      });
    });
  }
  
  // No recent request of this type, make the call immediately
  lastRequestTimes.set(requestType, now);
  return apiCall();
} 