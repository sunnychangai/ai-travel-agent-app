/**
 * Utilities for API requests with retry logic and error handling
 */

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryBackoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  status?: number;
  isNetworkError: boolean;
  isRateLimitError: boolean;
  
  constructor(message: string, options: { 
    status?: number; 
    isNetworkError?: boolean;
    isRateLimitError?: boolean;
  } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.isNetworkError = options.isNetworkError || false;
    this.isRateLimitError = options.isRateLimitError || false;
  }
}

/**
 * Execute function with retry logic
 * @param fn Function to execute (should return a Promise)
 * @param options Retry options
 * @returns Promise that resolves with the result of fn
 */
export async function withRetry<T>(
  fn: () => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  const { 
    maxRetries = 3, 
    retryDelay = 1000, 
    retryBackoffFactor = 2,
    shouldRetry = (error) => {
      // By default, retry on network errors and rate limit errors (429)
      if (error instanceof ApiError) {
        return error.isNetworkError || error.status === 429;
      }
      return false;
    }
  } = options;

  let lastError: any;
  let currentDelay = retryDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If this was the last attempt or we shouldn't retry, throw the error
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Log the retry
      console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${currentDelay}ms`, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      // Increase delay for next attempt using backoff factor
      currentDelay *= retryBackoffFactor;
    }
  }

  // This code should never be reached due to the throws above, but TypeScript doesn't know that
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
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('network')) {
      throw new ApiError('Network error: Failed to reach the server', {
        isNetworkError: true
      });
    }
    
    // Other errors
    throw new ApiError(`Fetch error: ${error.message}`, {});
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