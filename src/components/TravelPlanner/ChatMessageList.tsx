import React, { useEffect, useRef, memo } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { Virtuoso } from "react-virtuoso";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
};

interface ChatMessageListProps {
  messages?: Message[];
  className?: string;
  isLoading?: boolean;
}

const TypingIndicator = memo(() => (
  <div className="flex items-center space-x-1 px-2">
    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
  </div>
));

const ChatMessage = memo(({ message, isFirstMessage }: { message: Message; isFirstMessage?: boolean }) => (
  <div
    className={cn(
      "flex w-full items-start gap-3",
      message.sender === "user" ? "justify-end pr-2" : "pl-1",
      isFirstMessage ? "pt-4" : ""
    )}
  >
    {message.sender === "ai" && (
      <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
        <AvatarImage
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=travel-ai"
          alt="AI"
        />
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
    )}

    <div
      className={cn(
        "p-3 mt-1 break-words shadow-sm",
        message.sender === "user"
          ? "bg-blue-500 text-white rounded-tl-2xl rounded-tr-md rounded-bl-2xl rounded-br-2xl max-w-[65%]"
          : "bg-gray-200 text-gray-900 rounded-tl-md rounded-tr-2xl rounded-bl-2xl rounded-br-2xl max-w-[75%] border border-gray-200"
      )}
    >
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
      <p className={cn(
        "text-xs mt-1",
        message.sender === "user" ? "text-blue-100" : "text-gray-500"
      )}>
        {message.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>

    {message.sender === "user" && (
      <Avatar className="h-8 w-8 flex-shrink-0 mt-1 mr-1">
        <AvatarImage
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=user"
          alt="User"
        />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    )}
  </div>
));

const preloadAvatars = () => {
  const urls = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=travel-ai",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=user"
  ];
  
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
};

function ChatMessageList({
  messages = [
    {
      id: "1",
      content:
        "Hi there! I'm your AI travel agent. Where would you like to go on your next trip?",
      sender: "ai",
      timestamp: new Date(Date.now() - 60000 * 5),
    },
    {
      id: "2",
      content:
        "I'm planning a trip to Paris for a week in June. Can you help me create an itinerary?",
      sender: "user",
      timestamp: new Date(Date.now() - 60000 * 3),
    },
    {
      id: "3",
      content:
        "Absolutely! Paris in June is beautiful. Let's create a wonderful itinerary for you. How many days will you be staying, and are there any specific attractions you definitely want to visit?",
      sender: "ai",
      timestamp: new Date(Date.now() - 60000),
    },
  ],
  className,
  isLoading = false,
}: ChatMessageListProps) {
  useEffect(() => {
    preloadAvatars();
  }, []);

  return (
    <div className={cn("w-full bg-white", className)}>
      <div className="px-2 pr-1">
        {messages.map((message, index) => (
          <div key={message.id} className="py-1 w-full overflow-hidden">
            <ChatMessage 
              message={message} 
              isFirstMessage={index === 0} 
            />
          </div>
        ))}
        
        {isLoading && (
          <div className="py-0 pl-1">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                <AvatarImage
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=travel-ai"
                  alt="AI"
                />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="rounded-tl-md rounded-tr-2xl rounded-bl-2xl rounded-br-2xl p-2 bg-gray-200 min-w-[60px] min-h-[36px] flex items-center shadow-sm border border-gray-200">
                <TypingIndicator />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessageList);
