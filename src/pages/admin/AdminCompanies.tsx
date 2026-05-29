import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Upload, Mail } from 'lucide-react';
import { CompaniesList } from '@/components/CompaniesList';
import { BulkSendCompaniesDialog } from '@/components/admin/BulkSendCompaniesDialog';
import { useState } from 'react';

export default function AdminCompanies() {
  const navigate = useNavigate();
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [showBulkSendDialog, setShowBulkSendDialog] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto py-4 md:pl-20">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex gap-2">
              {selectedCompanies.length > 0 && (
                <Button 
                  variant="default" 
                  onClick={() => setShowBulkSendDialog(true)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send to Selected ({selectedCompanies.length})
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/admin/bulk-upload-companies')}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => navigate('/admin/create-company')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Company
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <CompaniesList 
          onSelectionChange={setSelectedCompanies}
          selectedIds={selectedCompanies}
        />
      </main>

      <BulkSendCompaniesDialog
        open={showBulkSendDialog}
        onOpenChange={setShowBulkSendDialog}
        companyIds={selectedCompanies}
      />
    </div>
  );
}
