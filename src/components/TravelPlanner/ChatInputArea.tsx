import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
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
  
  // **MOBILE KEYBOARD FIX**: Handle mobile keyboard visibility
  useEffect(() => {
    // Set CSS custom property for viewport height (mobile Safari fix)
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    const handleFocus = () => {
      // Scroll textarea into view when keyboard appears on mobile
      if (textareaRef.current && window.innerWidth <= 768) {
        setTimeout(() => {
          textareaRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 300); // Delay to let keyboard animate in
      }
    };

    const handleResize = () => {
      // Update viewport height custom property
      setVH();
      
      // Handle viewport changes when keyboard appears/disappears
      if (textareaRef.current && window.innerWidth <= 768) {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const windowHeight = window.innerHeight;
        
        // If viewport height is significantly smaller, keyboard is likely visible
        if (viewportHeight < windowHeight * 0.75) {
          textareaRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }
    };

    // Set initial viewport height
    setVH();

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('focus', handleFocus);
    }
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', setVH);
    
    // Visual Viewport API support (iOS Safari 13+)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    
    return () => {
      if (textarea) {
        textarea.removeEventListener('focus', handleFocus);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', setVH);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);
  
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

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, []);

  // Memoize the keyboard event handler - now supports line breaks
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Regular Enter submits the message
      e.preventDefault();
      handleSendMessage();
    }
    // Shift+Enter creates line breaks (default behavior when we don't prevent)
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

  // Memoize onChange handler for the textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateMessage(e.target.value);
    adjustTextareaHeight();
  }, [updateMessage, adjustTextareaHeight]);

  // Effect to adjust height when message changes externally (controlled mode)
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  return (
    <div className="flex flex-col w-full">
      {/* Suggestion chips - now using horizontal scrolling component */}
      {suggestions && suggestions.length > 0 && (
        <ChatHorizontalSuggestions
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          disabled={isDisabled}
          className="mb-1"
        />
      )}
      
      {/* Input area - now using textarea for multi-line support */}
      <div className="relative w-full pb-4 chat-input-container">
        <div className="flex items-end gap-3 w-full">
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Ask about your next destination..."}
              className={cn(
                "w-full min-h-[48px] max-h-[120px] px-6 py-3 rounded-3xl bg-gray-100 border-0 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none chat-textarea",
                // Mobile-specific styling
                "text-base md:text-sm", // 16px on mobile to prevent zoom, 14px on desktop
                isDisabled ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-700",
                isLoading ? "border-blue-300" : "",
                error ? "focus:ring-red-500" : "",
                // Ensure proper alignment and spacing
                "leading-relaxed overflow-y-auto"
              )}
              disabled={isDisabled}
              ref={textareaRef}
              rows={1}
            />
            {/* Hint text for users */}
            {message.trim() && (
              <>
                <div className="absolute -bottom-6 left-2 text-xs text-gray-400 hidden md:block">
                  Enter to send • Shift+Enter for new line
                </div>
                <div className="absolute -bottom-6 left-2 text-xs text-gray-400 block md:hidden">
                  Enter to send • Shift+Enter for line break
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={isDisabled || !message.trim()}
            className={cn(
              "h-12 w-12 flex items-center justify-center rounded-full flex-shrink-0 mb-0",
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
