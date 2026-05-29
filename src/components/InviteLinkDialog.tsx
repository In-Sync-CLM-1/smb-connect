import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, CheckCircle2, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationType: 'association' | 'company';
  organizationName: string;
}

export function InviteLinkDialog({
  open,
  onOpenChange,
  organizationId,
  organizationType,
  organizationName,
}: InviteLinkDialogProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const linkUrl = token ? `${window.location.origin}/join/${token}` : '';

  useEffect(() => {
    if (open) loadOrCreateLink();
  }, [open, organizationId]);

  const loadOrCreateLink = async () => {
    try {
      setLoading(true);
      // Check for existing active link
      const { data, error } = await supabase
        .from('invite_links' as any)
        .select('token')
        .eq('organization_id', organizationId)
        .eq('organization_type', organizationType)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        setToken((data as any).token);
      } else {
        // Auto-generate if none exists
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_invite_link' as any, {
          p_organization_id: organizationId,
          p_organization_type: organizationType,
          p_role: 'member',
        });
        if (rpcError) throw rpcError;
        if (!rpcData.success) throw new Error(rpcData.error);
        setToken(rpcData.token);
      }
    } catch (err: any) {
      console.error('Error loading invite link:', err);
      toast.error('Failed to load invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Invite Link — {organizationName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share this link to let anyone join directly.
            </p>
            <div className="flex gap-2">
              <Input value={linkUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
