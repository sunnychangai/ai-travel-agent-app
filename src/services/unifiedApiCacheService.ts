import { ApiCache } from '../utils/cacheUtils';
import { withRetry, ApiError } from '../utils/apiUtils';
import { useCacheManager } from '../hooks/useCacheManager';

export interface ApiCacheConfig {
  namespace: string;
  ttl: number;
  maxItems?: number;
  userScoped?: boolean;
  persistence?: boolean;
  compression?: boolean;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
  retryOptions?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  };
  cacheOptions?: {
    useCache?: boolean;
    cacheKey?: string;
    forceFresh?: boolean;
    cacheParams?: Record<string, any>;
  };
  deduplication?: {
    enabled?: boolean;
    key?: string;
    expiryMs?: number;
  };
  debouncing?: {
    enabled?: boolean;
    key?: string;
    delayMs?: number;
  };
}

/**
 * Unified API Cache Service
 * Consolidates all API caching into a single configurable system
 */
export class UnifiedApiCacheService {
  private cacheManager: any;
  private configs: Map<string, ApiCacheConfig> = new Map();
  private pendingRequests = new Map<string, Promise<any>>();
  private lastRequestTimes = new Map<string, number>();
  private pendingDebouncedRequests = new Map<string, { 
    resolve: (value: any) => void; 
    reject: (reason: any) => void;
    request: () => Promise<any>;
    timeoutId: NodeJS.Timeout;
  }>();

  constructor(cacheManager?: any) {
    this.cacheManager = cacheManager;
    this.setupDefaultConfigs();
  }

  private setupDefaultConfigs() {
    // Register default API cache configurations
    this.registerApiCache({
      namespace: 'openai-api',
      ttl: 30 * 60 * 1000, // 30 minutes
      maxItems: 200,
      userScoped: true,
      persistence: true,
      compression: true
    });

    this.registerApiCache({
      namespace: 'google-maps-api',
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      maxItems: 500,
      userScoped: true,
      persistence: true,
      compression: false // Coordinates/addresses don't compress well
    });

    this.registerApiCache({
      namespace: 'tripadvisor-api',
      ttl: 60 * 60 * 1000, // 1 hour
      maxItems: 300,
      userScoped: true,
      persistence: true,
      compression: true
    });

    this.registerApiCache({
      namespace: 'recommendations-api',
      ttl: 30 * 60 * 1000, // 30 minutes
      maxItems: 100,
      userScoped: true,
      persistence: true,
      compression: true
    });

    this.registerApiCache({
      namespace: 'general-api',
      ttl: 15 * 60 * 1000, // 15 minutes
      maxItems: 150,
      userScoped: true,
      persistence: true,
      compression: true
    });
  }

  /**
   * Register a new API cache configuration
   */
  registerApiCache(config: ApiCacheConfig) {
    this.configs.set(config.namespace, config);
    
    // Register with cache manager if available
    if (this.cacheManager) {
      this.cacheManager.registerCache(config);
    }
  }

  /**
   * Generate a comprehensive cache key for an API request
   */
  private generateCacheKey(
    namespace: string, 
    url: string, 
    options: ApiRequestOptions = {}
  ): string {
    const { method = 'GET', body, cacheOptions } = options;
    
    // Use custom cache key if provided
    if (cacheOptions?.cacheKey) {
      return `${namespace}:${cacheOptions.cacheKey}`;
    }

    // Build cache key from request parameters
    const keyParts = [namespace, method, url];
    
    // Include body hash for POST/PUT requests
    if (body && (method === 'POST' || method === 'PUT')) {
      const bodyHash = this.hashObject(body);
      keyParts.push(`body:${bodyHash}`);
    }

    // Include cache params if provided
    if (cacheOptions?.cacheParams) {
      const paramsHash = this.hashObject(cacheOptions.cacheParams);
      keyParts.push(`params:${paramsHash}`);
    }

    return keyParts.join(':');
  }

