/**
 * Configuration file for controlling AI agent performance
 * 
 * These settings allow tuning the performance vs. quality tradeoff
 * for the AI-powered itinerary generation features.
 */

export const performanceConfig = {
  /**
   * Model selection - controls which AI model is used
   * - 'gpt-4-turbo-preview': High quality, slower, more expensive
   * - 'gpt-3.5-turbo': Lower quality, much faster, less expensive
   */
  model: 'gpt-3.5-turbo',
  
  /**
   * Cache settings
   */
  cache: {
    /**
     * Whether caching is enabled
     */
    enabled: true,
    
    /**
     * Cache lifetime in milliseconds
     * - Default: 24 hours
     */
    ttl: 24 * 60 * 60 * 1000,
    
    /**
     * Maximum number of items to keep in the cache
     */
    maxItems: 100,
    
    /**
     * Whether to use localStorage for persistent caching
     * This keeps cached data between page refreshes
     */
    usePersistence: true,
    
    /**
     * Whether to compress cached data to save space
     */
    useCompression: true
  },
  
  /**
   * Itinerary generation settings
   */
  itineraryGeneration: {
    /**
     * Mode controls how itineraries are generated
     * - 'comprehensive': Highest quality, slowest (multiple API calls)
     * - 'standard': Good quality, moderate speed (single API call)
     * - 'quick': Lower quality, fastest (simpler prompts)
     */
    mode: 'standard',
    
    /**
     * Whether to enhance itineraries with external data from:
     * - Google Maps
     * - TripAdvisor
     * 
     * Greatly improves quality but significantly slows generation
     */
    useExternalData: false,
    
    /**
     * Batch size for parallel API calls
     * Higher values are faster but may hit rate limits
     */
    batchSize: 5
  },
  
  /**
   * Rendering and UI performance
   */
  ui: {
    /**
     * Maximum number of messages to show in chat view
     * Lower values improve rendering performance
     */
    maxVisibleMessages: 50,
    
    /**
     * Whether to show typing indicators
     * Disable for slight performance improvement
     */
    showTypingIndicator: true,
    
    /**
     * Control level of animations
     * - 'full': All animations enabled
     * - 'reduced': Minimal animations
     * - 'none': No animations
     */
    animationLevel: 'reduced'
  }
};

/**
 * Utility function to update performance settings at runtime
 */
export function updatePerformanceSettings(newSettings: Partial<typeof performanceConfig>): typeof performanceConfig {
  // Deep merge the objects
  const updatedConfig = {
    ...performanceConfig,
    ...newSettings,
    cache: {
      ...performanceConfig.cache,
      ...(newSettings.cache || {})
    },
    itineraryGeneration: {
      ...performanceConfig.itineraryGeneration,
      ...(newSettings.itineraryGeneration || {})
    },
    ui: {
      ...performanceConfig.ui,
      ...(newSettings.ui || {})
    }
  };
  
  // Apply the new settings
  Object.assign(performanceConfig, updatedConfig);
  
  return performanceConfig;
} 