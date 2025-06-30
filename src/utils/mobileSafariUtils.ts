/**
 * Utility functions for handling mobile Safari specific issues
 */

// Detect if we're running on mobile Safari
export const isMobileSafari = (): boolean => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
};

// Detect if we're running in standalone mode (PWA)
export const isStandalone = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
};

/**
 * Clear all application cache data
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear IndexedDB if available
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      } catch (e) {
        console.warn('Failed to clear IndexedDB:', e);
      }
    }
    
    // Clear service worker cache if available
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      } catch (e) {
        console.warn('Failed to clear service worker cache:', e);
      }
    }
    
    console.log('All cache data cleared successfully');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Recover from mobile Safari routing errors
 */
export const recoverFromRoutingError = (): void => {
  console.log('Attempting recovery from routing error');
  
  // Clear potentially corrupted routing data
  try {
    localStorage.removeItem('react-router-dom');
    sessionStorage.removeItem('react-router-dom');
    
    // Clear any conversation state that might be corrupted
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('conversation') || 
        key.includes('itinerary') || 
        key.includes('messages') ||
        key.includes('cache:')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`Cleared ${keysToRemove.length} potentially corrupted cache entries`);
  } catch (e) {
    console.warn('Failed to clear corrupted data:', e);
  }
  
  // Force reload to home
  window.location.replace('/');
};

/**
 * Validate current route and recover if invalid
 */
export const validateAndRecoverRoute = (): boolean => {
  const currentPath = window.location.pathname;
  const validRoutes = ['/', '/app', '/auth'];
  const validAppSubroutes = ['/app', '/app/', '/app?'];
  
  // Check if route is valid
  const isValidRoute = validRoutes.includes(currentPath) || 
                      validAppSubroutes.some(route => currentPath.startsWith(route)) ||
                      currentPath.startsWith('/app?');
  
  if (!isValidRoute) {
    console.log(`Invalid route detected: ${currentPath}, recovering`);
    recoverFromRoutingError();
    return false;
  }
  
  return true;
};

/**
 * Setup mobile Safari specific event listeners
 */
export const setupMobileSafariHandlers = (): void => {
  if (!isMobileSafari()) {
    return;
  }
  
  console.log('Setting up mobile Safari specific handlers');
  
  // Handle page show event (fires when page loads from cache)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      console.log('Page loaded from cache, validating state');
      validateAndRecoverRoute();
    }
  });
  
  // Handle page hide event
  window.addEventListener('pagehide', (event) => {
    console.log('Page hiding, event.persisted:', event.persisted);
  });
  
  // Handle memory pressure
  window.addEventListener('beforeunload', () => {
    // Force clear of any large cache items to prevent memory issues
    try {
      // Keep only essential data
      const essentialKeys = ['user-preferences', 'auth-token'];
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !essentialKeys.some(essential => key.includes(essential))) {
          keysToRemove.push(key);
        }
      }
      
      // Remove non-essential data on page unload
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to cleanup on beforeunload:', e);
    }
  });
};

/**
 * Monitor and fix app health
 */
export const monitorAppHealth = (): void => {
  // Check app health every 30 seconds when on mobile Safari
  if (!isMobileSafari()) {
    return;
  }
  
  setInterval(() => {
    // Check if root element is properly mounted
    const root = document.getElementById('root');
    if (!root || !root.firstChild) {
      console.warn('App health check failed: root element missing or empty');
      recoverFromRoutingError();
      return;
    }
    
    // Check if we're in a valid route
    if (!validateAndRecoverRoute()) {
      return;
    }
    
    // Check for memory pressure by monitoring localStorage size
    try {
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += key.length + value.length;
          }
        }
      }
      
      // If localStorage is getting too large (>5MB), clear non-essential items
      if (totalSize > 5 * 1024 * 1024) {
        console.warn('localStorage size is large, cleaning up');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cache:')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (e) {
      console.warn('Failed to check localStorage size:', e);
    }
  }, 30000); // Check every 30 seconds
}; 