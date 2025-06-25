import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ChatHorizontalSuggestionsProps {
  suggestions: Array<{
    id: string;
    text: string;
  }>;
  onSuggestionClick: (suggestion: { id: string; text: string }) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Horizontal scrollable container for chat suggestions
 * This is a space-efficient alternative to the multi-line suggestion display
 */
export function ChatHorizontalSuggestions({
  suggestions,
  onSuggestionClick,
  disabled = false,
  className
}: ChatHorizontalSuggestionsProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Handle scrolling the container left and right
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.75; // Scroll 75% of visible width
    
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Skip rendering if no suggestions
  if (suggestions.length === 0) return null;

  // Array of color classes for suggestion bubbles
  const bubbleColors = [
    "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200",
    "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200",
    "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200",
    "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200",
    "bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200",
    "bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200",
  ];

  return (
    <div className={cn("border-t border-b bg-gray-50", className)}>
      <div className="relative">
        {/* Left scroll button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full shadow-md p-1 z-10"
          aria-label="Scroll left"
        >
          <ChevronLeft size={16} />
        </button>
        
        {/* Horizontally scrollable container */}
        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto py-3 px-8 hide-scrollbar" 
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex gap-2 px-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                onClick={() => onSuggestionClick(suggestion)}
                className={cn(
                  "rounded-full px-4 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                  bubbleColors[index % bubbleColors.length]
                )}
                disabled={disabled}
              >
                {suggestion.text}
              </button>
            ))}
          </div>
        </div>
        
        {/* Right scroll button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full shadow-md p-1 z-10"
          aria-label="Scroll right"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default ChatHorizontalSuggestions; 