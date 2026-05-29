import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, FileText, ExternalLink } from 'lucide-react';
import { CERTIFICATIONS, ISSUING_ORGANIZATIONS } from '@/lib/profileOptions';

interface Certification {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date: string | null;
  expiration_date: string | null;
  credential_id?: string | null;
  credential_url: string | null;
  certificate_file_url?: string | null;
}

interface ManageCertificationDialogProps {
  certification: Certification;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export function ManageCertificationDialog({ 
  certification, 
  open, 
  onOpenChange, 
  onSave 
}: ManageCertificationDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: certification.name,
    issuing_organization: certification.issuing_organization,
    issue_date: certification.issue_date || '',
    expiration_date: certification.expiration_date || '',
    credential_id: certification.credential_id || '',
    credential_url: certification.credential_url || '',
    certificate_file_url: certification.certificate_file_url || '',
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

  const removeExistingFile = async () => {
    try {
      // Extract file path from URL to delete from storage
      if (formData.certificate_file_url) {
        const urlParts = formData.certificate_file_url.split('/certificates/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('certificates').remove([filePath]);
        }
      }
      
      setFormData({ ...formData, certificate_file_url: '' });
      toast({
        title: 'File removed',
        description: 'Certificate file has been removed.',
      });
    } catch (error) {
      console.error('Error removing file:', error);
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

      let certificateFileUrl = formData.certificate_file_url;

      // Upload new file if selected
      if (selectedFile) {
        // Remove old file first if exists
        if (formData.certificate_file_url) {
          const urlParts = formData.certificate_file_url.split('/certificates/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            await supabase.storage.from('certificates').remove([filePath]);
          }
        }
        
        certificateFileUrl = await uploadFile(selectedFile, user.id);
      }

      const { error } = await supabase
        .from('certifications')
        .update({
          name: formData.name,
          issuing_organization: formData.issuing_organization,
          issue_date: formData.issue_date || null,
          expiration_date: formData.expiration_date || null,
          credential_id: formData.credential_id || null,
          credential_url: formData.credential_url || null,
          certificate_file_url: certificateFileUrl || null,
        })
        .eq('id', certification.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Certification updated',
      });
      onOpenChange(false);
      onSave();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update certification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      // Remove file from storage if exists
      if (formData.certificate_file_url) {
        const urlParts = formData.certificate_file_url.split('/certificates/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('certificates').remove([filePath]);
        }
      }

      const { error } = await supabase
        .from('certifications')
        .delete()
        .eq('id', certification.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Certification deleted',
      });
      onOpenChange(false);
      onSave();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete certification',
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
          <DialogTitle>Edit Certification</DialogTitle>
          <DialogDescription>Update or delete this certification</DialogDescription>
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
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
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
            
            {/* Show existing file */}
            {formData.certificate_file_url && !selectedFile && (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                <FileText className="w-5 h-5 text-primary" />
                <a 
                  href={formData.certificate_file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-primary hover:underline truncate"
                >
                  View current certificate
                  <ExternalLink className="w-3 h-3 inline ml-1" />
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeExistingFile}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Show selected file */}
            {selectedFile && (
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
            )}

            {/* File input */}
            {!selectedFile && (
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="certificate-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {formData.certificate_file_url ? 'Replace Certificate' : 'Upload Certificate'}
                </Button>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, JPG, PNG (Max 5MB)
            </p>
          </div>

          <div className="flex justify-between gap-2 pt-4">
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}