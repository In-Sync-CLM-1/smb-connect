import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Upload, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserRole } from "@/hooks/useUserRole";

export default function BulkUploadCompanies() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const { userData } = useUserRole();
  const associationId = userData?.association?.id;

  const downloadTemplate = () => {
    const csvContent = 'name,description,email,phone,website,address,city,state,country,postal_code,gst_number,pan_number,business_type,industry_type,employee_count,annual_turnover\n' +
      'Example Company,"Sample company",company@example.com,+91-9876543210,https://company.com,"456 Business Rd",Mumbai,Maharashtra,India,400002,22AAAAA0000A1Z5,AAAAA0000A,Private Limited,Technology,50,10000000\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'companies_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Template Downloaded',
      description: 'companies_template.csv has been downloaded',
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

    if (!associationId) {
      toast({
        title: 'Error',
        description: 'Association ID not found',
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
            const { error } = await supabase.from('companies').insert({
              association_id: associationId,
              name: rowData.name,
              description: rowData.description,
              email: rowData.email,
              phone: rowData.phone,
              website: rowData.website,
              address: rowData.address,
              city: rowData.city,
              state: rowData.state,
              country: rowData.country || 'India',
              postal_code: rowData.postal_code,
              gst_number: rowData.gst_number,
              pan_number: rowData.pan_number,
              business_type: rowData.business_type,
              industry_type: rowData.industry_type,
              employee_count: rowData.employee_count ? parseInt(rowData.employee_count) : null,
              annual_turnover: rowData.annual_turnover ? parseFloat(rowData.annual_turnover) : null,
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
          <Button variant="ghost" onClick={() => navigate('/association')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Bulk Upload Companies</h1>
          <p className="text-muted-foreground">
            Upload multiple companies at once using a CSV file
          </p>
        </div>

        <Alert className="mb-6">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Download the CSV template below, fill in the company details (association will be automatically set), upload the completed CSV file. Companies will be automatically linked to your association.
            <br />
            <strong>Required fields:</strong> name, email
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Upload Companies CSV</CardTitle>
            <CardDescription>
              The CSV file should include: name, description, email, phone, website, address, city, state, country, postal_code, gst_number, pan_number, business_type, industry_type, employee_count, annual_turnover
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download CSV Template
            </Button>

            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-12 h-12 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  {uploading ? 'Processing...' : 'Click to upload or drag and drop'}
                </div>
                <div className="text-xs text-muted-foreground">CSV files only</div>
              </label>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
