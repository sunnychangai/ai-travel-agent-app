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
import { ChatHorizontalSuggestions } from "../chat/ChatHorizontalSuggestions";

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

  // Memoize onChange handler for the input
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateMessage(e.target.value);
  }, [updateMessage]);

  return (
    <div className="flex flex-col w-full">
      {/* Suggestion chips - now using horizontal scrolling component */}
      {suggestions && suggestions.length > 0 && (
        <ChatHorizontalSuggestions
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          disabled={isDisabled}
          className="mb-2"
        />
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
