/**
 * Client-side CSV parsing utilities for email and WhatsApp list imports.
 * Replaces the parse-email-list and parse-whatsapp-list edge functions.
 * CSV is parsed locally, then the structured data is sent to an RPC for bulk insert.
 */

export interface EmailRecipient {
  email: string;
  name: string | null;
  metadata: Record<string, string> | null;
}

export interface WhatsAppRecipient {
  phone: string;
  name: string | null;
}

export interface ParseResult<T> {
  recipients: T[];
  errors: string[];
}

/**
 * Parse a CSV file into email recipients.
 * Looks for 'email' and 'name' columns (case-insensitive).
 * Additional columns are stored as metadata.
 */
export function parseEmailCSV(csvText: string): ParseResult<EmailRecipient> {
  const lines = csvText.split('\n').filter(line => line.trim());
  const recipients: EmailRecipient[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    errors.push('File is empty');
    return { recipients, errors };
  }

  // Parse header row
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const emailIndex = headers.findIndex(h => h === 'email' || h === 'e-mail' || h === 'email address');
  const nameIndex = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname');

  if (emailIndex === -1) {
    errors.push('CSV must have an "email" column');
    return { recipients, errors };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));

    const email = values[emailIndex]?.trim();
    if (!email) {
      errors.push(`Row ${i + 1}: Missing email`);
      continue;
    }

    if (!emailRegex.test(email)) {
      errors.push(`Row ${i + 1}: Invalid email format: ${email}`);
      continue;
    }

    const name = nameIndex >= 0 ? values[nameIndex]?.trim() || null : null;

    // Collect additional columns as metadata
    const metadata: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (idx !== emailIndex && idx !== nameIndex && values[idx]) {
        metadata[header] = values[idx];
      }
    });

    recipients.push({
      email,
      name,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  }

  return { recipients, errors };
}

/**
 * Parse a CSV file into WhatsApp recipients.
 * Expects columns: phone, name (in that order).
 * Phone must start with + and contain 10-15 digits.
 */
export function parseWhatsAppCSV(csvText: string): ParseResult<WhatsAppRecipient> {
  const lines = csvText.split('\n').filter(line => line.trim());
  const recipients: WhatsAppRecipient[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    errors.push('CSV file is empty');
    return { recipients, errors };
  }

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const [phone, name] = line.split(',').map(val => val.trim());

    if (!phone) continue;

    const cleanPhone = phone.replace(/\s/g, '');
    if (!cleanPhone.match(/^\+\d{10,15}$/)) {
      errors.push(`Row ${i + 1}: Invalid phone format: ${phone}`);
      continue;
    }

    recipients.push({
      phone: cleanPhone,
      name: name || null,
    });
  }

  return { recipients, errors };
}
