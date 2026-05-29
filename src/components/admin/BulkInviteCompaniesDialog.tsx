import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BulkInviteCompaniesDialogProps {
  associationId: string;
  onSuccess?: () => void;
}

export function BulkInviteCompaniesDialog({
  associationId,
  onSuccess,
}: BulkInviteCompaniesDialogProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const downloadTemplate = () => {
    const csvContent = 'company_name,email\n' +
      'Acme Corporation,contact@acme.com\n' +
      'Tech Solutions Ltd,info@techsolutions.com\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'company_invitations_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Template downloaded successfully');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    try {
      setUploading(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        // Fetch association name and user profile data before processing
        const { data: { session: userSession } } = await supabase.auth.getSession();
        const userData = { user: userSession?.user };
        if (!userData?.user?.id) {
          toast.error('User not authenticated');
          setUploading(false);
          return;
        }

        const { data: associationData } = await supabase
          .from('associations')
          .select('name')
          .eq('id', associationId)
          .single();

        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', userData.user.id)
          .single();

        if (!associationData || !profileData) {
          toast.error('Failed to fetch required data');
          setUploading(false);
          return;
        }

        const invitedByName = `${profileData.first_name} ${profileData.last_name}`;
        const invitedByEmail = profileData.email;
        const associationName = associationData.name;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const rowData: any = {};
          
          headers.forEach((header, index) => {
            rowData[header] = values[index] || null;
          });

          // Validate required fields
          if (!rowData.company_name || !rowData.email) {
            errors.push(`Row ${i + 1}: Missing required fields (company_name, email)`);
            failed++;
            continue;
          }

          try {
            // Generate token
            const token = crypto.randomUUID();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            const { data: invitationData, error: inviteError } = await supabase
              .from('company_invitations')
              .insert({
                association_id: associationId,
                company_name: rowData.company_name,
                email: rowData.email,
                token,
                expires_at: expiresAt.toISOString(),
                invited_by: userData.user.id,
                status: 'pending',
              })
              .select()
              .single();

            if (inviteError) throw inviteError;

            // Send invitation email with all required parameters
            const { error: emailError } = await supabase.functions.invoke(
              'send-company-invitation',
              {
                body: {
                  invitationId: invitationData.id,
                  companyName: rowData.company_name,
                  recipientEmail: rowData.email,
                  invitedByName,
                  invitedByEmail,
                  associationName,
                  token,
                },
              }
            );

            if (emailError) {
              console.error('Email send error:', emailError);
              errors.push(`Row ${i + 1} (${rowData.email}): Email not sent but invitation created`);
            }

            success++;
          } catch (err: any) {
            errors.push(`Row ${i + 1} (${rowData.email}): ${err.message}`);
            failed++;
          }
        }

        setUploading(false);
        
        if (success > 0) {
          toast.success(`Successfully sent ${success} invitation${success > 1 ? 's' : ''}`, {
            description: failed > 0 ? `${failed} invitation${failed > 1 ? 's' : ''} failed` : undefined,
          });
          setOpen(false);
          onSuccess?.();
        } else {
          toast.error('Failed to send invitations', {
            description: errors.slice(0, 3).join('\n'),
          });
        }

        if (errors.length > 0) {
          console.error('Bulk invitation errors:', errors);
        }

        // Reset file input
        event.target.value = '';
      };

      reader.readAsText(file);
    } catch (error: any) {
      console.error('Error processing file:', error);
      toast.error(error.message || 'Failed to process file');
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Building2 className="mr-2 h-4 w-4" />
          Bulk Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Company Invitations</DialogTitle>
          <DialogDescription>
            Upload a CSV file to invite multiple companies at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <Alert>
            <AlertDescription>
              Download the template CSV file, fill in company details, and upload it to send invitations.
              Required fields: company_name, email
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>

            <label htmlFor="csv-upload" className="flex-1">
              <Button
                type="button"
                className="w-full"
                disabled={uploading}
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload CSV
                  </>
                )}
              </Button>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">CSV Format:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>company_name: Company name (required)</li>
              <li>email: Company contact email (required)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
