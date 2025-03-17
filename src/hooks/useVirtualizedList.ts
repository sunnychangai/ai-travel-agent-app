import { useState, useRef, useEffect, useMemo } from 'react';

interface VirtualizedListOptions {
  itemHeight: number;
  overscan?: number;
  initialIndex?: number;
}

/**
 * A hook that handles virtualized rendering of long lists.
 * Only renders items that are visible in the viewport plus a configurable overscan.
 * 
 * @param items The array of items to render
 * @param options Configuration options
 * @returns Object with virtualized items and scroll container props
 */
export function useVirtualizedList<T>(
  items: T[],
  options: VirtualizedListOptions
) {
  const { itemHeight, overscan = 3, initialIndex = 0 } = options;
  const [scrollTop, setScrollTop] = useState(initialIndex * itemHeight);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    const totalHeight = items.length * itemHeight;
    
    // Calculate the visible range
    const visibleStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleEndIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + (scrollRef.current?.clientHeight || 0)) / itemHeight)
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
          offsetTop: virtualIndex * itemHeight,
          height: itemHeight,
        };
      });

    return { virtualItems, startIndex, endIndex, totalHeight };
  }, [items, itemHeight, scrollTop, overscan]);

  // Handle scroll events
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrollTop(scrollTop);
  };

  // Scroll to a specific item
  const scrollToIndex = (index: number) => {
    const scrollTop = Math.max(0, index * itemHeight);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTop;
    }
    setScrollTop(scrollTop);
  };

  // Setup scroll event listener on the container
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    // For handling non-React scroll events (mousewheel, native scrollbar)
    const handleNativeScroll = () => {
      setScrollTop(scrollEl.scrollTop);
    };

    scrollEl.addEventListener('scroll', handleNativeScroll);
    return () => {
      scrollEl.removeEventListener('scroll', handleNativeScroll);
    };
  }, []);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    scrollRef,
    handleScroll,
    scrollToIndex,
  };
}

export default useVirtualizedList; 