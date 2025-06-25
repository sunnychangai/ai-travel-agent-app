import React from 'react';
import { Loader2 } from 'lucide-react';

type TypingIndicatorProps = {
  message?: string;
};

/**
 * Displays an animated typing indicator with optional custom message
 */
const TypingIndicator = React.memo(({ message = 'AI is thinking...' }: TypingIndicatorProps) => {
  return (
    <div className="flex items-center mt-1 text-gray-500 animate-pulse">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator; 