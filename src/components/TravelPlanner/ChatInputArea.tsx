import React, { useState } from "react";
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
}

const ChatInputArea = ({
  onSendMessage = () => {},
  suggestions = [
    { id: "1", text: "Recommend restaurants in Paris" },
    { id: "2", text: "Find museums in Rome" },
    { id: "3", text: "Plan a day in Barcelona" },
  ],
  onSuggestionClick = () => {},
  isLoading = false,
}: ChatInputAreaProps) => {
  const [message, setMessage] = useState("");
  
  // Array of color classes for suggestion bubbles with updated styling
  const bubbleColors = [
    "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200",
    "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200",
    "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200",
    "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200",
    "bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200",
    "bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200",
  ];

  const handleSendMessage = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isDisabled = !message.trim() || isLoading;

  return (
    <div className="w-full relative">
      {/* Floating suggestion bubbles with improved styling */}
      {suggestions.length > 0 && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 overflow-x-auto no-scrollbar px-4">
          <div className="flex gap-2 flex-nowrap pb-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                onClick={() => onSuggestionClick(suggestion)}
                className={`flex-none px-3 py-2 text-sm rounded-full transition-all duration-200 whitespace-nowrap shadow-sm ${bubbleColors[index % bubbleColors.length]} hover:shadow hover:scale-105 active:scale-95`}
              >
                "{suggestion.text}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area with improved styling */}
      <div className="w-full border-t bg-white px-5 py-4 flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
              >
                <Paperclip className="h-5 w-5 text-slate-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Attach files</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your trip..."
          className="flex-1 py-6 px-4 rounded-full border-slate-300 focus-visible:ring-blue-400 focus-visible:ring-offset-2 shadow-sm"
          disabled={isLoading}
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
              >
                <Mic className="h-5 w-5 text-slate-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Voice input</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          onClick={handleSendMessage}
          disabled={isDisabled}
          size="icon"
          rounded="full"
          className={cn(
            "w-12 h-12 flex items-center justify-center transition-all duration-200 shadow-md",
            isDisabled 
              ? "bg-blue-400/50 text-white cursor-not-allowed" 
              : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg active:scale-95"
          )}
          aria-label="Send message"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInputArea;
