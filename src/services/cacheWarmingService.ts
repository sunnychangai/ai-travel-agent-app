/**
 * Cache Warming Service
 * Preloads critical user data and implements smart background refresh
 */

import React from 'react';
import { unifiedApiCache } from './unifiedApiCacheService';
import { unifiedDatabaseService } from './unifiedDatabaseService';
import { unifiedUserPreferencesService } from './unifiedUserPreferencesService';
import { memoryMonitor } from '../utils/memoryMonitor';

interface CacheWarmingConfig {
  enabled: boolean;
  userDataPriority: 'high' | 'medium' | 'low';
  preferencesDataPriority: 'high' | 'medium' | 'low';
  backgroundRefreshInterval: number; // milliseconds
  staleThreshold: number; // milliseconds
  maxConcurrentRequests: number;
}

interface WarmingRequest {
  id: string;
  namespace: string;
  url?: string;
  dataLoader: () => Promise<any>;
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[];
  lastWarmed?: number;
  staleThreshold?: number;
}

class CacheWarmingService {
  private config: CacheWarmingConfig = {
    enabled: true,
    userDataPriority: 'high',
    preferencesDataPriority: 'medium',
    backgroundRefreshInterval: 10 * 60 * 1000, // 10 minutes
    staleThreshold: 30 * 60 * 1000, // 30 minutes
    maxConcurrentRequests: 3
  };

  private warmingQueue: WarmingRequest[] = [];
  private activeWarming = new Set<string>();
  private backgroundInterval: NodeJS.Timeout | null = null;
  private isWarming = false;

  /**
   * Update cache warming configuration
   */
  updateConfig(updates: Partial<CacheWarmingConfig>) {
    this.config = { ...this.config, ...updates };
    console.log('🔥 Cache warming config updated:', this.config);
  }

  /**
   * Start cache warming for a user
   */
  async warmUserCache(userId: string, destination?: string) {
    if (!this.config.enabled || !userId) {
      console.log('🔥 Cache warming disabled or no user ID');
      return;
    }

    console.log(`🔥 Starting cache warming for user: ${userId}${destination ? `, destination: ${destination}` : ''}`);

    const warmingRequests: WarmingRequest[] = [
      // High priority: User preferences and profile data
      {
        id: `user-preferences-${userId}`,
        namespace: 'user-preferences',
        dataLoader: () => unifiedUserPreferencesService.loadPreferences(),
        priority: this.config.preferencesDataPriority,
        staleThreshold: 60 * 60 * 1000 // 1 hour
      },

      // High priority: Recent conversations and messages
      {
        id: `user-conversations-${userId}`,
        namespace: 'conversations',
        dataLoader: () => Promise.resolve({ userId, messages: [] }), // Simplified - conversations are handled by flow manager
        priority: 'high',
        dependencies: [`user-preferences-${userId}`]
      },

      // Medium priority: User's saved itineraries
      {
        id: `user-itineraries-${userId}`,
        namespace: 'itineraries',
        dataLoader: () => unifiedDatabaseService.getUserItineraries(userId),
        priority: 'medium',
        dependencies: [`user-preferences-${userId}`]
      }
    ];

    // Add destination-specific warming if destination provided
    if (destination) {
      warmingRequests.push(
        {
          id: `destination-restaurants-${destination}`,
          namespace: 'recommendations-api',
          dataLoader: () => this.preloadRestaurants(destination),
          priority: 'medium',
          staleThreshold: 2 * 60 * 60 * 1000 // 2 hours
        },
        {
          id: `destination-attractions-${destination}`,
          namespace: 'recommendations-api', 
          dataLoader: () => this.preloadAttractions(destination),
          priority: 'low',
          staleThreshold: 4 * 60 * 60 * 1000 // 4 hours
        }
      );
    }

    // Add to warming queue
    this.addToWarmingQueue(warmingRequests);

    // Process the queue
    await this.processWarmingQueue();
  }

