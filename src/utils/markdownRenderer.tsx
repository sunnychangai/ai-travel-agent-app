import React from 'react';

/**
 * Simple markdown renderer for chat messages
 * Handles basic formatting: **bold**, *italic*, links, line breaks, and emojis
 */
export const renderMarkdown = (text: string): React.ReactNode => {
  if (!text) return text;

  // Process text for basic markdown formatting
  const processText = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let partKey = 0;

    // Combined regex to find both bold text and links
    const markdownRegex = /(\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
    let match;

    while ((match = markdownRegex.exec(str)) !== null) {
      // Add text before the current match
      if (currentIndex < match.index) {
        const beforeText = str.slice(currentIndex, match.index);
        if (beforeText) {
          parts.push(<span key={`text-${partKey++}`}>{beforeText}</span>);
        }
      }

      // Check if it's a bold match (**text**)
      if (match[2]) {
        parts.push(<strong key={`bold-${partKey++}`}>{match[2]}</strong>);
      }
      // Check if it's a link match [text](url)
      else if (match[3] && match[4]) {
        parts.push(
          <a 
            key={`link-${partKey++}`} 
            href={match[4]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {match[3]}
          </a>
        );
      }

      currentIndex = match.index + match[0].length;
    }

    // Add remaining text after last match
    if (currentIndex < str.length) {
      const remainingText = str.slice(currentIndex);
      if (remainingText) {
        parts.push(<span key={`text-${partKey++}`}>{remainingText}</span>);
      }
    }

    // If no matches found, return original string
    if (parts.length === 0) {
      return [<span key="original">{str}</span>];
    }

    return parts;
  };

  // Split by lines and process each line
  const lines = text.split('\n');
  const processedLines = lines.map((line, index) => {
    if (!line.trim()) {
      return <br key={`br-${index}`} />;
    }
    
    const processedParts = processText(line);
    return <div key={`line-${index}`}>{processedParts}</div>;
  });

  return <>{processedLines}</>;
};

/**
 * Enhanced markdown renderer with bullet points and numbered lists
 */
export const renderEnhancedMarkdown = (text: string): React.ReactNode => {
  if (!text) return text;

  const lines = text.split('\n');
  const processedElements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      processedElements.push(<br key={`br-${lineIndex}`} />);
      return;
    }

    // Check for bullet points
    if (trimmedLine.match(/^[•\-\*]\s+/)) {
      const content = trimmedLine.replace(/^[•\-\*]\s+/, '');
      processedElements.push(
        <div key={`bullet-${lineIndex}`} className="flex items-start gap-2 my-1">
          <span className="text-blue-500 font-bold mt-0.5">•</span>
          <span>{renderMarkdown(content)}</span>
        </div>
      );
      return;
    }

    // Check for numbered lists
    if (trimmedLine.match(/^\d+\.\s+/)) {
      const match = trimmedLine.match(/^(\d+)\.\s+(.+)/);
      if (match) {
        const number = match[1];
        const content = match[2];
        processedElements.push(
          <div key={`number-${lineIndex}`} className="flex items-start gap-2 my-1">
            <span className="text-blue-600 font-semibold min-w-[20px]">{number}.</span>
            <span>{renderMarkdown(content)}</span>
          </div>
        );
        return;
      }
    }

    // Regular line with markdown
    processedElements.push(
      <div key={`line-${lineIndex}`}>
        {renderMarkdown(line)}
      </div>
    );
  });

  return <div>{processedElements}</div>;
}; 