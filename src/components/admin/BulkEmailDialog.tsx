import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserRole } from '@/hooks/useUserRole';
import { useImageUpload } from '@/hooks/useImageUpload';
import { quillModules, quillFormats } from '@/lib/quillConfig';
import { MERGE_TAGS } from '@/lib/emailMerge';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = lazy(() => import('react-quill'));

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listIds: string[];
}

export function BulkEmailDialog({
  open,
  onOpenChange,
  listIds,
}: BulkEmailDialogProps) {
  const { toast } = useToast();
  const { role, userData } = useUserRole();
  const quillRef = useRef<any>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { imageInputRef, uploadingImage, handleImageUpload } = useImageUpload(quillRef);
  const [loading, setLoading] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [listNames, setListNames] = useState<string[]>([]);
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState<'rtf' | 'html'>('rtf');

  const insertMergeTag = (token: string) => {
    if (editorMode === 'html') {
      const ta = htmlTextareaRef.current;
      if (!ta) {
        setBody((prev) => prev + token);
        return;
      }
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + token.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      const editor = quillRef.current?.getEditor?.();
      if (!editor) {
        setBody((prev) => prev + token);
        return;
      }
      const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      editor.insertText(range.index, token, 'user');
      editor.setSelection(range.index + token.length, 0);
    }
  };

  useEffect(() => {
    if (open && listIds.length > 0) {
      loadRecipientInfo();
    }
  }, [open, listIds]);

  const loadRecipientInfo = async () => {
    try {
      // Get list names
      const { data: lists } = await supabase
        .from('email_lists')
        .select('name')
        .in('id', listIds);
      
      if (lists) {
        setListNames(lists.map(l => l.name));
      }

      // Get total recipient count
      const { count } = await supabase
        .from('email_list_recipients')
        .select('*', { count: 'exact', head: true })
        .in('list_id', listIds);

      setRecipientCount(count || 0);
    } catch (error) {
      console.error('Error loading recipient info:', error);
    }
  };

  const handleSend = async () => {
    if (!senderEmail || !subject || !body) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (listIds.length === 0) return;

    setLoading(true);
    try {
      // Send to each list
      const promises = listIds.map(listId => 
        supabase.functions.invoke('send-bulk-email', {
          body: {
            listId,
            subject,
            bodyHtml: body,
            bodyText: body.replace(/<[^>]*>/g, ''),
            senderEmail,
            senderName: senderName || senderEmail,
          },
        })
      );

      const results = await Promise.all(promises);
      
      const totalSent = results.reduce((acc, r) => acc + (r.data?.sent || 0), 0);
      const totalFailed = results.reduce((acc, r) => acc + (r.data?.failed || 0), 0);

      toast({
        title: 'Bulk Email Sent',
        description: `Successfully sent to ${totalSent} recipients`,
      });

      if (totalFailed > 0) {
        toast({
          title: 'Warning',
          description: `${totalFailed} emails failed to send`,
          variant: 'destructive',
        });
      }

      onOpenChange(false);
      setSenderEmail('');
      setSenderName('');
      setSubject('');
      setBody('');
    } catch (error: any) {
      console.error('Error sending bulk email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send bulk email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This email will be sent to <strong>{recipientCount}</strong> recipient{recipientCount !== 1 ? 's' : ''} across <strong>{listIds.length}</strong> list{listIds.length !== 1 ? 's' : ''}.
            {listNames.length > 0 && (
              <div className="mt-1 text-xs">
                Lists: {listNames.join(', ')}
              </div>
            )}
          </AlertDescription>
        </Alert>

        {recipientCount > 10000 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Recipient limit exceeded! Maximum 10,000 recipients allowed per send. You have selected {recipientCount} recipients.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reply-To Email *</Label>
              <Input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="your-email@domain.com"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">Replies will be sent to this email</p>
            </div>

            <div className="space-y-2">
              <Label>Sender Name</Label>
              <Input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your Organization"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Message *</Label>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEditorMode('rtf')}
                    disabled={loading}
                    className={`px-3 py-1 text-xs ${editorMode === 'rtf' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  >
                    Rich Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('html')}
                    disabled={loading}
                    className={`px-3 py-1 text-xs border-l ${editorMode === 'html' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  >
                    HTML
                  </button>
                </div>
                <Select value="" onValueChange={insertMergeTag} disabled={loading}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="Insert merge tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {MERGE_TAGS.map((t) => (
                      <SelectItem key={t.token} value={t.token}>
                        {t.label} ({t.token})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editorMode === 'rtf' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage || loading}
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Insert Image
                      </>
                    )}
                  </Button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            {editorMode === 'rtf' ? (
              <div className="border rounded-md overflow-hidden">
                <Suspense fallback={<div className="h-[300px] flex items-center justify-center">Loading editor...</div>}>
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={body}
                    onChange={setBody}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Email content..."
                    style={{ height: '300px', marginBottom: '42px' }}
                  />
                </Suspense>
              </div>
            ) : (
              <Textarea
                ref={htmlTextareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="<p>Hello {{name}},</p>"
                rows={14}
                className="font-mono text-xs"
                disabled={loading}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Use <code>{'{{name}}'}</code> and <code>{'{{email}}'}</code> to personalise per recipient.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={loading || recipientCount === 0 || recipientCount > 10000}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {recipientCount} Recipient{recipientCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
