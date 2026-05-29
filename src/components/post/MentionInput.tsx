import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MentionResult {
  id: string;
  name: string;
  avatar: string | null;
  type: 'member' | 'association';
  subtitle?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

/** Convert internal markup to display text (just @Name) */
function toDisplayText(markup: string): string {
  return markup.replace(/@\[([^\]]+)\]\((member|association):[a-f0-9-]+\)/g, '@$1');
}

/** Convert display text back to markup using a mention map */
function toMarkupText(display: string, mentionMap: Map<string, string>): string {
  // Replace each @Name with its markup if we have it stored
  let result = display;
  for (const [displayMention, markup] of mentionMap) {
    // Replace all occurrences
    while (result.includes(displayMention)) {
      result = result.replace(displayMention, markup);
    }
  }
  return result;
}

export function MentionInput({ value, onChange, placeholder, rows = 3, className }: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<MentionResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  // Map from display text "@Name" to full markup "@[Name](type:id)"
  const mentionMapRef = useRef<Map<string, string>>(new Map());

  // The display value shown in the textarea (no markup, just @Name)
  const displayValue = toDisplayText(value);

  // Build mention map from current value
  useEffect(() => {
    const pattern = /@\[([^\]]+)\]\((member|association):[a-f0-9-]+\)/g;
    let match;
    const newMap = new Map<string, string>();
    while ((match = pattern.exec(value)) !== null) {
      newMap.set(`@${match[1]}`, match[0]);
    }
    mentionMapRef.current = newMap;
  }, [value]);

  const searchMentions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      const [profilesRes, associationsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar, headline')
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
          .limit(5),
        supabase
          .from('associations')
          .select('id, name, logo')
          .ilike('name', `%${query}%`)
          .eq('is_active', true)
          .limit(5),
      ]);

      const memberResults: MentionResult[] = (profilesRes.data || []).map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
        avatar: p.avatar,
        type: 'member' as const,
        subtitle: p.headline || undefined,
      }));

      const assocResults: MentionResult[] = (associationsRes.data || []).map(a => ({
        id: a.id,
        name: a.name,
        avatar: a.logo,
        type: 'association' as const,
        subtitle: 'Association',
      }));

      const allResults = [...memberResults, ...assocResults];
      setResults(allResults);
      setSelectedIndex(0);
      setShowDropdown(allResults.length > 0);
    } catch (error) {
      console.error('Mention search error:', error);
    }
  }, []);

  const updateDropdownPosition = () => {
    if (textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDisplayValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newDisplayValue.length;

    // Convert display text back to markup
    const newMarkup = toMarkupText(newDisplayValue, mentionMapRef.current);
    onChange(newMarkup);

    // Detect @ trigger
    const textBeforeCursor = newDisplayValue.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(^|\s)@(\w*)$/);

    if (atMatch) {
      const query = atMatch[2];
      setMentionStart(cursorPos - query.length - 1);
      setMentionQuery(query);
      updateDropdownPosition();

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => searchMentions(query), 150);
    } else {
      setShowDropdown(false);
      setResults([]);
    }
  };

  const insertMention = (result: MentionResult) => {
    const currentDisplay = displayValue;
    const before = currentDisplay.slice(0, mentionStart);
    const after = currentDisplay.slice(mentionStart + mentionQuery.length + 1);
    const displayMention = `@${result.name}`;
    const fullMarkup = `@[${result.name}](${result.type}:${result.id})`;

    // Store in map
    mentionMapRef.current.set(displayMention, fullMarkup);

    // Build new markup value
    const newDisplay = before + displayMention + ' ' + after;
    const newMarkup = toMarkupText(newDisplay, mentionMapRef.current);
    onChange(newMarkup);

    setShowDropdown(false);
    setResults([]);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + displayMention.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && showDropdown) {
      e.preventDefault();
      insertMention(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current && !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dropdown = showDropdown && results.length > 0
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
        >
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors',
                index === selectedIndex && 'bg-accent'
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(result);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={result.avatar || undefined} />
                <AvatarFallback className="text-xs">
                  {result.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{result.name}</p>
                {result.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize shrink-0">
                {result.type}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        className={className}
      />
      {dropdown}
    </>
  );
}

/**
 * Parse mention markup from post content and return mention data for insertion into post_mentions table.
 */
export function parseMentions(content: string): { userId?: string; associationId?: string }[] {
  const mentionPattern = /@\[([^\]]+)\]\((member|association):([a-f0-9-]+)\)/g;
  const mentions: { userId?: string; associationId?: string }[] = [];
  let match;

  while ((match = mentionPattern.exec(content)) !== null) {
    const type = match[2];
    const id = match[3];
    if (type === 'member') {
      mentions.push({ userId: id });
    } else if (type === 'association') {
      mentions.push({ associationId: id });
    }
  }

  return mentions;
}
