import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Upload, Mail, MessageCircle } from 'lucide-react';
import { AssociationsList } from '@/components/AssociationsList';
import { BulkSendAssociationsDialog } from '@/components/admin/BulkSendAssociationsDialog';
import { useState } from 'react';

export default function AdminAssociations() {
  const navigate = useNavigate();
  const [selectedAssociations, setSelectedAssociations] = useState<string[]>([]);
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
              {selectedAssociations.length > 0 && (
                <Button 
                  variant="default" 
                  onClick={() => setShowBulkSendDialog(true)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send to Selected ({selectedAssociations.length})
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/admin/bulk-upload-associations')}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => navigate('/admin/create-association')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Association
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <AssociationsList 
          onSelectionChange={setSelectedAssociations}
          selectedIds={selectedAssociations}
        />
      </main>

      <BulkSendAssociationsDialog
        open={showBulkSendDialog}
        onOpenChange={setShowBulkSendDialog}
        associationIds={selectedAssociations}
      />
    </div>
  );
}
