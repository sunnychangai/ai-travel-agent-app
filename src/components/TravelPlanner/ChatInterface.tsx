import React, { useState, useEffect } from "react";
import ChatMessageList from "./ChatMessageList";
import ChatInputArea from "./ChatInputArea";
import { cn } from "../../lib/utils";
import { useUserPreferences } from "../../contexts/UserPreferencesContext";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
};

interface ChatInterfaceProps {
  className?: string;
  initialMessages?: Message[];
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
}

export default function ChatInterface({
  className,
  initialMessages,
  onSendMessage = () => {},
  isLoading = false,
}: ChatInterfaceProps) {
  const { userPreferences } = useUserPreferences();
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState([
    { id: "1", text: "I'll be there for 7 days" },
    { id: "2", text: "I want to see the Eiffel Tower" },
    { id: "3", text: "I'm interested in art museums" },
  ]);

  // Set initial messages
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    } else {
      setMessages([
        {
          id: "1",
          content: "Hi there! I'm your AI travel agent. I can help you plan your trip. Where would you like to go?",
          sender: "ai",
          timestamp: new Date(),
        },
      ]);
    }
  }, [initialMessages]);

  const handleSendMessage = (message: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Call the parent handler
    onSendMessage(message);

    // Simulate AI response after a delay (in a real app, this would come from the backend)
    if (!isLoading) {
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content:
            "I'm processing your request about Paris. Let me update your itinerary based on your preferences.",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Update suggestions based on the conversation context
        setSuggestions([
          { id: "4", text: "Add Louvre Museum to my itinerary" },
          { id: "5", text: "Recommend restaurants near Notre Dame" },
          { id: "6", text: "What's the best time to visit Montmartre?" },
        ]);
      }, 1000);
    }
  };

  const handleSuggestionClick = (suggestion: { id: string; text: string }) => {
    handleSendMessage(suggestion.text);
  };

  return (
    <div className={cn("flex flex-col h-full w-full bg-white", className)}>
      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={messages} />
      </div>
      <ChatInputArea
        onSendMessage={handleSendMessage}
        suggestions={suggestions}
        onSuggestionClick={handleSuggestionClick}
        isLoading={isLoading}
      />
    </div>
  );
}
