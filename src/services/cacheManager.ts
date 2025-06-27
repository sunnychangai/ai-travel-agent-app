/**
 * Unified Cache Manager
 * 
 * Centralized cache management service that provides:
 * - User-scoped namespacing for all cache operations
 * - Unified invalidation strategies
 * - Cross-cache dependency tracking
 * - Cache analytics and debugging capabilities
 */

import { debouncedStorage } from '../utils/cacheUtils';

// Types for cache configuration
export interface CacheConfig {
  namespace: string;
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
  persistence?: boolean;
  userScoped?: boolean;
}

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl?: number;
  userId?: string;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface CacheInvalidationRule {
  trigger: string; // Event that triggers invalidation
  targets: string[]; // Cache namespaces to invalidate
  condition?: (data: any) => boolean;
}

export interface CacheAnalytics {
  hits: number;
  misses: number;
  invalidations: number;
  lastAccessed: number;
  memoryUsage: number;
}

// Cache event types
export enum CacheEvent {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_SWITCH = 'user_switch',
  DESTINATION_CHANGE = 'destination_change',
  ITINERARY_CHANGE = 'itinerary_change',
  CONVERSATION_RESET = 'conversation_reset',
  PREFERENCES_UPDATE = 'preferences_update'
}

export class UnifiedCacheManager {
  private static instance: UnifiedCacheManager;
  private caches: Map<string, Map<string, CacheEntry>> = new Map();
  private configs: Map<string, CacheConfig> = new Map();
  private invalidationRules: CacheInvalidationRule[] = [];
  private analytics: Map<string, CacheAnalytics> = new Map();
  private currentUserId: string | null = null;
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.setupDefaultInvalidationRules();
    this.setupStorageEventListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UnifiedCacheManager {
    if (!UnifiedCacheManager.instance) {
      UnifiedCacheManager.instance = new UnifiedCacheManager();
    }
    return UnifiedCacheManager.instance;
  }

  /**
   * Set current user ID for user-scoped caching
   */
  public setCurrentUser(userId: string | null): void {
    const previousUserId = this.currentUserId;
    this.currentUserId = userId;

    if (previousUserId !== userId) {
      if (previousUserId) {
        this.emitEvent(CacheEvent.USER_LOGOUT, { previousUserId });
      }
      if (userId) {
        this.emitEvent(CacheEvent.USER_LOGIN, { userId });
      } else {
        this.emitEvent(CacheEvent.USER_SWITCH, { previousUserId, userId });
      }
    }
  }

  /**
   * Register a cache namespace with configuration
   */
  public registerCache(config: CacheConfig): void {
    this.configs.set(config.namespace, config);
    
    if (!this.caches.has(config.namespace)) {
      this.caches.set(config.namespace, new Map());
    }

    if (!this.analytics.has(config.namespace)) {
      this.analytics.set(config.namespace, {
        hits: 0,
        misses: 0,
        invalidations: 0,
        lastAccessed: Date.now(),
        memoryUsage: 0
      });
    }

    console.log(`📋 CacheManager: Registered cache namespace "${config.namespace}"`);
  }

  /**
   * Generate cache key with user scoping
   */
  private generateKey(namespace: string, key: string): string {
    const config = this.configs.get(namespace);
    
    if (config?.userScoped && this.currentUserId) {
      return `${namespace}:${this.currentUserId}:${key}`;
    }
    
    return `${namespace}:${key}`;
  }

  /**
   * Set a value in the cache
   */
  public set<T>(
    namespace: string, 
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      dependencies?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const config = this.configs.get(namespace);
    if (!config) {
      console.warn(`⚠️ CacheManager: Namespace "${namespace}" not registered`);
      return;
    }

    const cache = this.caches.get(namespace)!;
    const fullKey = this.generateKey(namespace, key);
    
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: options.ttl || config.ttl,
      userId: config.userScoped ? this.currentUserId || undefined : undefined,
      dependencies: options.dependencies,
      metadata: options.metadata
    };

    // Enforce max size
    if (config.maxSize && cache.size >= config.maxSize) {
      this.evictOldestEntries(namespace, Math.floor(config.maxSize * 0.2));
    }

    cache.set(fullKey, entry);

    // Persist to storage if enabled
    if (config.persistence) {
      debouncedStorage.setItem(`cache:${fullKey}`, entry);
    }

    // Update analytics
    this.updateAnalytics(namespace, 'set');

