/**
 * Cache Debug Panel
 * 
 * A development-only component to monitor and debug cache operations.
 * Shows cache state, analytics, and provides manual cache controls.
 */

import React, { useState, useEffect } from 'react';
import { useCacheManager, useCacheDebugger } from '../../hooks/useCacheManager';
import { CacheEvent } from '../../services/cacheManager';

interface CacheDebugPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const CacheDebugPanel: React.FC<CacheDebugPanelProps> = ({ isOpen, onToggle }) => {
  const cache = useCacheManager();
  const cacheDebugger = useCacheDebugger(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // Refresh debug info
  const refreshDebugInfo = () => {
    setDebugInfo(cache.getDebugInfo());
    setAnalytics(cache.getAnalytics());
  };

  // Auto-refresh debug info
  useEffect(() => {
    if (isOpen) {
      refreshDebugInfo();
      const interval = setInterval(refreshDebugInfo, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, cache]);

  // Register demo cache namespaces
  useEffect(() => {
    cache.registerCache({
      namespace: 'demo',
      ttl: 60000, // 1 minute
      maxSize: 10,
      persistence: true,
      userScoped: true
    });

    cache.registerCache({
      namespace: 'global-demo',
      ttl: 30000, // 30 seconds
      maxSize: 5,
      persistence: false,
      userScoped: false
    });
  }, [cache]);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={onToggle}
          className="bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-700 text-sm font-medium"
        >
          🔍 Cache Debug
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-96 h-96 bg-white border border-gray-300 shadow-xl z-50 overflow-auto">
      <div className="bg-blue-600 text-white p-2 flex justify-between items-center">
        <h3 className="text-sm font-bold">🔍 Cache Debug Panel</h3>
        <button onClick={onToggle} className="text-white hover:text-gray-200">
          ✕
        </button>
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* Cache State */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Cache State</h4>
          {debugInfo && (
            <div className="bg-gray-50 p-2 rounded text-xs">
              <div><strong>Current User:</strong> {debugInfo.currentUser || 'None'}</div>
              <div><strong>Total Entries:</strong> {debugInfo.totalEntries}</div>
              <div><strong>Namespaces:</strong> {debugInfo.namespaces.join(', ')}</div>
            </div>
          )}
        </div>

        {/* Analytics */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Analytics</h4>
          {analytics && Object.keys(analytics).length > 0 ? (
            <div className="bg-gray-50 p-2 rounded space-y-1">
              {Object.entries(analytics).map(([namespace, data]: [string, any]) => (
                <div key={namespace} className="border-b border-gray-200 pb-1">
                  <div className="font-medium">{namespace}:</div>
                  <div className="ml-2 text-gray-600">
                    Hits: {data.hits}, Misses: {data.misses}, Size: {data.memoryUsage}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-xs">No analytics data</div>
          )}
        </div>

        {/* Manual Cache Operations */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Manual Operations</h4>
          <div className="space-y-2">
            <button
              onClick={() => {
                cache.set('demo', 'test-key', `Test value ${Date.now()}`, 30000);
                refreshDebugInfo();
              }}
              className="w-full bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
            >
              Set Demo Value
            </button>
            
            <button
              onClick={() => {
                const value = cache.get('demo', 'test-key');
                alert(`Demo value: ${value || 'Not found'}`);
              }}
              className="w-full bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
            >
              Get Demo Value
            </button>

            <button
              onClick={() => {
                cache.emitDestinationChange('Debug Destination');
                refreshDebugInfo();
              }}
              className="w-full bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600"
            >
              Emit Destination Change
            </button>

            <button
              onClick={() => {
                cache.clear('demo');
                refreshDebugInfo();
              }}
              className="w-full bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
            >
              Clear Demo Cache
            </button>
          </div>
        </div>

        {/* Event Monitoring */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Event Monitoring</h4>
          <div className="text-gray-600 text-xs">
            Check browser console for cache event logs
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={refreshDebugInfo}
            className="bg-gray-500 text-white px-3 py-1 rounded text-xs hover:bg-gray-600"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple hook to add cache debug panel to any component
 */
export function useCacheDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);

  const DebugPanel = () => (
    <CacheDebugPanel isOpen={isOpen} onToggle={toggle} />
  );

  return {
    isOpen,
    toggle,
    DebugPanel
  };
} 