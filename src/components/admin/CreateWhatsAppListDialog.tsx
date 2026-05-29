import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleContext } from '@/contexts/RoleContext';
import { toast } from "sonner";

interface CreateWhatsAppListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateWhatsAppListDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateWhatsAppListDialogProps) => {
  const { role, userData } = useUserRole();
  const { selectedAssociationId, selectedCompanyId } = useRoleContext();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a list name");
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");

      console.log('=== CREATE WHATSAPP LIST DEBUG ===');
      console.log('role:', role);
      console.log('userData.association_id:', userData?.association_id);
      console.log('userData.company_id:', userData?.company_id);
      console.log('selectedAssociationId:', selectedAssociationId);
      console.log('selectedCompanyId:', selectedCompanyId);

      const insertData: any = {
        name: name.trim(),
        description: description.trim() || null,
        created_by: user.id,
      };

      // Add organizational context based on current role
      if (role === 'association' && userData?.association_id) {
        insertData.association_id = userData.association_id;
      } else if (role === 'company' && userData?.company_id) {
        insertData.company_id = userData.company_id;
      } else if (role === 'admin' || role === 'platform-admin') {
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
        .from('whatsapp_lists')
        .insert(insertData);

      if (error) throw error;

      toast.success("WhatsApp list created successfully");
      setName("");
      setDescription("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Failed to create list");
      console.error('Error creating list:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create WhatsApp List</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">List Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly Newsletter Subscribers"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this list..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create List"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWhatsAppListDialog;
