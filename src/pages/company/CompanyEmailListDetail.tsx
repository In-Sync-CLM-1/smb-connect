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

export default function CompanyEmailListDetail() {
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

  const downloadTemplate = () => {
    const csv = 'email,name\nexample@email.com,John Doe';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-list-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    if (!confirm('Are you sure you want to remove this recipient?')) return;

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

  const filteredRecipients = recipients.filter((recipient) =>
    recipient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (recipient.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 pl-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/company/email-lists')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Lists
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{list?.name || 'Bulk Email List'}</h1>
                <p className="text-sm text-muted-foreground">
                  {list?.description || 'Manage recipients'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

      <div className="container mx-auto px-4 py-6 pl-20">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Recipients ({list?.total_recipients || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription>
                Upload a CSV file with 'email' and 'name' columns to add recipients in bulk.
                Maximum 10,000 recipients per list.
              </AlertDescription>
            </Alert>

            <Input
              placeholder="Search recipients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-4"
            />

            {loading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : filteredRecipients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No recipients match your search' : 'No recipients yet. Upload a CSV to get started.'}
              </div>
            ) : (
              <div className="border rounded-lg">
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
                        <TableCell>{recipient.email}</TableCell>
                        <TableCell>{recipient.name || '-'}</TableCell>
                        <TableCell>{new Date(recipient.created_at).toLocaleDateString()}</TableCell>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
