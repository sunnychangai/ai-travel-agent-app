/**
 * Memory monitoring and optimization utility
 * Helps track memory usage and identify memory leaks
 */

import React from 'react';

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usage: number; // percentage
}

interface ComponentMemoryTracker {
  componentName: string;
  mountTime: number;
  renderCount: number;
  lastRenderTime: number;
  memoryAtMount: number;
  memoryAtLastRender: number;
}

class MemoryMonitor {
  private isEnabled = process.env.NODE_ENV === 'development';
  private componentTrackers = new Map<string, ComponentMemoryTracker>();
  private memoryHistory: Array<{ timestamp: number; stats: MemoryStats }> = [];
  private maxHistoryLength = 100;
  private warningThreshold = 0.8; // 80% memory usage
  private criticalThreshold = 0.9; // 90% memory usage

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats | null {
    if (!this.isEnabled || !(performance as any).memory) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usage: memory.usedJSHeapSize / memory.jsHeapSizeLimit
    };
  }

  /**
   * Record memory stats with timestamp
   */
  recordMemoryStats() {
    if (!this.isEnabled) return;

    const stats = this.getMemoryStats();
    if (stats) {
      this.memoryHistory.push({
        timestamp: Date.now(),
        stats
      });

      // Keep history manageable
      if (this.memoryHistory.length > this.maxHistoryLength) {
        this.memoryHistory.shift();
      }

      // Check for memory warnings
      this.checkMemoryWarnings(stats);
    }
  }

  /**
   * Check for memory warnings and log them
   */
  private checkMemoryWarnings(stats: MemoryStats) {
    if (stats.usage > this.criticalThreshold) {
      console.error('🚨 CRITICAL Memory Usage:', this.formatMemorySize(stats.usedJSHeapSize), `(${(stats.usage * 100).toFixed(1)}%)`);
      console.error('Consider reducing cache sizes or implementing garbage collection');
    } else if (stats.usage > this.warningThreshold) {
      console.warn('⚠️ High Memory Usage:', this.formatMemorySize(stats.usedJSHeapSize), `(${(stats.usage * 100).toFixed(1)}%)`);
    }
  }

  /**
   * Track a React component's memory usage
   */
  trackComponent(componentName: string, action: 'mount' | 'render' | 'unmount') {
    if (!this.isEnabled) return;

    const stats = this.getMemoryStats();
    if (!stats) return;

    const tracker = this.componentTrackers.get(componentName);

    switch (action) {
      case 'mount':
        this.componentTrackers.set(componentName, {
          componentName,
          mountTime: Date.now(),
          renderCount: 1,
          lastRenderTime: Date.now(),
          memoryAtMount: stats.usedJSHeapSize,
          memoryAtLastRender: stats.usedJSHeapSize
        });
        break;

      case 'render':
        if (tracker) {
          tracker.renderCount++;
          tracker.lastRenderTime = Date.now();
          tracker.memoryAtLastRender = stats.usedJSHeapSize;
        }
        break;

      case 'unmount':
        this.componentTrackers.delete(componentName);
        break;
    }
  }

  /**
   * Get memory usage trends
   */
  getMemoryTrends() {
    if (!this.isEnabled || this.memoryHistory.length < 2) {
      return null;
    }

    const recent = this.memoryHistory.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const trend = last.stats.usedJSHeapSize - first.stats.usedJSHeapSize;
    const timespan = last.timestamp - first.timestamp;
    const rate = trend / timespan; // bytes per ms

    return {
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      changeInBytes: trend,
      changeRate: rate,
      timespan,
      current: last.stats,
      previous: first.stats
    };
  }

  /**
   * Get component performance insights
   */
  getComponentInsights() {
    if (!this.isEnabled) return [];

    const insights: Array<{
      component: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }> = [];

    this.componentTrackers.forEach((tracker, componentName) => {
      const memoryGrowth = tracker.memoryAtLastRender - tracker.memoryAtMount;
      const timeAlive = Date.now() - tracker.mountTime;
      const renderRate = tracker.renderCount / (timeAlive / 1000); // renders per second

      // Check for excessive re-renders
      if (renderRate > 10) { // More than 10 renders per second
        insights.push({
          component: componentName,
          issue: `High render rate: ${renderRate.toFixed(1)} renders/sec`,
          severity: 'high',
          recommendation: 'Optimize useEffect dependencies, remove excessive memoization, or add debouncing'
        });
      }

      // Check for memory growth
      if (memoryGrowth > 5 * 1024 * 1024) { // More than 5MB growth
        insights.push({
          component: componentName,
          issue: `Memory growth: ${this.formatMemorySize(memoryGrowth)}`,
          severity: 'medium',
          recommendation: 'Check for memory leaks, large state objects, or excessive caching'
        });
      }

      // Check for long-lived components with high render counts
      if (timeAlive > 60000 && tracker.renderCount > 100) { // Alive > 1min and > 100 renders
        insights.push({
          component: componentName,
          issue: `${tracker.renderCount} renders in ${Math.round(timeAlive / 1000)}s`,
          severity: 'medium',
          recommendation: 'Consider memoization optimizations or state structure improvements'
        });
      }
    });

    return insights;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection() {
    if (this.isEnabled && (window as any).gc) {
      console.log('🗑️ Forcing garbage collection...');
      (window as any).gc();
      this.recordMemoryStats();
    } else {
      console.log('⚠️ Garbage collection not available. Run Chrome with --enable-gc-flag');
    }
  }

  /**
   * Get comprehensive memory report
   */
  getMemoryReport() {
    if (!this.isEnabled) {
      return { enabled: false };
    }

    const currentStats = this.getMemoryStats();
    const trends = this.getMemoryTrends();
    const insights = this.getComponentInsights();

    return {
      enabled: true,
      current: currentStats,
      trends,
      insights,
      components: Array.from(this.componentTrackers.values()),
      history: this.memoryHistory.slice(-20) // Last 20 entries
    };
  }

  /**
   * Format memory size in human-readable format
   */
  formatMemorySize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Start periodic memory monitoring
   */
  startMonitoring(intervalMs = 5000) {
    if (!this.isEnabled) return null;

    console.log('🔍 Starting memory monitoring...');
    
    const interval = setInterval(() => {
      this.recordMemoryStats();
    }, intervalMs);

    // Log initial report
    setTimeout(() => {
      const report = this.getMemoryReport();
      console.log('📊 Memory Monitor Report:', report);
    }, 1000);

    return () => {
      clearInterval(interval);
      console.log('🔍 Memory monitoring stopped');
    };
  }

  /**
   * Log current memory report to console
   */
  logReport() {
    if (!this.isEnabled) {
      console.log('Memory monitoring is disabled');
      return;
    }

    const report = this.getMemoryReport();
    console.group('📊 Memory Monitor Report');
    
    if (report.current) {
      console.log('Current:', this.formatMemorySize(report.current.usedJSHeapSize), `(${(report.current.usage * 100).toFixed(1)}%)`);
    }
    
    if (report.trends) {
      console.log('Trend:', report.trends.trend, this.formatMemorySize(report.trends.changeInBytes));
    }
    
    if (report.insights && report.insights.length > 0) {
      console.group('Performance Insights:');
      report.insights.slice(0, 3).forEach((insight: any) => {
        const emoji = insight.severity === 'high' ? '🚨' : insight.severity === 'medium' ? '⚠️' : 'ℹ️';
        console.log(`${emoji} ${insight.component}: ${insight.issue}`);
        console.log(`   💡 ${insight.recommendation}`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}

// Create singleton instance
export const memoryMonitor = new MemoryMonitor();

// React hooks for memory monitoring
export function useMemoryMonitor(componentName: string) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    memoryMonitor.trackComponent(componentName, 'mount');
    setMounted(true);
    
    return () => {
      memoryMonitor.trackComponent(componentName, 'unmount');
    };
  }, [componentName]);

  React.useEffect(() => {
    if (mounted) {
      memoryMonitor.trackComponent(componentName, 'render');
    }
  });

  return {
    logReport: () => memoryMonitor.logReport(),
    getReport: () => memoryMonitor.getMemoryReport(),
    forceGC: () => memoryMonitor.forceGarbageCollection()
  };
}

// Development-only memory debug component
export function MemoryDebugPanel() {
  const [report, setReport] = React.useState<any>(null);
  const [autoRefresh, setAutoRefresh] = React.useState(false);

  React.useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setReport(memoryMonitor.getMemoryReport());
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const refreshReport = () => {
    setReport(memoryMonitor.getMemoryReport());
  };

  if (process.env.NODE_ENV !== 'development' || !report?.enabled) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999
    }}>
      <div style={{ marginBottom: '10px' }}>
        <strong>Memory Monitor</strong>
        <button onClick={refreshReport} style={{ marginLeft: '10px', fontSize: '10px' }}>Refresh</button>
        <button 
          onClick={() => setAutoRefresh(!autoRefresh)} 
          style={{ marginLeft: '5px', fontSize: '10px', background: autoRefresh ? 'green' : 'gray' }}
        >
          Auto: {autoRefresh ? 'ON' : 'OFF'}
        </button>
      </div>
      
      {report.current && (
        <div>
          <strong>Current:</strong> {memoryMonitor.formatMemorySize(report.current.usedJSHeapSize)} 
          ({(report.current.usage * 100).toFixed(1)}%)
        </div>
      )}
      
      {report.trends && (
        <div>
          <strong>Trend:</strong> {report.trends.trend} 
          ({memoryMonitor.formatMemorySize(report.trends.changeInBytes)})
        </div>
      )}
      
      {report.insights && report.insights.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <strong>Issues:</strong>
          {report.insights.slice(0, 3).map((insight: any, i: number) => (
            <div key={i} style={{ fontSize: '10px', marginTop: '5px' }}>
              {insight.severity === 'high' ? '🚨' : '⚠️'} {insight.component}: {insight.issue}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memoryMonitor; 