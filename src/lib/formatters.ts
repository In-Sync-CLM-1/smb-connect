/**
 * Utility functions for formatting data
 * Consolidates common formatting logic used across components
 */

/**
 * Format a date string to a readable format
 */
export function formatDate(dateString: string | null | undefined, format: 'short' | 'long' = 'short'): string {
  if (!dateString) return 'Present';
  
  const date = new Date(dateString);
  
  if (format === 'short') {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(dateString, 'short');
}

/**
 * Get user initials from first and last name
 */
export function getUserInitials(firstName?: string | null, lastName?: string | null): string {
  const initials = `${firstName?.trim()?.[0] || ''}${lastName?.trim()?.[0] || ''}`.toUpperCase();
  return initials || '?';
}

/**
 * Get full name from first and last name
 */
export function getFullName(firstName?: string | null, lastName?: string | null): string {
  const fullName = [firstName, lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');

  return fullName || 'Unknown Member';
}

/**
 * Get initials from an already-built display name
 */
export function getInitialsFromName(name?: string | null): string {
  const initials = (name || '')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return initials || '?';
}

/**
 * Format a number with commas (e.g., 1000000 -> 1,000,000)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString('en-US');
}

/**
 * Format currency (e.g., 1000000 -> ₹10,00,000)
 */
export function formatCurrency(amount: number | null | undefined, currency: 'INR' | 'USD' = 'INR'): string {
  if (amount === null || amount === undefined) return 'N/A';
  
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  });
  
  return formatter.format(amount);
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get employment status badge text and color
 */
export function getEmploymentStatusLabel(status: string | null): { label: string; emoji: string } {
  if (!status) return { label: 'Not specified', emoji: '' };
  
  const statusMap: Record<string, { label: string; emoji: string }> = {
    'open_to_opportunities': { label: 'Open to opportunities', emoji: '🟢' },
    'actively_looking': { label: 'Actively looking', emoji: '🔍' },
    'hiring': { label: 'Hiring', emoji: '📢' },
    'not_looking': { label: 'Not looking', emoji: '' },
    'open_to_consulting': { label: 'Open to consulting', emoji: '💼' },
    'available_for_freelance': { label: 'Available for freelance', emoji: '✨' },
  };
  
  return statusMap[status] || { label: status, emoji: '' };
}
