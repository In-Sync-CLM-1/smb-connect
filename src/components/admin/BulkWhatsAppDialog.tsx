import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedListIds: string[];
  onSuccess: () => void;
}

const BulkWhatsAppDialog = ({
  open,
  onOpenChange,
  selectedListIds,
  onSuccess,
}: BulkWhatsAppDialogProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    const results = {
      totalSent: 0,
      totalFailed: 0,
    };

    try {
      for (const listId of selectedListIds) {
        const { data, error } = await supabase.functions.invoke('send-bulk-whatsapp', {
          body: {
            listId,
            message: message.trim(),
            senderPhone: 'SMB Connect',
            senderName: 'SMB Connect',
          }
        });

        if (error) throw error;
        
        results.totalSent += data.sent;
        results.totalFailed += data.failed;
      }

      toast.success(`Sent ${results.totalSent} messages successfully${results.totalFailed > 0 ? `, ${results.totalFailed} failed` : ''}`);
      setMessage("");
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to send messages");
      console.error('Error sending bulk WhatsApp:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Bulk WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              This will send the message to all recipients in the selected {selectedListIds.length} list(s).
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message here..."
              rows={6}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? "Sending..." : "Send Messages"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkWhatsAppDialog;
