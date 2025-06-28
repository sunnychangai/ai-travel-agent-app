import React from 'react';
import { cn } from '../../lib/utils';

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
 * Touch-sensitive invisible scroll without arrow buttons
 */
export function ChatHorizontalSuggestions({
  suggestions,
  onSuggestionClick,
  disabled = false,
  className
}: ChatHorizontalSuggestionsProps) {
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
    <div className={cn("", className)}>
      {/* Touch-sensitive horizontally scrollable container */}
      <div 
        className="flex overflow-x-auto py-2 px-4 hide-scrollbar scroll-smooth" 
        style={{ 
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
        }}
      >
        <div className="flex gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => onSuggestionClick(suggestion)}
              className={cn(
                "rounded-full px-4 py-1 text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0",
                bubbleColors[index % bubbleColors.length],
                disabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={disabled}
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChatHorizontalSuggestions; 