import React, { useState, useRef, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { SendIcon, Mic, Paperclip, ArrowUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

interface SuggestionChip {
  id: string;
  text: string;
}

interface ChatInputAreaProps {
  onSendMessage?: (message: string) => void;
  suggestions?: SuggestionChip[];
  onSuggestionClick?: (suggestion: SuggestionChip) => void;
  isLoading?: boolean;
  
  // New props
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (message: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
  error?: string;
}

const ChatInputArea = ({
  onSendMessage,
  suggestions = [],
  onSuggestionClick,
  isLoading = false,
  
  // New props with defaults
  value,
  onChange,
  onSend,
  isDisabled = false,
  placeholder,
  error
}: ChatInputAreaProps) => {
  // Use local state if value/onChange props aren't provided
  const [localMessage, setLocalMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Determine if we're using controlled or uncontrolled behavior
  const isControlled = value !== undefined && onChange !== undefined;
  const message = isControlled ? value : localMessage;
  
  // Update message state based on controlled or uncontrolled mode
  const updateMessage = useCallback((newValue: string) => {
    if (isControlled && onChange) {
      onChange(newValue);
    } else {
      setLocalMessage(newValue);
    }
  }, [isControlled, onChange]);
  
  // Handle sending the message - memoized with useCallback
  const handleSendMessage = useCallback(() => {
    if (message.trim() && !isDisabled && !isLoading) {
      // Use onSend prop if provided, otherwise fall back to onSendMessage
      if (onSend) {
        onSend(message);
      } else if (onSendMessage) {
        onSendMessage(message);
      }
      
      // Clear message after sending
      updateMessage("");
    }
  }, [message, isDisabled, isLoading, onSend, onSendMessage, updateMessage]);

  // Memoize the keyboard event handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Memoize suggestion click handler
  const handleSuggestionClick = useCallback((suggestion: SuggestionChip) => {
    // Update the input with the suggestion text
    updateMessage(suggestion.text);
    
    // Call the provided onSuggestionClick handler if available
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    }
  }, [updateMessage, onSuggestionClick]);

  // Array of color classes for suggestion bubbles
  const bubbleColors = [
    "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200",
    "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200",
    "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200",
    "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200",
    "bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200",
    "bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200",
  ];

  // Memoize onChange handler for the input
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateMessage(e.target.value);
  }, [updateMessage]);

  return (
    <div className="flex flex-col w-full">
      {/* Suggestion chips - now directly in the chat input area */}
      {suggestions && suggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 overflow-x-auto pb-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                bubbleColors[index % bubbleColors.length]
              )}
              disabled={isDisabled}
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      )}
      
      {/* Input area - redesigned to match landing page */}
      <div className="relative w-full pb-4">
        <div className="flex items-center gap-3 w-full">
          <input
            type="text"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Ask about your next destination..."}
            className={cn(
              "flex-1 h-12 px-6 rounded-full bg-gray-100 border-0 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
              isDisabled ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-700",
              isLoading ? "border-blue-300" : "",
              error ? "focus:ring-red-500" : ""
            )}
            disabled={isDisabled}
          />
          <button
            onClick={handleSendMessage}
            disabled={isDisabled || !message.trim()}
            className={cn(
              "h-12 w-12 flex items-center justify-center rounded-full flex-shrink-0",
              isDisabled || !message.trim()
                ? "bg-blue-300 text-white cursor-not-allowed opacity-50"
                : "bg-blue-500 text-white hover:bg-blue-600"
            )}
            aria-label="Send message"
          >
            <ArrowUp className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      {error && (
        <div className="text-red-500 text-sm mt-1">{error}</div>
      )}
    </div>
  );
};

export default React.memo(ChatInputArea);
