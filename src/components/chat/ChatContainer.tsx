import React, { useRef, useEffect } from 'react';
import ChatMessageList from '../TravelPlanner/ChatMessageList';
import { UIMessage } from '../../types/chat';
import TypingIndicator from './TypingIndicator';
import ErrorAlert from './ErrorAlert';
import { performanceConfig } from '../../config/performance';

type ChatContainerProps = {
  messages: UIMessage[];
  isTyping: boolean;
  error: string | null;
};

/**
 * Container for chat messages with auto-scrolling and error handling
 */
const ChatContainer = React.memo(({ 
  messages, 
  isTyping, 
  error 
}: ChatContainerProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: performanceConfig.ui.animationLevel === 'none' ? 'auto' : 'smooth'
        });
      });
    }
  }, [messages.length]); // Only depend on message count, not the entire messages array

  return (
    <div className="flex-grow flex flex-col min-h-[150px]">
      <ChatMessageList messages={messages} />
      
      {isTyping && <TypingIndicator />}
      
      <div ref={messagesEndRef} className="h-8" />
      
      <ErrorAlert message={error} />
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';

export default ChatContainer; 