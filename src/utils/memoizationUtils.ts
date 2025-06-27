/**
 * Simplified utility functions for memoization - OPTIMIZED VERSION
 * Reduced excessive caching patterns to improve memory usage
 */

import { memoryMonitor } from './memoryMonitor';

// Simple in-memory cache with size limits
class SimpleMemoCache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 50, ttl: number = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: string, value: T): void {
    // Clear expired entries and maintain size limit
    if (this.cache.size >= this.maxSize) {
      const now = Date.now();
      const toDelete: string[] = [];
      
      // Remove expired entries first
      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > this.ttl) {
          toDelete.push(key);
        }
      });
      
      toDelete.forEach(key => this.cache.delete(key));
      
      // If still over limit, remove oldest entries
      if (this.cache.size >= this.maxSize) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const removeCount = this.cache.size - this.maxSize + 1;
        for (let i = 0; i < removeCount; i++) {
          this.cache.delete(entries[i][0]);
        }
      }
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();    
  }
}

// Single small cache for critical operations only
const criticalCache = new SimpleMemoCache(25, 2 * 60 * 1000); // 25 items, 2 minutes TTL

/**
 * Lightweight memoization for expensive array operations ONLY
 * Use sparingly - most array operations don't need memoization
 */
export function memoizeExpensiveOperation<T extends any[], R>(
  fn: (...args: T) => R,
  generateKey?: (...args: T) => string
): (...args: T) => R {
  return (...args: T): R => {
    // Generate cache key
    const key = generateKey ? generateKey(...args) : JSON.stringify(args);
    
    // Check cache
    const cached = criticalCache.get(key);
    if (cached !== undefined) {
      return cached as R;
    }
    
    // Execute and cache
    const result = fn(...args);
    criticalCache.set(key, result);
    
    return result;
  };
}

/**
 * SIMPLIFIED: Only memoize truly expensive sorts (large arrays > 1000 items)
 */
export function memoizedSort<T>(array: T[], compareFn?: (a: T, b: T) => number): T[] {
  // Only memoize large arrays - small arrays are fast to sort
  if (array.length < 1000) {
    return [...array].sort(compareFn);
  }
  
  const key = `sort:${array.length}:${compareFn?.toString().substring(0, 50) || 'default'}`;
  const cached = criticalCache.get(key);
  if (cached) {
    return cached as T[];
  }
  
  const result = [...array].sort(compareFn);
  criticalCache.set(key, result);
  return result;
}

/**
 * Generate a simple stable ID - OPTIMIZED VERSION
 * Reduced complexity for better performance
 */
export function generateStableId(obj: any): string {
  // Handle primitives directly
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return String(obj);
  
  // For objects/arrays, use JSON.stringify with sorted keys for small objects
  // For large objects, just use object/array type + length
  if (Array.isArray(obj)) {
    return obj.length > 100 ? `array:${obj.length}` : JSON.stringify(obj);
  }
  
  const keys = Object.keys(obj);
  if (keys.length > 20) {
    // For large objects, just use a simple signature
    return `object:${keys.length}:${keys.slice(0, 5).join(',')}`;
  }
  
  // For small objects, use full JSON
  return JSON.stringify(obj, keys.sort());
}

/**
 * Clear memoization cache
 */
export function clearMemoizationCache(): void {
  criticalCache.clear();
  console.log('🗑️ Memoization cache cleared');
}

/**
 * Get memoization cache stats
 */
export function getMemoizationStats() {
  return {
    size: criticalCache['cache'].size,
    maxSize: criticalCache['maxSize'],
    usage: `${criticalCache['cache'].size}/${criticalCache['maxSize']}`
  };
}

/**
 * DEPRECATED: Use React.useMemo directly instead of these functions
 * These utilities are only for complex computations that truly benefit from caching
 */
export const memoizedFilter = <T>(array: T[], predicate: (value: T) => boolean): T[] => {
  console.warn('⚠️ memoizedFilter is deprecated. Use React.useMemo directly for better performance.');
  return array.filter(predicate);
};

export const memoizedMap = <T, U>(array: T[], mapFn: (value: T) => U): U[] => {
  console.warn('⚠️ memoizedMap is deprecated. Use React.useMemo directly for better performance.');
  return array.map(mapFn);
};

// Legacy compatibility - these are now no-ops that suggest better alternatives
export function clearAllMemoizationCaches(): void {
  clearMemoizationCache();
} 