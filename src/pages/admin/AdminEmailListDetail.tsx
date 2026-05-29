import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Download, Loader2, Users, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export default function AdminEmailListDetail() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [list, setList] = useState<any>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadList();
    loadRecipients();
  }, [listId]);

  const loadList = async () => {
    try {
      const { data, error } = await supabase
        .from('email_lists')
        .select('*')
        .eq('id', listId)
        .single();

      if (error) throw error;
      setList(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load bulk email list',
        variant: 'destructive',
      });
    }
  };

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_list_recipients')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipients(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load recipients',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Error',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileContent = await file.text();
      const { parseEmailCSV } = await import('@/lib/csvParser');
      const { recipients, errors: parseErrors } = parseEmailCSV(fileContent);

      if (recipients.length === 0) {
        throw new Error(parseErrors[0] || 'No valid recipients found');
      }

      const { data, error } = await supabase.rpc('import_email_list_recipients', {
        p_list_id: listId,
        p_recipients: recipients,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Imported ${data.imported} recipients`,
      });

      const allErrors = [...parseErrors, ...(data.errors || []).filter((e: string) => e)];
      if (allErrors.length > 0) {
        console.log('Import errors:', allErrors);
        toast({
          title: 'Warning',
          description: `${allErrors.length} rows had errors. Check console for details.`,
          variant: 'destructive',
        });
      }

      loadList();
      loadRecipients();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    try {
      const { error } = await supabase
        .from('email_list_recipients')
        .delete()
        .eq('id', recipientId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Recipient removed',
      });

      loadList();
      loadRecipients();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove recipient',
        variant: 'destructive',
      });
    }
  };

  const downloadTemplate = () => {
    const csvContent = `email,name
john.doe@example.com,John Doe
jane.smith@company.com,Jane Smith
contact@business.org,

# Instructions:
# 1. The 'email' column is REQUIRED
# 2. The 'name' column is optional
# 3. Remove these example rows and the instruction lines before uploading
# 4. Keep the header row (email,name)
# 5. One recipient per row`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-list-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: 'Template Downloaded',
      description: 'Remove example rows before uploading your data',
    });
  };

  const filteredRecipients = recipients.filter((recipient) =>
    recipient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (recipient.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 md:pl-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/admin/email-lists')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{list?.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {list?.description || 'Manage recipients'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pl-20">
        {/* Stats Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{list?.total_recipients || 0}</span>
              <span className="text-muted-foreground">Total Recipients</span>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Alert className="mb-6">
          <AlertDescription>
            <strong>CSV Format:</strong> Your CSV file must have an "email" column. Optionally include a "name" column. Additional columns will be stored as metadata.
          </AlertDescription>
        </Alert>

        {/* Search */}
        <div className="mb-4">
          <Input
            placeholder="Search recipients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Recipients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filteredRecipients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No recipients found' : 'No recipients yet. Upload a CSV file to get started.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell className="font-medium">{recipient.email}</TableCell>
                      <TableCell>{recipient.name || '-'}</TableCell>
                      <TableCell>
                        {new Date(recipient.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRecipient(recipient.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