    console.log(`💾 CacheManager: Set ${fullKey}`);
  }

  /**
   * Get a value from the cache
   */
  public get<T>(namespace: string, key: string): T | null {
    const config = this.configs.get(namespace);
    if (!config) {
      console.warn(`⚠️ CacheManager: Namespace "${namespace}" not registered`);
      return null;
    }

    const cache = this.caches.get(namespace)!;
    const fullKey = this.generateKey(namespace, key);
    let entry = cache.get(fullKey);

    // **FIX: If not found in memory, try loading from localStorage**
    if (!entry && config.persistence) {
      try {
        const stored = debouncedStorage.getItem(`cache:${fullKey}`, null);
        if (stored) {
          entry = stored as CacheEntry<T>;
          // Restore to memory cache
          cache.set(fullKey, entry);
          console.log(`📦 CacheManager: Loaded ${fullKey} from localStorage`);
        }
      } catch (error) {
        console.error(`❌ CacheManager: Error loading ${fullKey} from localStorage:`, error);
      }
    }

    if (!entry) {
      this.updateAnalytics(namespace, 'miss');
      return null;
    }

    // Check if entry is expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(fullKey);
      if (config.persistence) {
        debouncedStorage.removeItem(`cache:${fullKey}`);
      }
      this.updateAnalytics(namespace, 'miss');
      return null;
    }

    // Check user scope
    if (config.userScoped && entry.userId !== this.currentUserId) {
      this.updateAnalytics(namespace, 'miss');
      return null;
    }

    this.updateAnalytics(namespace, 'hit');
    return entry.value;
  }

  /**
   * Check if a key exists in cache
   */
  public has(namespace: string, key: string): boolean {
    return this.get(namespace, key) !== null;
  }

  /**
   * Delete a specific key from cache
   */
  public delete(namespace: string, key: string): boolean {
    const config = this.configs.get(namespace);
    if (!config) return false;

    const cache = this.caches.get(namespace)!;
    const fullKey = this.generateKey(namespace, key);
    const existed = cache.has(fullKey);

    cache.delete(fullKey);

    if (config.persistence) {
      debouncedStorage.removeItem(`cache:${fullKey}`);
    }

    if (existed) {
      console.log(`🗑️ CacheManager: Deleted ${fullKey}`);
    }

    return existed;
  }

  /**
   * Clear entire namespace
   */
  public clearNamespace(namespace: string): void {
    const cache = this.caches.get(namespace);
    if (!cache) return;

    const config = this.configs.get(namespace);
    const keysToDelete: string[] = [];

    // Collect keys to delete
    for (const fullKey of cache.keys()) {
      keysToDelete.push(fullKey);
    }

    // Delete from memory
    cache.clear();

    // Delete from persistent storage
    if (config?.persistence) {
      keysToDelete.forEach(fullKey => {
        debouncedStorage.removeItem(`cache:${fullKey}`);
      });
    }

    this.updateAnalytics(namespace, 'invalidation');
    console.log(`🧹 CacheManager: Cleared namespace "${namespace}" (${keysToDelete.length} entries)`);
  }

  /**
   * Clear all user-scoped caches for current user
   */
  public clearUserCaches(): void {
    if (!this.currentUserId) return;

    console.log(`🧹 CacheManager: Clearing all user caches for user: ${this.currentUserId}`);

    for (const [namespace, config] of this.configs.entries()) {
      if (config.userScoped) {
        const cache = this.caches.get(namespace)!;
        const keysToDelete: string[] = [];

        for (const [fullKey, entry] of cache.entries()) {
          if (entry.userId === this.currentUserId) {
            keysToDelete.push(fullKey);
          }
        }

        // Delete matching entries
        keysToDelete.forEach(fullKey => {
          cache.delete(fullKey);
          if (config.persistence) {
            debouncedStorage.removeItem(`cache:${fullKey}`);
          }
        });

        if (keysToDelete.length > 0) {
          console.log(`🧹 CacheManager: Cleared ${keysToDelete.length} entries from "${namespace}"`);
        }
      }
    }
  }

  /**
   * Clear all caches (nuclear option)
   */
  public clearAllCaches(): void {
    console.log('🧹 CacheManager: Clearing ALL caches');

    for (const namespace of this.caches.keys()) {
      this.clearNamespace(namespace);
    }

    // Also clear any orphaned localStorage entries
    this.clearOrphanedStorageEntries();
  }

  /**
   * Add invalidation rule
   */
  public addInvalidationRule(rule: CacheInvalidationRule): void {
    this.invalidationRules.push(rule);
    console.log(`📐 CacheManager: Added invalidation rule for "${rule.trigger}"`);
  }

  /**
   * Emit cache event and trigger invalidations
   */
  public emitEvent(event: CacheEvent, data?: any): void {
    console.log(`📡 CacheManager: Emitting event "${event}"`, data);

    // Trigger invalidation rules
    for (const rule of this.invalidationRules) {
      if (rule.trigger === event) {
        if (!rule.condition || rule.condition(data)) {
          for (const target of rule.targets) {
            this.clearNamespace(target);
          }
        }
      }
    }

    // Notify listeners
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`❌ CacheManager: Error in event listener for "${event}":`, error);
      }
    });
  }

  /**
   * Add event listener
   */
  public addEventListener(event: CacheEvent, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: CacheEvent, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get cache analytics
   */
  public getAnalytics(namespace?: string): Record<string, CacheAnalytics> | CacheAnalytics | null {
    if (namespace) {
      return this.analytics.get(namespace) || null;
    }

    const result: Record<string, CacheAnalytics> = {};
    for (const [ns, analytics] of this.analytics.entries()) {
      result[ns] = { ...analytics };
    }
    return result;
  }

  /**
   * Get cache summary for debugging
   */
  public getDebugInfo(): {
    namespaces: string[];
    totalEntries: number;
    currentUser: string | null;
    analytics: Record<string, CacheAnalytics>;
  } {
    let totalEntries = 0;
    for (const cache of this.caches.values()) {
      totalEntries += cache.size;
    }

    return {
      namespaces: Array.from(this.configs.keys()),
      totalEntries,
      currentUser: this.currentUserId,
      analytics: this.getAnalytics() as Record<string, CacheAnalytics>
    };
  }

  /**
   * Setup default invalidation rules
   */
  private setupDefaultInvalidationRules(): void {
    // Clear user caches on logout
    this.addInvalidationRule({
      trigger: CacheEvent.USER_LOGOUT,
      targets: [], // Will be handled by clearUserCaches
      condition: () => {
        this.clearUserCaches();
        return false; // Don't trigger namespace clearing
      }
    });

    // Clear conversation cache on destination change
    this.addInvalidationRule({
      trigger: CacheEvent.DESTINATION_CHANGE,
      targets: ['conversation', 'recommendations']
    });

    // Clear itinerary cache on conversation reset
    this.addInvalidationRule({
      trigger: CacheEvent.CONVERSATION_RESET,
      targets: ['conversation', 'messages']
    });
  }

  /**
   * Setup storage event listeners for cross-tab synchronization
   */
  private setupStorageEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key?.startsWith('cache:')) {
          // Handle cross-tab cache synchronization
          console.log('🔄 CacheManager: Storage event detected, synchronizing cache');
        }
      });

      // Handle page unload
      window.addEventListener('beforeunload', () => {
        debouncedStorage.flush();
      });
    }
  }

  /**
   * Evict oldest entries from cache
   */
  private evictOldestEntries(namespace: string, count: number): void {
    const cache = this.caches.get(namespace)!;
    const entries = Array.from(cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    for (const [key] of entries) {
      cache.delete(key);
    }

    console.log(`🗑️ CacheManager: Evicted ${count} oldest entries from "${namespace}"`);
  }

  /**
   * Update analytics for a namespace
   */
  private updateAnalytics(namespace: string, operation: 'hit' | 'miss' | 'set' | 'invalidation'): void {
    const analytics = this.analytics.get(namespace);
    if (!analytics) return;

    switch (operation) {
      case 'hit':
        analytics.hits++;
        break;
      case 'miss':
        analytics.misses++;
        break;
      case 'invalidation':
        analytics.invalidations++;
        break;
    }

    analytics.lastAccessed = Date.now();

    // Update memory usage estimate
    const cache = this.caches.get(namespace);
    if (cache) {
      analytics.memoryUsage = cache.size;
    }
  }

  /**
   * Clear orphaned localStorage entries
   */
  private clearOrphanedStorageEntries(): void {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache:')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      if (keysToRemove.length > 0) {
        console.log(`🧹 CacheManager: Cleaned up ${keysToRemove.length} orphaned localStorage entries`);
      }
    } catch (error) {
      console.error('❌ CacheManager: Error cleaning orphaned entries:', error);
    }
  }
}

