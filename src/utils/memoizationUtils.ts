/**
 * Utility functions for memoization of expensive operations
 */
import { MemoryCache } from './cacheUtils';

// Create memory caches for different purposes
export const sortingCache = new MemoryCache('SortingCache', 200);
export const filteringCache = new MemoryCache('FilteringCache', 200);
export const calculationCache = new MemoryCache('CalculationCache', 150);

/**
 * Memoized version of array sorting
 * @param array Array to sort
 * @param compareFn Compare function
 * @returns Sorted array (memoized)
 */
export const memoizedSort = sortingCache.memoize(<T>(
  array: T[],
  compareFn?: (a: T, b: T) => number
): T[] => {
  // Create a copy to avoid mutating the original
  return [...array].sort(compareFn);
});

/**
 * Memoized version of array filtering
 * @param array Array to filter
 * @param predicate Filter function
 * @returns Filtered array (memoized)
 */
export const memoizedFilter = filteringCache.memoize(<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => boolean
): T[] => {
  return array.filter(predicate);
});

/**
 * Memoized version of array mapping
 * @param array Array to map
 * @param mapFn Map function
 * @returns Mapped array (memoized)
 */
export const memoizedMap = calculationCache.memoize(<T, U>(
  array: T[],
  mapFn: (value: T, index: number, array: T[]) => U
): U[] => {
  return array.map(mapFn);
});

/**
 * Memoized version of complex calculations on arrays
 * @param array Array to process
 * @param processFn Processing function
 * @returns Calculation result (memoized)
 */
export const memoizedCalculation = calculationCache.memoize(<T, R>(
  array: T[],
  processFn: (array: T[]) => R
): R => {
  return processFn(array);
});

/**
 * Clear all function memoization caches
 */
export function clearAllMemoizationCaches(): void {
  sortingCache.clear();
  filteringCache.clear();
  calculationCache.clear();
}

/**
 * Generate a stable unique ID for an object
 * @param obj Object to generate ID for
 * @returns Stable ID string
 */
export function generateStableId(obj: any): string {
  // For primitive types, use the value directly
  if (obj === null || 
      obj === undefined || 
      typeof obj === 'boolean' || 
      typeof obj === 'number' || 
      typeof obj === 'string') {
    return String(obj);
  }
  
  // For arrays, recursively process each element
  if (Array.isArray(obj)) {
    return `[${obj.map(generateStableId).join(',')}]`;
  }
  
  // For objects, sort keys to ensure stable output
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return `{${keys.map(key => `${key}:${generateStableId(obj[key])}`).join(',')}}`;
  }
  
  // Fallback
  return JSON.stringify(obj);
} 