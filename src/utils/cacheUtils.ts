/**
 * Caching utility for API responses
 * Provides a standardized way to cache API responses across different services
 */

// Cache entry interface
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Cache class with expiration and cleanup functionality
 */
export class ApiCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private expirationMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupIntervalMs: number;
  private name: string;

  /**
   * Create a new cache instance
   * @param name Identifier for the cache (for logging)
   * @param expirationMs Time in milliseconds before entries expire (default: 24 hours)
   * @param cleanupIntervalMs Interval for cleanup of expired entries (default: 30 minutes)
   */
  constructor(
    name: string,
    expirationMs: number = 24 * 60 * 60 * 1000, // 24 hours
    cleanupIntervalMs: number = 30 * 60 * 1000 // 30 minutes
  ) {
    this.name = name;
    this.expirationMs = expirationMs;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanupInterval();

    // Add cleanup for hot module reloading
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        this.stopCleanupInterval();
      });
    }
  }

  /**
   * Get an item from the cache
   * @param key Cache key
   * @returns Cached data or null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if the entry has expired
    if (Date.now() - entry.timestamp > this.expirationMs) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set an item in the cache
   * @param key Cache key
   * @param data Data to cache
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Delete an item from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache
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

  /**
   * Start the automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.expirationMs) {
          this.cache.delete(key);
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        console.log(`[${this.name} Cache] Cleaned up ${expiredCount} expired entries. Remaining: ${this.cache.size}`);
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop the cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
} 