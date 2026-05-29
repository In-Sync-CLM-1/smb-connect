import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Upload, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Recipient {
  id: string;
  phone: string;
  name: string | null;
  created_at: string;
}

const AdminWhatsAppListDetail = () => {
  const navigate = useNavigate();
  const { listId } = useParams();
  const [list, setList] = useState<any>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (listId) {
      loadList();
      loadRecipients();
    }
  }, [listId]);

  const loadList = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_lists')
        .select('*')
        .eq('id', listId)
        .single();

      if (error) throw error;
      setList(data);
    } catch (error: any) {
      toast.error("Failed to load list");
      console.error('Error loading list:', error);
    }
  };

  const loadRecipients = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_list_recipients')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipients(data || []);
    } catch (error: any) {
      toast.error("Failed to load recipients");
      console.error('Error loading recipients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const { parseWhatsAppCSV } = await import('@/lib/csvParser');
      const { recipients, errors: parseErrors } = parseWhatsAppCSV(text);

      if (recipients.length === 0) {
        throw new Error(parseErrors[0] || 'No valid recipients found in CSV');
      }

      const { data, error } = await supabase.rpc('import_whatsapp_list_recipients', {
        p_list_id: listId,
        p_recipients: recipients,
      });

      if (error) throw error;

      if (parseErrors.length > 0) {
        console.log('Parse errors:', parseErrors);
      }

      toast.success(`Successfully added ${data.imported} recipients`);
      loadList();
      loadRecipients();
    } catch (error: any) {
      toast.error("Failed to upload recipients");
      console.error('Error uploading recipients:', error);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_list_recipients')
        .delete()
        .eq('id', recipientId);

      if (error) throw error;
      toast.success("Recipient removed");
      loadList();
      loadRecipients();
    } catch (error: any) {
      toast.error("Failed to remove recipient");
      console.error('Error removing recipient:', error);
    }
  };

  const downloadTemplate = () => {
    const csv = 'phone,name\n+919876543210,John Doe\n+918765432109,Jane Smith';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp-list-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredRecipients = recipients.filter(recipient =>
    recipient.phone.includes(searchQuery) ||
    (recipient.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!list) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/whatsapp-lists')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{list.name}</h1>
            {list.description && (
              <p className="text-muted-foreground">{list.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Template
          </Button>
          <Button disabled={uploading}>
            <label className="flex items-center cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload CSV'}
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Recipients</CardTitle>
          <CardDescription>
            {list.total_recipients} phone numbers in this list
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert>
        <AlertDescription>
          Upload a CSV file with columns: phone, name. Phone numbers must be in international format (e.g., +919876543210)
        </AlertDescription>
      </Alert>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search recipients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredRecipients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No recipients found" : "No recipients added yet"}
                </TableCell>
              </TableRow>
            ) : (
              filteredRecipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell className="font-mono">{recipient.phone}</TableCell>
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
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminWhatsAppListDetail;
