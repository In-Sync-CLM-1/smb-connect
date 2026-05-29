import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Code, Eye } from 'lucide-react';

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderType: 'association' | 'company';
  senderId: string;
  senderEmail: string;
  senderName: string;
  conversationId?: string;
  defaultRecipient?: {
    email: string;
    name: string;
    id: string;
    type: 'company' | 'member';
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  template_type: string;
}

export function EmailComposer({
  open,
  onOpenChange,
  senderType,
  senderId,
  senderEmail,
  senderName,
  conversationId,
  defaultRecipient,
}: EmailComposerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipient?.email || '');
  const [recipientName, setRecipientName] = useState(defaultRecipient?.name || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (open) {
      loadTemplates();
      if (defaultRecipient) {
        setRecipientEmail(defaultRecipient.email);
        setRecipientName(defaultRecipient.name);
      }
    }
  }, [open, defaultRecipient]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .or(
          senderType === 'association'
            ? `association_id.eq.${senderId},association_id.is.null`
            : `company_id.eq.${senderId},company_id.is.null`
        );

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setSubject(template.subject);
      setBody(template.body_html);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail || !subject || !body) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          conversationId,
          recipientEmail,
          recipientName: recipientName || recipientEmail,
          subject,
          bodyHtml: body,
          bodyText: body.replace(/<[^>]*>/g, ''),
          senderType,
          senderId,
          recipientType: defaultRecipient?.type || 'member',
          recipientId: defaultRecipient?.id || '',
          senderEmail,
          senderName,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Email sent successfully',
      });

      onOpenChange(false);
      setRecipientEmail('');
      setRecipientName('');
      setSubject('');
      setBody('');
      setSelectedTemplate('');
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Use Template (Optional)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.template_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label>To Email *</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              disabled={!!defaultRecipient}
            />
          </div>

          {/* Recipient Name */}
          <div className="space-y-2">
            <Label>To Name</Label>
            <Input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient Name"
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message *</Label>
            <Tabs defaultValue="edit" className="w-full">
              <TabsList>
                <TabsTrigger value="edit">
                  <Code className="w-4 h-4 mr-2" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email content (HTML supported)"
                  rows={12}
                  className="font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="rounded-md border bg-white">
                  {body.trim() ? (
                    <iframe
                      title="Email preview"
                      sandbox=""
                      srcDoc={body}
                      className="h-[300px] w-full rounded-md"
                    />
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                      Nothing to preview yet — type your message in the Edit tab.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
