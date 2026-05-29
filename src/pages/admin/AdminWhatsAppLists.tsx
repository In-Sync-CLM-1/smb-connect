import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import CreateWhatsAppListDialog from "@/components/admin/CreateWhatsAppListDialog";
import BulkWhatsAppDialog from "@/components/admin/BulkWhatsAppDialog";

interface WhatsAppList {
  id: string;
  name: string;
  description: string | null;
  total_recipients: number;
  created_at: string;
}

const AdminWhatsAppLists = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<WhatsAppList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);

  useEffect(() => {
    loadWhatsAppLists();
  }, []);

  const loadWhatsAppLists = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLists(data || []);
    } catch (error: any) {
      toast.error("Failed to load WhatsApp lists");
      console.error('Error loading WhatsApp lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list? All recipients will be removed.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('whatsapp_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;
      toast.success("List deleted successfully");
      loadWhatsAppLists();
    } catch (error: any) {
      toast.error("Failed to delete list");
      console.error('Error deleting list:', error);
    }
  };

  const toggleListSelection = (listId: string) => {
    setSelectedLists(prev =>
      prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };

  const filteredLists = lists.filter(list =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (list.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">WhatsApp Lists</h1>
            <p className="text-muted-foreground">Manage WhatsApp broadcast lists</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create List
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedLists.length > 0 && (
          <Button onClick={() => setShowBulkDialog(true)}>
            <Send className="mr-2 h-4 w-4" />
            Send to selected lists ({selectedLists.length})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filteredLists.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              {searchQuery ? "No lists found matching your search" : "No WhatsApp lists created yet"}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredLists.map((list) => (
            <Card key={list.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedLists.includes(list.id)}
                      onCheckedChange={() => toggleListSelection(list.id)}
                      className="mt-1"
                    />
                    <div>
                      <CardTitle className="text-xl">{list.name}</CardTitle>
                      {list.description && (
                        <CardDescription className="mt-1">
                          {list.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/admin/whatsapp-lists/${list.id}`)}
                    >
                      Manage
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteList(list.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{list.total_recipients} recipients</span>
                  <span>Created {new Date(list.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateWhatsAppListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={loadWhatsAppLists}
      />

      <BulkWhatsAppDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
        selectedListIds={selectedLists}
        onSuccess={() => {
          setSelectedLists([]);
          setShowBulkDialog(false);
        }}
      />
    </div>
  );
};

export default AdminWhatsAppLists;