// Export the class with compatibility alias
export { UnifiedCacheManager as CacheManager };

// Export singleton instance
export const cacheManager = UnifiedCacheManager.getInstance();

// Export convenience functions for common operations
export const cacheUtils = {
  /**
   * Set current user and clear previous user's caches
   */
  setUser: (userId: string | null) => {
    cacheManager.setCurrentUser(userId);
  },

  /**
   * Register a new cache namespace
   */
  registerCache: (config: CacheConfig) => {
    cacheManager.registerCache(config);
  },

  /**
   * Quick cache operations
   */
  set: <T>(namespace: string, key: string, value: T, ttl?: number) => {
    cacheManager.set(namespace, key, value, { ttl });
  },

  get: <T>(namespace: string, key: string): T | null => {
    return cacheManager.get<T>(namespace, key);
  },

  delete: (namespace: string, key: string) => {
    return cacheManager.delete(namespace, key);
  },

  clear: (namespace: string) => {
    cacheManager.clearNamespace(namespace);
  },

  /**
   * Event helpers
   */
  emitEvent: (event: CacheEvent, data?: any) => {
    cacheManager.emitEvent(event, data);
  },

  emitDestinationChange: (destination: string) => {
    cacheManager.emitEvent(CacheEvent.DESTINATION_CHANGE, { destination });
  },

  emitItineraryChange: (itineraryId: string) => {
    cacheManager.emitEvent(CacheEvent.ITINERARY_CHANGE, { itineraryId });
  },

  emitConversationReset: () => {
    cacheManager.emitEvent(CacheEvent.CONVERSATION_RESET);
  },

  /**
   * Debug helpers
   */
  getDebugInfo: () => cacheManager.getDebugInfo(),
  
  getAnalytics: (namespace?: string) => cacheManager.getAnalytics(namespace)
}; 