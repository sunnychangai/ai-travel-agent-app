import { useState, useCallback } from 'react';
import { Message } from '../types';
import { useItinerary } from '../contexts/ItineraryContext';
import { apiService } from '../services/api';

interface UseChatOptions {
  initialMessages?: Message[];
  onMessageProcessed?: (message: string, response: string) => void;
}

export function useChat({ 
  initialMessages = [], 
  onMessageProcessed 
}: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const { addActivity, setLoading } = useItinerary();

  // Process user message and generate AI response
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    setLoading(true);

    try {
      // In a real app, this would call an AI service
      // For now, we'll simulate a response based on the message content
      let aiResponse: string;
      
      // Process message content to extract potential actions
      if (content.toLowerCase().includes('add') && content.toLowerCase().includes('itinerary')) {
        // Extract location from message
        const locationMatch = content.match(/add\s+(.+?)\s+to\s+itinerary/i);
        const location = locationMatch ? locationMatch[1] : 'activity';
        
        // Create a new activity
        const newActivity = {
          title: `Visit ${location}`,
          description: `Visit ${location} based on your request.`,
          location: location,
          time: '10:00 AM - 12:00 PM',
          imageUrl: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600&q=80',
        };
        
        // Add to day 1 (or create day 1 if it doesn't exist)
        addActivity(1, newActivity);
        
        aiResponse = `I've added ${location} to your itinerary for day 1. Would you like to add any more activities?`;
      } else if (content.toLowerCase().includes('suggest') || content.toLowerCase().includes('recommendation')) {
        // Extract location from message
        const locationMatch = content.match(/(?:in|for|about)\s+(.+?)(?:\s|$)/i);
        const location = locationMatch ? locationMatch[1] : 'Paris';
        
        // Get suggestions from API service (will use mock data)
        const suggestions = await apiService.getSuggestions(location, [], 3);
        
        // Format suggestions as text
        const suggestionsText = suggestions
          .map(s => `- ${s.title}: ${s.description} (${s.duration})`)
          .join('\n');
        
        aiResponse = `Here are some suggestions for ${location}:\n\n${suggestionsText}\n\nWould you like me to add any of these to your itinerary?`;
      } else {
        // Generic response
        aiResponse = `I've received your message about "${content}". How else can I help with your travel plans?`;
      }

      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Call the callback if provided
      if (onMessageProcessed) {
        onMessageProcessed(content, aiResponse);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  }, [addActivity, setLoading, onMessageProcessed]);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isProcessing,
    sendMessage,
    clearMessages,
  };
} 