  /**
   * Add requests to the warming queue
   */
  private addToWarmingQueue(requests: WarmingRequest[]) {
    // Remove duplicates and add new requests
    const existingIds = new Set(this.warmingQueue.map(r => r.id));
    const newRequests = requests.filter(r => !existingIds.has(r.id));
    
    this.warmingQueue.push(...newRequests);
    
    // Sort by priority
    this.warmingQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Process the warming queue with concurrency control
   */
  private async processWarmingQueue() {
    if (this.isWarming) return;
    
    this.isWarming = true;
    console.log(`🔥 Processing cache warming queue with ${this.warmingQueue.length} requests`);

    try {
      while (this.warmingQueue.length > 0 && this.activeWarming.size < this.config.maxConcurrentRequests) {
        const request = this.warmingQueue.shift();
        if (!request) break;

        // Check if request is already being processed
        if (this.activeWarming.has(request.id)) continue;

        // Check dependencies
        if (request.dependencies && !this.areDependenciesMet(request.dependencies)) {
          // Put back at end of queue
          this.warmingQueue.push(request);
          continue;
        }

        // Start warming request
        this.warmRequest(request);
      }
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Check if all dependencies are met
   */
  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(dep => !this.activeWarming.has(dep));
  }

  /**
   * Warm a single request
   */
  private async warmRequest(request: WarmingRequest) {
    this.activeWarming.add(request.id);

    try {
      console.log(`🔥 Warming cache for: ${request.id}`);
      
      // Check if already fresh
      if (request.lastWarmed && request.staleThreshold) {
        const age = Date.now() - request.lastWarmed;
        if (age < request.staleThreshold) {
          console.log(`🔥 Skipping ${request.id} - still fresh (age: ${Math.round(age / 1000)}s)`);
          return;
        }
      }

      // Execute the data loader
      const startTime = Date.now();
      const data = await request.dataLoader();
      const duration = Date.now() - startTime;

      console.log(`🔥 Cache warmed for ${request.id} in ${duration}ms`);
      
      // Update warming timestamp
      request.lastWarmed = Date.now();

      // Record memory usage after warming
      memoryMonitor.recordMemoryStats();

    } catch (error) {
      console.warn(`🔥 Cache warming failed for ${request.id}:`, error);
    } finally {
      this.activeWarming.delete(request.id);
      
      // Continue processing queue
      if (this.warmingQueue.length > 0) {
        setTimeout(() => this.processWarmingQueue(), 100);
      }
    }
  }

  /**
   * Preload restaurant data for a destination
   */
  private async preloadRestaurants(destination: string) {
    try {
      // Simple preload without complex API calls
      const cacheKey = `restaurants-preload-${destination}`;
      const existing = await unifiedApiCache.get('recommendations-api', cacheKey);
      if (!existing) {
        // Mark as preloaded
        await unifiedApiCache.set('recommendations-api', cacheKey, { preloaded: true, destination });
      }
      return { destination, type: 'restaurants', preloaded: true };
    } catch (error) {
      console.warn(`Failed to preload restaurants for ${destination}:`, error);
      return null;
    }
  }

  /**
   * Preload attraction data for a destination
   */
  private async preloadAttractions(destination: string) {
    try {
      const cacheKey = `attractions-preload-${destination}`;
      const existing = await unifiedApiCache.get('tripadvisor-api', cacheKey);
      if (!existing) {
        await unifiedApiCache.set('tripadvisor-api', cacheKey, { preloaded: true, destination });
      }
      return { destination, type: 'attractions', preloaded: true };
    } catch (error) {
      console.warn(`Failed to preload attractions for ${destination}:`, error);
      return null;
    }
  }

  /**
   * Start background cache refresh
   */
  startBackgroundRefresh() {
    if (!this.config.enabled || this.backgroundInterval) {
      return;
    }

    console.log('🔥 Starting background cache refresh');
    
    this.backgroundInterval = setInterval(() => {
      this.refreshStaleCache();
    }, this.config.backgroundRefreshInterval);
  }

  /**
   * Stop background cache refresh
   */
  stopBackgroundRefresh() {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
      console.log('🔥 Background cache refresh stopped');
    }
  }

  /**
   * Refresh stale cache entries in the background
   */
  private async refreshStaleCache() {
    if (this.isWarming) return; // Don't interfere with active warming

    console.log('🔥 Checking for stale cache entries to refresh');

    // Find stale requests in the queue
    const now = Date.now();
    const staleRequests = this.warmingQueue.filter(request => {
      if (!request.lastWarmed || !request.staleThreshold) return false;
      return (now - request.lastWarmed) > request.staleThreshold;
    });

    if (staleRequests.length > 0) {
      console.log(`🔥 Found ${staleRequests.length} stale cache entries to refresh`);
      
      // Process stale requests with low priority
      staleRequests.forEach(request => {
        request.priority = 'low'; // Background refresh gets low priority
      });
      
      await this.processWarmingQueue();
    }

    // Monitor memory usage
    memoryMonitor.recordMemoryStats();
  }

  /**
   * Clear warming queue and stop all warming activities
   */
  clearWarming() {
    this.warmingQueue.length = 0;
    this.activeWarming.clear();
    this.stopBackgroundRefresh();
    console.log('🔥 Cache warming cleared');
  }

  /**
   * Get warming statistics
   */
  getWarmingStats() {
    return {
      enabled: this.config.enabled,
      queueSize: this.warmingQueue.length,
      activeWarming: this.activeWarming.size,
      backgroundRefreshActive: !!this.backgroundInterval,
      config: this.config
    };
  }
}

// Create and export singleton
export const cacheWarmingService = new CacheWarmingService();

// React hook for cache warming
export function useCacheWarming(userId?: string, destination?: string) {
  const [isWarming, setIsWarming] = React.useState(false);

  React.useEffect(() => {
    if (userId) {
      setIsWarming(true);
      cacheWarmingService.warmUserCache(userId, destination)
        .finally(() => setIsWarming(false));
    }
  }, [userId, destination]);

  React.useEffect(() => {
    // Start background refresh on mount
    cacheWarmingService.startBackgroundRefresh();
    
    return () => {
      // Clean up on unmount
      cacheWarmingService.stopBackgroundRefresh();
    };
  }, []);

  return {
    isWarming,
    warmCache: (dest?: string) => cacheWarmingService.warmUserCache(userId || '', dest),
    getStats: () => cacheWarmingService.getWarmingStats(),
    clearWarming: () => cacheWarmingService.clearWarming()
  };
}

export default cacheWarmingService; 