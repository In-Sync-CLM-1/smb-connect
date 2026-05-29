import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Renders post content with clickable @mentions and linkified URLs.
 * Mention markup format: @[Display Name](member:uuid) or @[Display Name](association:uuid)
 */
export function MentionText({ text, className = '' }: { text: string; className?: string }) {
  const navigate = useNavigate();

  if (!text) return null;

  const mentionPattern = /@\[([^\]]+)\]\((member|association):([a-f0-9-]+)\)/g;

  // Find all mentions
  const mentions: { index: number; length: number; name: string; type: string; id: string }[] = [];
  let match;
  while ((match = mentionPattern.exec(text)) !== null) {
    mentions.push({
      index: match.index,
      length: match[0].length,
      name: match[1],
      type: match[2],
      id: match[3],
    });
  }

  if (mentions.length === 0) {
    return (
      <p className={`whitespace-pre-wrap break-words ${className}`}>
        {linkifySegment(text, 'full')}
      </p>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  mentions.forEach((mention, i) => {
    if (mention.index > lastIndex) {
      parts.push(...linkifySegment(text.slice(lastIndex, mention.index), `before-${i}`));
    }

    const path = mention.type === 'member'
      ? `/profile/${mention.id}`
      : `/member/associations/${mention.id}`;

    parts.push(
      <button
        key={`mention-${i}`}
        type="button"
        className="text-primary font-semibold hover:underline cursor-pointer inline"
        onClick={(e) => {
          e.stopPropagation();
          navigate(path);
        }}
      >
        @{mention.name}
      </button>
    );

    lastIndex = mention.index + mention.length;
  });

  if (lastIndex < text.length) {
    parts.push(...linkifySegment(text.slice(lastIndex), 'end'));
  }

  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {parts}
    </p>
  );
}

function linkifySegment(text: string, keyPrefix: string): React.ReactNode[] {
  const urlPattern = /(https?:\/\/[^\s<>[\]{}|\\^`"']+)/i;
  const segmentParts = text.split(new RegExp(urlPattern.source, 'gi'));

  return segmentParts.map((part, index) => {
    if (urlPattern.test(part)) {
      return (
        <a
          key={`${keyPrefix}-url-${index}`}
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
    return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
  });
}
