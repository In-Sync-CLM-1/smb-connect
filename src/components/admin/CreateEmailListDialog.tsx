import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleContext } from '@/contexts/RoleContext';
import { Loader2 } from 'lucide-react';

interface CreateEmailListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateEmailListDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateEmailListDialogProps) {
  const { toast } = useToast();
  const { role, userData } = useUserRole();
  const { selectedAssociationId, selectedCompanyId } = useRoleContext();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a list name',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      // Prepare insert data with organizational context
      const insertData: any = {
        name: name.trim(),
        description: description.trim() || null,
        created_by: user.id,
      };

      console.log('=== CREATE EMAIL LIST DEBUG ===');
      console.log('role:', role);
      console.log('userData.association_id:', userData?.association_id);
      console.log('userData.company_id:', userData?.company_id);
      console.log('selectedAssociationId:', selectedAssociationId);
      console.log('selectedCompanyId:', selectedCompanyId);

      // Add organizational context based on current role
      if (role === 'association' && userData?.association_id) {
        insertData.association_id = userData.association_id;
      } else if (role === 'company' && userData?.company_id) {
        insertData.company_id = userData.company_id;
      } else if (role === 'admin' || role === 'platform-admin') {
        // Priority 1: Use selectedAssociationId from RoleContext (set by dashboard)
        if (selectedAssociationId) {
          insertData.association_id = selectedAssociationId;
        } else if (selectedCompanyId) {
          insertData.company_id = selectedCompanyId;
        } else {
          throw new Error('Please select an association or company first from the dashboard');
        }
      }

      console.log('Final insertData:', insertData);

      const { error } = await supabase
        .from('email_lists')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Bulk email list created',
      });

      setName('');
      setDescription('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create bulk email list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Bulk Email List</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">List Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Newsletter Subscribers"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this list"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create List'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
