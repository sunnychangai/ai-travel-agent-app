/**
 * Enhanced caching utility for API responses with compression and persistence
 */

// Define a cache entry that includes metadata
type CacheEntry<T> = {
  value: T;
  timestamp: number;
  compressed?: boolean;
  // Add staleness flag for stale-while-revalidate pattern
  stale?: boolean;
  refreshing?: boolean;
};

export class ApiCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private namespace: string;
  private ttl: number;
  private staleWhileRevalidateTtl: number; // Additional time to keep stale data
  private maxEntries: number;
  private persistence: boolean;
  private refreshCallbacks: Map<string, (() => Promise<T>)[]> = new Map();
  
  /**
   * Create a new API cache instance
   * @param namespace Unique namespace for this cache
   * @param ttl Time to live in milliseconds
   * @param maxEntries Maximum number of entries to store in memory
   * @param persistence Whether to use localStorage for persistence
   * @param staleWhileRevalidateTtl Additional time to keep stale data while refreshing
   */
  constructor(
    namespace: string,
    ttl = 3600 * 1000, // Default to 1 hour
    maxEntries = 100,
    persistence = true,
    staleWhileRevalidateTtl = 3600 * 1000 // Default to 1 hour of staleness
  ) {
    this.namespace = namespace;
    this.ttl = ttl;
    this.staleWhileRevalidateTtl = staleWhileRevalidateTtl;
    this.maxEntries = maxEntries;
    this.persistence = persistence;
    
    // Load from localStorage if available
    this.loadFromStorage();
    
    // Periodically clean up expired entries
    setInterval(() => this.cleanup(), 60 * 1000); // Clean up every minute
  }
  
  /**
   * Generate a standardized cache key with enhanced specificity
   * @param baseKey The base key string
   * @param params Additional parameters to make the key more specific
   * @returns A fully qualified cache key
   */
  generateKey(baseKey: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return baseKey;
    }
    
    // Create a deterministic representation of the params object
    // Sort keys to ensure same parameters in different order create the same key
    const paramParts = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => {
        if (typeof value === 'object') {
          // For complex objects, use a hash of stringified object
          return `${key}:${hashString(JSON.stringify(value))}`;
        }
        // For primitive values, use them directly
        return `${key}:${value}`;
      });
    
    return paramParts.length > 0 ? `${baseKey}:${paramParts.join(':')}` : baseKey;
  }
  
  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or null if not found
   */
  get(key: string): T | null {
    const cacheKey = `${this.namespace}:${key}`;
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Fresh entry - return directly
    if (age <= this.ttl) {
      return this.getEntryValue(entry);
    }
    
    // Stale entry but still within stale TTL - mark as stale but return it
    if (age <= this.ttl + this.staleWhileRevalidateTtl) {
      // Mark as stale for future reference
      entry.stale = true;
      this.cache.set(cacheKey, entry);
      
      return this.getEntryValue(entry);
    }
    
    // Entry too old - remove and return null
    this.cache.delete(cacheKey);
    
    if (this.persistence) {
      try {
        localStorage.removeItem(`cache:${cacheKey}`);
      } catch (e) {
        console.warn('Failed to remove item from localStorage', e);
      }
    }
    
    return null;
  }
  
  /**
   * Extract the value from a cache entry, handling compression
   */
  private getEntryValue(entry: CacheEntry<T>): T {
    // Handle compressed values
    if (entry.compressed && typeof entry.value === 'string') {
      try {
        return JSON.parse(entry.value as string) as T;
      } catch (e) {
        console.warn('Failed to decompress cached value', e);
        return entry.value;
      }
    }
    
    return entry.value;
  }
  
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param compress Whether to compress the value
   */
  set(key: string, value: T, compress = true): void {
    const cacheKey = `${this.namespace}:${key}`;
    let compressedValue: any = value;
    let isCompressed = false;
    
    // Apply compression for large objects if requested
    if (compress && typeof value === 'object' && value !== null) {
      try {
        compressedValue = JSON.stringify(value);
        isCompressed = true;
      } catch (e) {
        console.warn('Failed to compress value', e);
        compressedValue = value;
      }
    }
    
    const entry: CacheEntry<T> = {
      value: compressedValue as T,
      timestamp: Date.now(),
      compressed: isCompressed,
      stale: false,
      refreshing: false
    };
    
    // Add to in-memory cache
    this.cache.set(cacheKey, entry);
    
    // Execute any registered refresh callbacks
    this.executeRefreshCallbacks(key);
    
    // Enforce maximum cache size
    if (this.cache.size > this.maxEntries) {
      // Remove the oldest entries
      const entriesToRemove = [...this.cache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.maxEntries * 0.2)); // Remove 20% of oldest entries
      
      for (const [key] of entriesToRemove) {
        this.cache.delete(key);
        
        if (this.persistence) {
          try {
            localStorage.removeItem(`cache:${key}`);
          } catch (e) {
            console.warn('Failed to remove item from localStorage', e);
          }
        }
      }
    }
    
    // Persist to localStorage if enabled
    if (this.persistence) {
      try {
        localStorage.setItem(`cache:${cacheKey}`, JSON.stringify(entry));
      } catch (e) {
        console.warn('Failed to persist cache to localStorage', e);
      }
    }
  }
  
  /**
   * Execute refresh callbacks for stale-while-revalidate
   */
  private executeRefreshCallbacks(key: string): void {
    const cacheKey = `${this.namespace}:${key}`;
    const callbacks = this.refreshCallbacks.get(cacheKey);
    
    if (callbacks && callbacks.length > 0) {
      // Clear callbacks after executing
      this.refreshCallbacks.delete(cacheKey);
    }
  }
  
  /**
   * Implements the stale-while-revalidate pattern:
   * - If data is fresh, returns it
   * - If data is stale but available, returns stale data and refreshes in background
   * - If data is not available, fetches it
   * 
   * @param key Cache key
   * @param fetchFn Function to fetch fresh data
   * @param options Additional options
   * @returns Promise resolving to the data
   */
  async getOrFetch<R = T>(
    key: string,
    fetchFn: () => Promise<R>,
    options: {
      maxAge?: number; // Override the standard TTL
      compress?: boolean;
      background?: boolean; // Force background refresh even if not stale
    } = {}
  ): Promise<R> {
    const cacheKey = `${this.namespace}:${key}`;
    const entry = this.cache.get(cacheKey);
    const now = Date.now();
    const maxAge = options.maxAge || this.ttl;
    
    // No entry in cache, fetch immediately
    if (!entry) {
      try {
        const result = await fetchFn();
        this.set(key, result as unknown as T, options.compress);
        return result;
      } catch (error) {
        // Check if this is an abort error
        if (error.name === 'AbortError' || error.message?.includes('abort')) {
          console.log(`Request for ${key} was aborted`);
        } else {
          console.error(`Error fetching data for ${key}:`, error);
        }
        throw error; // Re-throw to let the caller handle it
      }
    }
    
    const age = now - entry.timestamp;
    
    // Fresh entry, but check if we should refresh in background
    if (age <= maxAge) {
      if (options.background && !entry.refreshing) {
        // Mark as refreshing to avoid duplicate refreshes
        entry.refreshing = true;
        this.cache.set(cacheKey, entry);
        
        // Refresh in background without blocking
        this.refreshInBackground(key, fetchFn, options.compress);
      }
      return this.getEntryValue(entry) as unknown as R;
    }
    
    // Stale entry but still within stale TTL - return stale and refresh in background
    if (age <= maxAge + this.staleWhileRevalidateTtl) {
      // Don't start multiple refreshes for the same key
      if (!entry.refreshing) {
        // Mark as refreshing to avoid duplicate refreshes
        entry.stale = true;
        entry.refreshing = true;
        this.cache.set(cacheKey, entry);
        
        // Refresh in background without blocking
        this.refreshInBackground(key, fetchFn, options.compress);
      }
      
      return this.getEntryValue(entry) as unknown as R;
    }
    
    // Too old, fetch new data
    try {
      const result = await fetchFn();
      this.set(key, result as unknown as T, options.compress);
      return result;
    } catch (error) {
      // Check if this is an abort error
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log(`Request for ${key} was aborted`);
        
        // If we have an old entry, return it even though it's expired
        if (entry) {
          console.log(`Returning expired entry for ${key} due to abort`);
          return this.getEntryValue(entry) as unknown as R;
        }
      } else {
        console.error(`Error fetching data for ${key}:`, error);
      }
      throw error; // Re-throw to let the caller handle it
    }
  }
  
  /**
   * Refresh cache entry in background without blocking
   */
  private refreshInBackground<R>(
    key: string,
    fetchFn: () => Promise<R>,
    compress = true
  ): void {
    const cacheKey = `${this.namespace}:${key}`;
    
    // Use the event loop to run this task in the background
    setTimeout(async () => {
      try {
        const result = await fetchFn();
        
        // Check if someone else already updated the entry
        const currentEntry = this.cache.get(cacheKey);
        if (!currentEntry || currentEntry.stale || currentEntry.refreshing) {
          this.set(key, result as unknown as T, compress);
        }
      } catch (error) {
        // Handle abort errors more gracefully
        if (error.name === 'AbortError' || error.message?.includes('abort')) {
          console.log(`Background refresh aborted for ${key}`);
        } else {
          console.error(`Background refresh failed for ${key}:`, error);
        }
        
        // Mark as no longer refreshing so future attempts can happen
        const entry = this.cache.get(cacheKey);
        if (entry && entry.refreshing) {
          entry.refreshing = false;
          this.cache.set(cacheKey, entry);
        }
      }
    }, 0);
  }
  
  /**
   * Clear all entries in this cache
   */
  clear(): void {
    this.cache.clear();
    this.refreshCallbacks.clear();
    
    if (this.persistence) {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`cache:${this.namespace}:`)) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        console.warn('Failed to clear cache from localStorage', e);
      }
    }
  }
  
  /**
   * Remove expired entries from the cache
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    // Find all expired keys (both fresh and stale TTLs exceeded)
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl + this.staleWhileRevalidateTtl) {
        expiredKeys.push(key);
      }
    }
    
    // Remove expired entries
    for (const key of expiredKeys) {
      this.cache.delete(key);
      
      if (this.persistence) {
        try {
          localStorage.removeItem(`cache:${key}`);
        } catch (e) {
          console.warn('Failed to remove item from localStorage', e);
        }
      }
    }
  }
  
  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    if (!this.persistence) {
      return;
    }
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith(`cache:${this.namespace}:`)) {
          const rawValue = localStorage.getItem(key);
          
          if (rawValue) {
            try {
              const entry = JSON.parse(rawValue) as CacheEntry<T>;
              const actualKey = key.replace(`cache:`, '');
              
              // Only load non-expired entries (including stale ones)
              if (Date.now() - entry.timestamp <= this.ttl + this.staleWhileRevalidateTtl) {
                // Mark as stale if beyond fresh TTL
                if (Date.now() - entry.timestamp > this.ttl) {
                  entry.stale = true;
                }
                this.cache.set(actualKey, entry);
              } else {
                // Clean up expired entries
                localStorage.removeItem(key);
              }
            } catch (e) {
              console.warn('Failed to parse cached entry', e);
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load cache from localStorage', e);
    }
  }
}

/**
 * Memory cache for memoizing expensive function calls
 */
export class MemoryCache {
  private cache = new Map<string, any>();
  private maxSize: number;
  private name: string;
  
  /**
   * Create a new memory cache instance for memoizing function results
   * @param name Identifier for the cache (for logging)
   * @param maxSize Maximum number of items to keep in cache (default: 100)
   */
  constructor(name: string, maxSize: number = 100) {
    this.name = name;
    this.maxSize = maxSize;
  }
  
  /**
   * Memoize a function call
   * @param fn Function to memoize
   * @param keyFn Function to generate a cache key from arguments
   * @returns Memoized function
   */
  memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyFn: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args)
  ): T {
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = keyFn(...args);
      
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      const result = fn(...args);
      
      // Handle promises
      if (result instanceof Promise) {
        // Don't cache rejected promises
        result.catch(() => this.cache.delete(key));
      }
      
      this.cache.set(key, result);
      
      // Limit cache size (LRU-like behavior by deleting oldest entries)
      if (this.cache.size > this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
      
      return result;
    }) as T;
  }
  
  /**
   * Clear the memory cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get the number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Generate a simple hash of a string for use in cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
} 