  /**
   * Simple object hashing for cache keys
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get data from cache
   */
  async get<T>(namespace: string, cacheKey: string): Promise<T | null> {
    if (!this.cacheManager) return null;
    return this.cacheManager.get(namespace, cacheKey);
  }

  /**
   * Set data in cache
   */
  async set<T>(namespace: string, cacheKey: string, data: T): Promise<void> {
    if (!this.cacheManager) return;
    
    const config = this.configs.get(namespace);
    if (config) {
      this.cacheManager.set(namespace, cacheKey, data, {
        compress: config.compression
      });
    }
  }

  /**
   * Make a cached API request with unified request handling
   */
  async request<T>(
    namespace: string,
    url: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      signal,
      retryOptions = {},
      cacheOptions = { useCache: true },
      deduplication = { enabled: true },
      debouncing = { enabled: false }
    } = options;

    // Generate cache key
    const cacheKey = this.generateCacheKey(namespace, url, options);

    // Check cache first (unless forcing fresh data)
    if (cacheOptions.useCache && !cacheOptions.forceFresh) {
      const cached = await this.get<T>(namespace, cacheKey);
      if (cached) {
        console.log(`[UnifiedApiCache] Cache hit for ${namespace}: ${cacheKey}`);
        return cached;
      }
    }

    console.log(`[UnifiedApiCache] Cache miss for ${namespace}: ${cacheKey}`);

    // Create the API call function
    const makeApiCall = async (): Promise<T> => {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        signal
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = JSON.stringify(body);
      }

      // Make request with retry logic
      const response = await withRetry(async () => {
        const res = await fetch(url, fetchOptions);
        
        if (!res.ok) {
          throw new ApiError(`HTTP ${res.status}: ${res.statusText}`, {
            status: res.status,
            isRateLimitError: res.status === 429
          });
        }
        
        return res;
      }, {
        maxRetries: retryOptions.maxRetries || 3,
        initialDelay: retryOptions.initialDelay || 1000,
        maxDelay: retryOptions.maxDelay || 10000,
        shouldRetry: retryOptions.shouldRetry || ((error) => {
          if (error instanceof ApiError) {
            return (
              error.isNetworkError || 
              error.isRateLimitError || 
              error.status === 502 || 
              error.status === 503 || 
              error.status === 504
            );
          }
          return false;
        })
      });

