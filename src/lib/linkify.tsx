import React from 'react';

/**
 * Converts URLs in text to clickable links that open in a new tab.
 * Returns an array of React elements.
 */
export function linkifyText(text: string): React.ReactNode[] {
  if (!text) return [];

  // URL regex pattern that matches http(s) URLs
  const urlPattern = /(https?:\/\/[^\s<>[\]{}|\\^`"']+)/i;
  
  const parts = text.split(new RegExp(urlPattern.source, 'gi'));
  
  return parts.map((part, index) => {
    if (urlPattern.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * A component that renders text with clickable links
 */
export function LinkifiedText({ 
  text, 
  className = "" 
}: { 
  text: string; 
  className?: string;
}) {
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {linkifyText(text)}
    </p>
  );
}
