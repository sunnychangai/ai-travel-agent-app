import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
};

interface ChatMessageListProps {
  messages?: Message[];
  className?: string;
}

export default function ChatMessageList({
  messages = [
    {
      id: "1",
      content:
        "Hi there! I'm your AI travel assistant. Where would you like to go on your next trip?",
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
}: ChatMessageListProps) {
  return (
    <ScrollArea className={cn("h-full w-full bg-white p-4", className)}>
      <div className="flex flex-col space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-3 max-w-[80%]",
              message.sender === "user" ? "ml-auto" : "",
            )}
          >
            {message.sender === "ai" && (
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=travel-ai"
                  alt="AI"
                />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
            )}

            <div
              className={cn(
                "rounded-lg p-3",
                message.sender === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {message.sender === "user" && (
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=user"
                  alt="User"
                />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
