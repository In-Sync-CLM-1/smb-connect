export interface MergeContext {
  name?: string | null;
  email?: string | null;
}

export const MERGE_TAGS: { token: string; label: string }[] = [
  { token: '{{name}}', label: 'Recipient name' },
  { token: '{{email}}', label: 'Recipient email' },
];

export function applyMergeTags(body: string, ctx: MergeContext): string {
  return body
    .replace(/\{\{name\}\}/g, ctx.name ?? '')
    .replace(/\{\{email\}\}/g, ctx.email ?? '');
}
