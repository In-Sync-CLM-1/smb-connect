import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, X, FileText } from 'lucide-react';
import { CERTIFICATIONS, ISSUING_ORGANIZATIONS } from '@/lib/profileOptions';

interface EditCertificationsDialogProps {
  onSave: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export function EditCertificationsDialog({ onSave }: EditCertificationsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    issuing_organization: '',
    issue_date: '',
    expiration_date: '',
    credential_id: '',
    credential_url: '',
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, JPG, or PNG file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File, userId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `cert-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('certificates')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      let certificateFileUrl: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        certificateFileUrl = await uploadFile(selectedFile, user.id);
      }

      const { error } = await supabase.from('certifications').insert({
        user_id: user.id,
        name: formData.name,
        issuing_organization: formData.issuing_organization,
        issue_date: formData.issue_date || null,
        expiration_date: formData.expiration_date || null,
        credential_id: formData.credential_id || null,
        credential_url: formData.credential_url || null,
        certificate_file_url: certificateFileUrl,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Certification added',
      });
      setOpen(false);
      setFormData({
        name: '',
        issuing_organization: '',
        issue_date: '',
        expiration_date: '',
        credential_id: '',
        credential_url: '',
      });
      setSelectedFile(null);
      onSave();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to add certification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Certification</DialogTitle>
          <DialogDescription>Add a professional certification</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Combobox
              options={CERTIFICATIONS}
              value={formData.name}
              onValueChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="Select or type certification..."
              searchPlaceholder="Search certifications..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issuing_organization">Issuing Organization *</Label>
            <Combobox
              options={ISSUING_ORGANIZATIONS}
              value={formData.issuing_organization}
              onValueChange={(value) => setFormData({ ...formData, issuing_organization: value })}
              placeholder="Select or type organization..."
              searchPlaceholder="Search organizations..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiration Date</Label>
              <Input
                id="expiration_date"
                type="date"
                value={formData.expiration_date}
                onChange={(e) =>
                  setFormData({ ...formData, expiration_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credential_id">Credential ID</Label>
            <Input
              id="credential_id"
              placeholder="Certification ID or number"
              value={formData.credential_id}
              onChange={(e) => setFormData({ ...formData, credential_id: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credential_url">Credential URL</Label>
            <Input
              id="credential_url"
              type="url"
              placeholder="https://..."
              value={formData.credential_url}
              onChange={(e) => setFormData({ ...formData, credential_url: e.target.value })}
            />
          </div>

          {/* Certificate File Upload */}
          <div className="space-y-2">
            <Label>Certificate Document (optional)</Label>
            
            {selectedFile ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                <FileText className="w-5 h-5 text-primary" />
                <span className="flex-1 text-sm truncate">{selectedFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeSelectedFile}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="certificate-file-add"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Certificate
                </Button>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, JPG, PNG (Max 5MB)
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Certification'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}