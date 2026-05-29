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
import { Download, Upload, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BulkInviteMembersDialogProps {
  organizationId: string;
  organizationType: 'company' | 'association';
  onSuccess?: () => void;
}

export function BulkInviteMembersDialog({
  organizationId,
  organizationType,
  onSuccess,
}: BulkInviteMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const downloadTemplate = () => {
    const csvContent = 'email,first_name,last_name,role,designation,department\n' +
      'john.doe@example.com,John,Doe,member,Software Engineer,Engineering\n' +
      'jane.smith@example.com,Jane,Smith,admin,Manager,Operations\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'member_invitations_template.csv';
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
        
        // Parse all invitations
        const invitations = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const rowData: any = {};
          
          headers.forEach((header, index) => {
            rowData[header] = values[index] || null;
          });

          // Validate required fields
          if (!rowData.email || !rowData.first_name || !rowData.last_name) {
            errors.push(`Row ${i + 1}: Missing required fields (email, first_name, last_name)`);
            continue;
          }

          invitations.push({
            email: rowData.email,
            first_name: rowData.first_name,
            last_name: rowData.last_name,
            organization_id: organizationId,
            organization_type: organizationType,
            role: rowData.role || 'member',
            designation: rowData.designation || null,
            department: rowData.department || null,
          });
        }

        if (invitations.length === 0) {
          toast.error('No valid invitations found in CSV');
          setUploading(false);
          return;
        }

        setProgress({ current: 0, total: invitations.length });

        // Send all invitations in one request
        const { data, error } = await supabase.functions.invoke(
          'create-member-invitation',
          {
            body: {
              invitations,
            },
          }
        );

        setProgress({ current: invitations.length, total: invitations.length });

        const success = data?.results?.successful?.length || 0;
        const failed = data?.results?.failed?.length || 0;

        
        setUploading(false);
        
        if (success > 0) {
          toast.success(`Successfully sent ${success} invitation${success > 1 ? 's' : ''}`, {
            description: failed > 0 ? `${failed} invitation${failed > 1 ? 's' : ''} failed` : undefined,
          });
          setOpen(false);
          onSuccess?.();
        } else {
          toast.error('Failed to send invitations', {
            description: data?.results?.failed?.slice(0, 3).map((f: any) => `${f.email}: ${f.error}`).join('\n'),
          });
        }

        if (errors.length > 0) {
          console.error('CSV validation errors:', errors);
        }

        if (data?.results?.failed?.length > 0) {
          console.error('Bulk invitation failures:', data.results.failed);
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
          <Users className="mr-2 h-4 w-4" />
          Bulk Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Member Invitations</DialogTitle>
          <DialogDescription>
            Upload a CSV file to invite multiple members at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <Alert>
            <AlertDescription>
              Download the template CSV file, fill in member details, and upload it to send invitations.
              Required fields: email, first_name, last_name
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
                  Processing... {progress.total > 0 && `(${progress.current}/${progress.total})`}
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
              <li>email: Member's email address (required)</li>
              <li>first_name: First name (required)</li>
              <li>last_name: Last name (required)</li>
              <li>role: member, admin, or owner (defaults to member)</li>
              <li>designation: Job title (optional)</li>
              <li>department: Department name (optional)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