      // Parse response
      const contentType = response.headers.get('content-type');
      let data: T;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text() as unknown as T;
      }

      // Cache the result
      if (cacheOptions.useCache) {
        await this.set(namespace, cacheKey, data);
      }

      return data;
    };

    // Apply request deduplication if enabled
    let requestPromise = makeApiCall();
    
    if (deduplication.enabled) {
      const dedupeKey = `${namespace}:${deduplication.key || cacheKey}`;
      const existingRequest = this.pendingRequests.get(dedupeKey);
      if (existingRequest) {
        console.log(`[UnifiedApiCache] Deduplicating request: ${dedupeKey}`);
        return existingRequest;
      }
      
      // Store the promise and clean up after completion
      this.pendingRequests.set(dedupeKey, requestPromise);
      requestPromise.finally(() => {
        setTimeout(() => {
          this.pendingRequests.delete(dedupeKey);
        }, deduplication.expiryMs || 1000);
      });
    }

    // Apply request debouncing if enabled
    if (debouncing.enabled) {
      const debounceKey = debouncing.key || `${namespace}:${method}`;
      const now = Date.now();
      const lastRequest = this.lastRequestTimes.get(debounceKey) || 0;
      const timeSinceLast = now - lastRequest;
      
      if (timeSinceLast < (debouncing.delayMs || 300)) {
        // Cancel existing debounced request if any
        const existing = this.pendingDebouncedRequests.get(debounceKey);
        if (existing) {
          clearTimeout(existing.timeoutId);
          this.pendingDebouncedRequests.delete(debounceKey);
        }
        
        // Create new debounced promise
        return new Promise<T>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            this.pendingDebouncedRequests.delete(debounceKey);
            this.lastRequestTimes.set(debounceKey, Date.now());
            requestPromise.then(resolve).catch(reject);
          }, (debouncing.delayMs || 300) - timeSinceLast);
          
          this.pendingDebouncedRequests.set(debounceKey, {
            resolve,
            reject,
            request: () => requestPromise,
            timeoutId
          });
        });
      }
      
      this.lastRequestTimes.set(debounceKey, now);
    }

    return requestPromise;
  }

  /**
   * Clear cache for a specific namespace
   */
  async clearNamespaceCache(namespace: string): Promise<void> {
    if (this.cacheManager) {
      this.cacheManager.clearNamespace(namespace);
    }
  }

  /**
   * Clear all API caches
   */
  async clearAllCaches(): Promise<void> {
    if (this.cacheManager) {
      for (const namespace of this.configs.keys()) {
        await this.clearNamespaceCache(namespace);
      }
    }
    
    // Clear internal caches
    this.pendingRequests.clear();
    this.lastRequestTimes.clear();
    this.pendingDebouncedRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    if (!this.cacheManager) return null;
    
    const stats: Record<string, any> = {};
    for (const namespace of this.configs.keys()) {
      stats[namespace] = this.cacheManager.getStats(namespace);
    }
    return stats;
  }

  /**
   * Preload critical data (cache warming)
   */
  async warmCache(namespace: string, requests: Array<{
    url: string;
    options?: ApiRequestOptions;
    priority?: 'high' | 'medium' | 'low';
  }>) {
    console.log(`[UnifiedApiCache] Warming cache for ${namespace} with ${requests.length} requests`);
    
    // Sort by priority
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
    });

    // Process high priority requests first, then medium and low in parallel
    const highPriority = sortedRequests.filter(r => r.priority === 'high');
    const mediumPriority = sortedRequests.filter(r => r.priority === 'medium');
    const lowPriority = sortedRequests.filter(r => (r.priority || 'medium') === 'low');

    // Execute high priority requests sequentially
    for (const request of highPriority) {
      try {
        await this.request(namespace, request.url, {
          ...request.options,
          cacheOptions: { useCache: true, ...request.options?.cacheOptions }
        });
      } catch (error) {
        console.warn(`[UnifiedApiCache] Cache warming failed for high priority request: ${request.url}`, error);
      }
    }

    // Execute medium and low priority requests in parallel
    const parallelRequests = [...mediumPriority, ...lowPriority];
    await Promise.allSettled(
      parallelRequests.map(async (request) => {
        try {
          await this.request(namespace, request.url, {
            ...request.options,
            cacheOptions: { useCache: true, ...request.options?.cacheOptions }
          });
        } catch (error) {
          console.warn(`[UnifiedApiCache] Cache warming failed for request: ${request.url}`, error);
        }
      })
    );

    console.log(`[UnifiedApiCache] Cache warming completed for ${namespace}`);
  }

  /**
   * Background refresh of stale cache entries
   */
  async refreshStaleCache(namespace: string, maxAge: number = 30 * 60 * 1000) {
    // This would typically query the cache manager for stale entries
    // and refresh them in the background
    console.log(`[UnifiedApiCache] Refreshing stale cache entries for ${namespace} older than ${maxAge}ms`);
    
    // Implementation would depend on cache manager's ability to enumerate entries
    // For now, this is a placeholder for the concept
  }
}

// Create and export singleton instance
export const unifiedApiCache = new UnifiedApiCacheService();

// Hook for React components to use the unified API cache
export function useUnifiedApiCache() {
  const cacheManager = useCacheManager();
  
  // Initialize the cache service with cache manager if not already done
  if (cacheManager && !unifiedApiCache['cacheManager']) {
    unifiedApiCache['cacheManager'] = cacheManager;
  }
  
  return unifiedApiCache;
} 