import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Image, FileText, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { validateMessageImageUpload, validateMessageDocumentUpload } from '@/lib/uploadValidation';

interface ReplyInfo {
  id: string;
  senderName: string;
  content: string;
}

export interface MessageAttachment {
  type: 'image' | 'document';
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

interface MessageInputProps {
  chatId: string;
  currentMemberId: string | null;
  onMessageSent?: () => void;
  replyingTo?: ReplyInfo;
}

export function MessageInput({ chatId, currentMemberId, onMessageSent, replyingTo }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<{ file: File; type: 'image' | 'document'; preview?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (attachments.length >= 5) {
        toast({
          title: 'Maximum attachments reached',
          description: 'You can only attach up to 5 files per message',
          variant: 'destructive',
        });
        break;
      }

      const validation = await validateMessageImageUpload(file);
      if (!validation.valid) {
        toast({
          title: 'Invalid image',
          description: validation.error,
          variant: 'destructive',
        });
        continue;
      }

      const preview = URL.createObjectURL(file);
      setAttachments(prev => [...prev, { file, type: 'image', preview }]);
    }

    e.target.value = '';
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (attachments.length >= 5) {
        toast({
          title: 'Maximum attachments reached',
          description: 'You can only attach up to 5 files per message',
          variant: 'destructive',
        });
        break;
      }

      const validation = validateMessageDocumentUpload(file);
      if (!validation.valid) {
        toast({
          title: 'Invalid document',
          description: validation.error,
          variant: 'destructive',
        });
        continue;
      }

      setAttachments(prev => [...prev, { file, type: 'document' }]);
    }

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const attachment = prev[index];
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadAttachments = async (): Promise<MessageAttachment[]> => {
    const uploadedAttachments: MessageAttachment[] = [];
    
    for (const attachment of attachments) {
      const fileExt = attachment.file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${currentMemberId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, attachment.file);

      if (uploadError) {
        throw new Error(`Failed to upload ${attachment.file.name}: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath);

      uploadedAttachments.push({
        type: attachment.type,
        url: urlData.publicUrl,
        name: attachment.file.name,
        size: attachment.file.size,
        mimeType: attachment.file.type,
      });
    }

    return uploadedAttachments;
  };

  const handleSend = async () => {
    if ((!message.trim() && attachments.length === 0) || !currentMemberId || sending) return;

    setSending(true);
    setUploading(attachments.length > 0);

    try {
      let uploadedAttachments: MessageAttachment[] = [];
      
      if (attachments.length > 0) {
        uploadedAttachments = await uploadAttachments();
      }

      // If replying, prepend the reply context
      let finalContent = message.trim();
      if (replyingTo) {
        finalContent = `↩️ Replying to ${replyingTo.senderName}: "${replyingTo.content.substring(0, 30)}${replyingTo.content.length > 30 ? '...' : ''}"\n\n${finalContent}`;
      }

      // Determine message type
      let messageType = 'text';
      if (uploadedAttachments.length > 0) {
        const hasImages = uploadedAttachments.some(a => a.type === 'image');
        const hasDocs = uploadedAttachments.some(a => a.type === 'document');
        if (hasImages && !hasDocs) messageType = 'image';
        else if (hasDocs && !hasImages) messageType = 'document';
        else messageType = 'mixed';
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: currentMemberId,
          content: finalContent || null,
          message_type: messageType,
          attachments: uploadedAttachments.length > 0 ? (uploadedAttachments as unknown as import('@/integrations/supabase/types').Json) : null
        });

      if (error) throw error;

      // Update chat's last_message_at
      await supabase
        .from('chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', chatId);

      setMessage('');
      // Clean up previews
      attachments.forEach(a => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
      setAttachments([]);
      onMessageSent?.();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocumentIcon = (mimeType: string) => {
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return '📊';
    }
    if (mimeType.includes('word') || mimeType === 'application/msword') {
      return '📝';
    }
    return '📄';
  };

  return (
    <div className="space-y-2">
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
          {attachments.map((attachment, index) => (
            <div 
              key={index} 
              className="relative group"
            >
              {attachment.type === 'image' && attachment.preview ? (
                <div className="relative w-16 h-16 rounded overflow-hidden">
                  <img 
                    src={attachment.preview} 
                    alt={attachment.file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="relative flex items-center gap-2 px-2 py-1.5 bg-background rounded border">
                  <span className="text-lg">{getDocumentIcon(attachment.file.type)}</span>
                  <div className="max-w-[100px]">
                    <p className="text-xs truncate">{attachment.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-[60px] w-[50px] flex-shrink-0"
              disabled={sending}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
              <Image className="w-4 h-4 mr-2" />
              Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
              <FileText className="w-4 h-4 mr-2" />
              Document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          multiple
          onChange={handleDocumentSelect}
          className="hidden"
        />

        <Textarea
          placeholder={replyingTo ? `Reply to ${replyingTo.senderName}...` : "Type a message..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] max-h-[120px] resize-none"
          disabled={sending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={(!message.trim() && attachments.length === 0) || sending}
          className="h-[60px] w-[60px]"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  );
}