import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Mail, Trash2, Users } from 'lucide-react';
import { CreateEmailListDialog } from '@/components/admin/CreateEmailListDialog';
import { BulkEmailDialog } from '@/components/admin/BulkEmailDialog';
import { useUserRole } from '@/hooks/useUserRole';

interface EmailList {
  id: string;
  name: string;
  description: string | null;
  total_recipients: number;
  created_at: string;
}

export default function CompanyEmailLists() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, userData } = useUserRole();
  const [lists, setLists] = useState<EmailList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkEmailDialog, setBulkEmailDialog] = useState<{ open: boolean; listIds: string[] }>({ 
    open: false, 
    listIds: [] 
  });
  const [selectedLists, setSelectedLists] = useState<string[]>([]);

  useEffect(() => {
    loadEmailLists();
  }, []);

  const loadEmailLists = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('email_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLists(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load bulk email lists',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this bulk email list? This will also delete all recipients.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Bulk email list deleted',
      });

      loadEmailLists();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete bulk email list',
        variant: 'destructive',
      });
    }
  };

  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (list.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 md:pl-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/company')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Bulk Email</h1>
                <p className="text-sm text-muted-foreground">Manage bulk email recipient lists</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create List
              </Button>
              {selectedLists.length > 0 && (
                <Button
                  onClick={() => setBulkEmailDialog({ open: true, listIds: selectedLists })}
                  variant="default"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send to {selectedLists.length} list{selectedLists.length > 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto py-4 md:py-6 md:pl-20">
        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Lists */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredLists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bulk email lists found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Create your first bulk email list to get started'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create List
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredLists.map((list) => (
              <Card key={list.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedLists.includes(list.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLists([...selectedLists, list.id]);
                          } else {
                            setSelectedLists(selectedLists.filter(id => id !== list.id));
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">{list.name}</CardTitle>
                        {list.description && (
                          <p className="text-sm text-muted-foreground mb-2">{list.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{list.total_recipients} recipients</span>
                          </div>
                          <span>Created {new Date(list.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/company/email-lists/${list.id}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setBulkEmailDialog({ open: true, listIds: [list.id] })}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteList(list.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateEmailListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          loadEmailLists();
          setCreateDialogOpen(false);
        }}
      />

      <BulkEmailDialog
        open={bulkEmailDialog.open}
        onOpenChange={(open) => setBulkEmailDialog({ open, listIds: [] })}
        listIds={bulkEmailDialog.listIds}
      />
    </div>
  );
}
