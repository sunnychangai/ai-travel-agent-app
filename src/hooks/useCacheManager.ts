/**
 * React hook for integrating the Unified Cache Manager with authentication
 * and providing easy access to cache operations in React components
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cacheManager, cacheUtils, CacheEvent, CacheConfig } from '../services/cacheManager';

/**
 * Hook for using the unified cache manager in React components
 */
export function useCacheManager() {
  const { user } = useAuth();
  const previousUserRef = useRef<string | null>(null);

  // Handle user authentication changes
  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserRef.current;

    // Only update if user actually changed
    if (currentUserId !== previousUserId) {
      console.log(`🔐 useCacheManager: User changed from ${previousUserId} to ${currentUserId}`);
      
      // Set current user in cache manager
      cacheUtils.setUser(currentUserId);
      
      // Update ref for next comparison
      previousUserRef.current = currentUserId;
    }
  }, [user?.id]);

  // Register cache namespace
  const registerCache = useCallback((config: CacheConfig) => {
    cacheUtils.registerCache(config);
  }, []);

  // Cache operations
  const set = useCallback(<T>(namespace: string, key: string, value: T, ttl?: number) => {
    cacheUtils.set(namespace, key, value, ttl);
  }, []);

  const get = useCallback(<T>(namespace: string, key: string): T | null => {
    return cacheUtils.get<T>(namespace, key);
  }, []);

  const del = useCallback((namespace: string, key: string) => {
    return cacheUtils.delete(namespace, key);
  }, []);

  const clear = useCallback((namespace: string) => {
    cacheUtils.clear(namespace);
  }, []);

  // Event emitters
  const emitDestinationChange = useCallback((destination: string) => {
    cacheUtils.emitDestinationChange(destination);
  }, []);

  const emitItineraryChange = useCallback((itineraryId: string) => {
    cacheUtils.emitItineraryChange(itineraryId);
  }, []);

  const emitConversationReset = useCallback(() => {
    cacheUtils.emitConversationReset();
  }, []);

  // Event listeners
  const addEventListener = useCallback((event: CacheEvent, listener: Function) => {
    cacheManager.addEventListener(event, listener);
    
    // Return cleanup function
    return () => {
      cacheManager.removeEventListener(event, listener);
    };
  }, []);

  // Debug helpers
  const getDebugInfo = useCallback(() => {
    return cacheUtils.getDebugInfo();
  }, []);

  const getAnalytics = useCallback((namespace?: string) => {
    return cacheUtils.getAnalytics(namespace);
  }, []);

  return {
    // Cache operations
    registerCache,
    set,
    get,
    delete: del,
    clear,
    
    // Event emitters
    emitDestinationChange,
    emitItineraryChange,
    emitConversationReset,
    
    // Event listeners
    addEventListener,
    
    // Debug and analytics
    getDebugInfo,
    getAnalytics,
    
    // Current user info
    currentUser: user?.id || null
  };
}

/**
 * Hook for namespace-specific cache operations
 * Simplifies usage when working with a specific cache namespace
 */
export function useNamespacedCache(namespace: string, config?: Omit<CacheConfig, 'namespace'>) {
  const cache = useCacheManager();

  // Register namespace on mount if config provided
  useEffect(() => {
    if (config) {
      cache.registerCache({
        namespace,
        ...config
      });
    }
  }, [namespace, config, cache]);

  // Namespace-specific operations
  const set = useCallback(<T>(key: string, value: T, ttl?: number) => {
    cache.set(namespace, key, value, ttl);
  }, [cache, namespace]);

  const get = useCallback(<T>(key: string): T | null => {
    return cache.get<T>(namespace, key);
  }, [cache, namespace]);

  const del = useCallback((key: string) => {
    return cache.delete(namespace, key);
  }, [cache, namespace]);

  const clear = useCallback(() => {
    cache.clear(namespace);
  }, [cache, namespace]);

  const getAnalytics = useCallback(() => {
    return cache.getAnalytics(namespace);
  }, [cache, namespace]);

  return {
    set,
    get,
    delete: del,
    clear,
    getAnalytics,
    namespace
  };
}

/**
 * Hook for debugging cache issues
 * Provides console logging and analytics for cache operations
 */
export function useCacheDebugger(enabled: boolean = process.env.NODE_ENV === 'development') {
  const cache = useCacheManager();

  useEffect(() => {
    if (!enabled) return;

    console.log('🔍 Cache Debugger: Starting cache monitoring');

    // Log cache events
    const cleanup: (() => void)[] = [];

    // Monitor all cache events
    const events = [
      CacheEvent.USER_LOGIN,
      CacheEvent.USER_LOGOUT,
      CacheEvent.USER_SWITCH,
      CacheEvent.DESTINATION_CHANGE,
      CacheEvent.ITINERARY_CHANGE,
      CacheEvent.CONVERSATION_RESET,
      CacheEvent.PREFERENCES_UPDATE
    ];

    events.forEach(event => {
      const removeListener = cache.addEventListener(event, (data: any) => {
        console.log(`🔍 Cache Event: ${event}`, data);
        
        // Log debug info after events
        setTimeout(() => {
          console.log('🔍 Cache State:', cache.getDebugInfo());
        }, 100);
      });
      cleanup.push(removeListener);
    });

    // Log initial state
    console.log('🔍 Initial Cache State:', cache.getDebugInfo());

    // Periodic analytics logging
    const analyticsInterval = setInterval(() => {
      const analytics = cache.getAnalytics();
      if (analytics && typeof analytics === 'object' && Object.keys(analytics).length > 0) {
        console.log('📊 Cache Analytics:', analytics);
      }
    }, 30000); // Every 30 seconds

    return () => {
      console.log('🔍 Cache Debugger: Stopping cache monitoring');
      cleanup.forEach(fn => fn());
      clearInterval(analyticsInterval);
    };
  }, [enabled, cache]);

  // Manual debug functions
  const logCacheState = useCallback(() => {
    console.log('🔍 Manual Cache State Check:', cache.getDebugInfo());
  }, [cache]);

  const logAnalytics = useCallback((namespace?: string) => {
    const analytics = cache.getAnalytics(namespace);
    console.log('📊 Manual Analytics Check:', analytics);
  }, [cache]);

  return {
    logCacheState,
    logAnalytics,
    enabled
  };
} 