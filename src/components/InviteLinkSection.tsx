import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, RefreshCw, X, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteLink {
  id: string;
  token: string;
  role: string;
  use_count: number;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string;
  is_active: boolean;
}

interface InviteLinkSectionProps {
  organizationId: string;
  organizationType: 'association' | 'company';
}

export function InviteLinkSection({ organizationId, organizationType }: InviteLinkSectionProps) {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const linkUrl = link ? `${window.location.origin}/join/${link.token}` : '';

  const loadLink = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invite_links' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .eq('organization_type', organizationType)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setLink((data as InviteLink) || null);
    } catch (err: any) {
      console.error('Error loading invite link:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, organizationType]);

  useEffect(() => {
    loadLink();
  }, [loadLink]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const { data, error } = await supabase.rpc('create_invite_link' as any, {
        p_organization_id: organizationId,
        p_organization_type: organizationType,
        p_role: 'member',
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Invite link generated');
      loadLink();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate invite link');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!link) return;
    try {
      setRevoking(true);
      const { data, error } = await supabase.rpc('revoke_invite_link' as any, {
        p_link_id: link.id,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('Invite link disabled');
      setLink(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable invite link');
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Invite Link
        </CardTitle>
        <CardDescription>
          Share this link to let anyone join your {organizationType} directly
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : link ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline" className="capitalize">{link.role}</Badge>
                <span>{link.use_count} use{link.use_count !== 1 ? 's' : ''}</span>
                {link.expires_at && (
                  <span>Expires {new Date(link.expires_at).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1">Regenerate</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="text-destructive hover:text-destructive"
                >
                  {revoking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  <span className="ml-1">Disable</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No active invite link</p>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Generate Link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
