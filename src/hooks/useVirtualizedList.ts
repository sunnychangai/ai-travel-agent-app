import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { memoryMonitor } from '../utils/memoryMonitor';

interface VirtualizedListOptions {
  itemHeight: number | ((index: number, item: any) => number);
  overscan?: number;
  initialIndex?: number;
  estimatedItemHeight?: number;
  // Option to use ResizeObserver for dynamic heights
  measureItemsInDom?: boolean;
  // Option to disable virtualization
  disabled?: boolean;
}

/**
 * A hook that handles virtualized rendering of long lists.
 * Only renders items that are visible in the viewport plus a configurable overscan.
 * Supports both fixed height and variable height items.
 * 
 * @param items The array of items to render
 * @param options Configuration options
 * @returns Object with virtualized items and scroll container props
 */
export function useVirtualizedList<T>(
  items: T[],
  options: VirtualizedListOptions
) {
  const { 
    itemHeight,
    overscan = 5, 
    initialIndex = 0,
    estimatedItemHeight = 0,
    measureItemsInDom = false,
    disabled = false
  } = options;
  
  const [scrollTop, setScrollTop] = useState(initialIndex * 
                                            (typeof itemHeight === 'function' ? 
                                             estimatedItemHeight || 100 : 
                                             itemHeight));
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // For dynamic height measurements
  const itemsRef = useRef<Map<number, number>>(new Map());
  const resizeObserver = useRef<ResizeObserver | null>(null);
  
  // OPTIMIZED: Simplified height calculation without excessive caching
  const getItemHeight = useCallback((index: number, item: T): number => {
    if (typeof itemHeight === 'function') {
      // Only cache if we have many items (> 500) to avoid unnecessary memory usage
      if (items.length > 500) {
        const cachedHeight = itemsRef.current.get(index);
        if (cachedHeight) {
          return cachedHeight;
        }
        const calculatedHeight = itemHeight(index, item);
        itemsRef.current.set(index, calculatedHeight);
        return calculatedHeight;
      } else {
        // For smaller lists, just calculate directly
        return itemHeight(index, item);
      }
    }
    
    return itemHeight;
  }, [itemHeight, items.length]); // Include items.length in deps

  // OPTIMIZED: Only calculate positions for variable height items
  const itemPositions = useMemo(() => {
    // Skip position calculations for fixed height items - it's unnecessary
    if (typeof itemHeight === 'number' || !items.length) {
      return [];
    }

    // Only calculate positions if we have a reasonable number of items
    // For very large lists, this becomes expensive
    if (items.length > 5000) {
      console.warn('⚠️ Large virtualized list detected. Consider pagination or simpler height calculation.');
    }

    const positions: { top: number; height: number; bottom: number }[] = [];
    let currentTop = 0;
    
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i, items[i]);
      positions.push({
        top: currentTop,
        height,
        bottom: currentTop + height
      });
      currentTop += height;
    }
    
    return positions;
  }, [items, getItemHeight, itemHeight]); // Simpler dependency array

  // Calculate which items should be rendered based on scroll position
  const {
    virtualItems,
    startIndex,
    endIndex,
    totalHeight
  } = useMemo(() => {
    if (!items.length) {
      return { virtualItems: [], startIndex: 0, endIndex: 0, totalHeight: 0 };
    }

    // For variable height items, use the calculated positions
    if (typeof itemHeight === 'function') {
      const totalHeight = itemPositions.length > 0 ? 
        itemPositions[itemPositions.length - 1].bottom : 0;
      
      // Binary search to find start index
      let startIndex = 0;
      let endIndex = itemPositions.length - 1;
      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + (scrollRef.current?.clientHeight || 0);
      
      // Find the first item that's at least partially visible
      while (startIndex <= endIndex) {
        const middle = Math.floor((startIndex + endIndex) / 2);
        const { top, bottom } = itemPositions[middle];
        
        if (bottom < viewportTop) {
          startIndex = middle + 1;
        } else if (top > viewportBottom) {
          endIndex = middle - 1;
        } else {
          startIndex = middle;
          break;
        }
      }
      
      // Binary search to find end index
      endIndex = itemPositions.length - 1;
      let start = startIndex;
      
      while (start <= endIndex) {
        const middle = Math.floor((start + endIndex) / 2);
        const { top } = itemPositions[middle];
        
        if (top > viewportBottom) {
          endIndex = middle - 1;
        } else {
          start = middle + 1;
        }
      }
      
      // Apply overscan
      startIndex = Math.max(0, startIndex - overscan);
      endIndex = Math.min(items.length - 1, endIndex + overscan);
      
      // Create virtualized items with their positions
      const virtualItems = items
        .slice(startIndex, endIndex + 1)
        .map((item, index) => {
          const virtualIndex = startIndex + index;
          const position = itemPositions[virtualIndex];
          
          return {
            index: virtualIndex,
            item,
            offsetTop: position.top,
            height: position.height,
          };
        });
      
      return { virtualItems, startIndex, endIndex, totalHeight };
    }
    
    // Fixed height implementation (faster)
    const fixedItemHeight = itemHeight as number;
    const totalHeight = items.length * fixedItemHeight;
    
    // Calculate the visible range
    const visibleStartIndex = Math.floor(scrollTop / fixedItemHeight);
    const visibleEndIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + (scrollRef.current?.clientHeight || 0)) / fixedItemHeight)
    );
    
    // Apply overscan
    const startIndex = Math.max(0, visibleStartIndex - overscan);
    const endIndex = Math.min(items.length - 1, visibleEndIndex + overscan);
    
    // Create virtualized items with their positions
    const virtualItems = items
      .slice(startIndex, endIndex + 1)
      .map((item, index) => {
        const virtualIndex = startIndex + index;
        return {
          index: virtualIndex,
          item,
          offsetTop: virtualIndex * fixedItemHeight,
          height: fixedItemHeight,
        };
      });

    return { virtualItems, startIndex, endIndex, totalHeight };
  }, [items, itemHeight, scrollTop, overscan, itemPositions]);

  // OPTIMIZED: Simplified scroll handling without complex memoization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    
    // Simple debouncing - only update if scrolled more than 5px or after timeout
    const diff = Math.abs(newScrollTop - scrollTop);
    if (diff > 5) {
      setScrollTop(newScrollTop);
    }
  }, [scrollTop]);

  // Scroll to a specific item
  const scrollToIndex = useCallback((index: number) => {
    if (index < 0 || index >= items.length) return;
    
    let scrollTop;
    if (typeof itemHeight === 'function' && itemPositions.length > index) {
      scrollTop = itemPositions[index].top;
    } else {
      scrollTop = index * (typeof itemHeight === 'number' ? itemHeight : estimatedItemHeight);
    }
    
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTop;
    }
    setScrollTop(scrollTop);
  }, [items.length, itemHeight, itemPositions, estimatedItemHeight]);

  // Setup scroll event listener and ResizeObserver for dynamic heights
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    // For handling non-React scroll events (mousewheel, native scrollbar)
    const handleNativeScroll = () => {
      setScrollTop(scrollEl.scrollTop);
    };

    scrollEl.addEventListener('scroll', handleNativeScroll, { passive: true });
    
    // Setup ResizeObserver if needed
    if (measureItemsInDom && typeof itemHeight === 'function' && 'ResizeObserver' in window) {
      resizeObserver.current = new ResizeObserver(entries => {
        // Update height measurements
        let needsUpdate = false;
        
        entries.forEach(entry => {
          const index = parseInt(entry.target.getAttribute('data-index') || '-1');
          if (index >= 0) {
            const oldHeight = itemsRef.current.get(index);
            const newHeight = entry.contentRect.height;
            
            if (oldHeight !== newHeight) {
              itemsRef.current.set(index, newHeight);
              needsUpdate = true;
            }
          }
        });
        
        if (needsUpdate) {
          // Force re-render to apply new measurements
          setScrollTop(prev => prev + 0.01);
        }
      });
    }
    
    return () => {
      scrollEl.removeEventListener('scroll', handleNativeScroll);
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
    };
  }, [measureItemsInDom, itemHeight]);

  // Method to register DOM ref for measurements
  const measureElement = useCallback((index: number, element: HTMLElement | null) => {
    if (element && resizeObserver.current && measureItemsInDom) {
      element.setAttribute('data-index', index.toString());
      resizeObserver.current.observe(element);
    }
  }, [measureItemsInDom]);

  // OPTIMIZED: Return simplified interface
  return {
    virtualItems: disabled ? [] : virtualItems,
    totalHeight: disabled ? 0 : totalHeight,
    startIndex: disabled ? 0 : startIndex,
    endIndex: disabled ? 0 : endIndex,
    scrollRef,
    handleScroll: disabled ? undefined : handleScroll,
    scrollToIndex: disabled ? undefined : scrollToIndex,
    measureElement: disabled ? undefined : measureElement,
    isVirtualized: !disabled
  };
}

export default useVirtualizedList; 