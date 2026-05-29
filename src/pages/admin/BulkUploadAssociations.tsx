import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Upload, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BulkUploadAssociations() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const downloadTemplate = () => {
    const csvContent = 'name,description,contact_email,contact_phone,website,address,city,state,country,postal_code\n' +
      'Example Association,"Sample description",contact@example.com,+91-1234567890,https://example.com,"123 Main St",Mumbai,Maharashtra,India,400001\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'associations_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Template Downloaded',
      description: 'associations_template.csv has been downloaded',
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Error',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
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

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const rowData: any = {};
          
          headers.forEach((header, index) => {
            rowData[header] = values[index] || null;
          });

          try {
            const { error } = await supabase.from('associations').insert({
              name: rowData.name,
              description: rowData.description,
              contact_email: rowData.contact_email,
              contact_phone: rowData.contact_phone,
              website: rowData.website,
              address: rowData.address,
              city: rowData.city,
              state: rowData.state,
              country: rowData.country || 'India',
              postal_code: rowData.postal_code,
            });

            if (error) throw error;
            success++;
          } catch (err) {
            console.error('Failed to insert row:', err);
            failed++;
          }
        }

        toast({
          title: 'Success',
          description: `Successfully processed ${success} records. ${failed} failed.`,
        });

        event.target.value = '';
        setUploading(false);
      };

      reader.readAsText(file);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process CSV file',
        variant: 'destructive',
      });
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto py-4 md:pl-20">
          <Button variant="ghost" onClick={() => navigate('/admin/associations')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Associations
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Bulk Upload Associations</h1>
          <p className="text-muted-foreground">
            Upload CSV file to create multiple associations at once
          </p>
        </div>

        <Alert className="mb-6">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Upload a CSV file to create multiple associations. Download the template to see the required format.
            <br />
            <strong>Required fields:</strong> name, contact_email
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Upload Associations CSV</CardTitle>
            <CardDescription>
              The CSV file should include: name, description, contact_email, contact_phone, website, address, city, state, country, postal_code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download CSV Template
            </Button>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Click to upload or drag and drop your CSV file
              </p>
              <label>
                <Button disabled={uploading} asChild>
                  <span>{uploading ? 'Uploading...' : 'Select CSV File'}</span>
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
