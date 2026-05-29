import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useOwnershipScope } from '@/hooks/useOwnershipScope';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  ExternalLink, 
  Copy, 
  Edit, 
  Trash2, 
  Users,
  Eye,
  Loader2,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  is_active: boolean;
  registration_enabled: boolean;
  created_at: string;
  association_id: string | null;
  company_id: string | null;
  associations: {
    name: string;
  } | null;
  companies: {
    name: string;
  } | null;
  event_registrations: { count: number }[];
}

const EventLandingPages = () => {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scope = useOwnershipScope();
  const [deletePageId, setDeletePageId] = useState<string | null>(null);

  const { data: landingPages, isLoading } = useQuery({
    queryKey: ['landing-pages', scope.scope, scope.associationId, scope.companyId],
    queryFn: async () => {
      let query = supabase
        .from('event_landing_pages')
        .select(`
          id,
          title,
          slug,
          is_active,
          registration_enabled,
          created_at,
          association_id,
          company_id,
          associations (
            name
          ),
          companies (
            name
          ),
          event_registrations (
            count
          )
        `)
        .order('created_at', { ascending: false });

      if (scope.scope === 'association' && scope.associationId) {
        query = query.eq('association_id', scope.associationId);
      } else if (scope.scope === 'company' && scope.companyId) {
        query = query.eq('company_id', scope.companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as LandingPage[];
    },
    enabled: !!userId && (scope.scope === 'admin' || !!scope.associationId || !!scope.companyId),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('event_landing_pages')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast.success('Landing page updated');
    },
    onError: () => {
      toast.error('Failed to update landing page');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('event_landing_pages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast.success('Landing page deleted');
      setDeletePageId(null);
    },
    onError: () => {
      toast.error('Failed to delete landing page');
    },
  });

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/event/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const openPreview = (slug: string) => {
    window.open(`/event/${slug}`, '_blank');
  };

  const getRegistrationCount = (page: LandingPage): number => {
    if (page.event_registrations && page.event_registrations.length > 0) {
      return page.event_registrations[0]?.count || 0;
    }
    return 0;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <PageHeader
        title="Event Landing Pages"
        description="Manage custom landing pages for events with automatic user registration"
      />

      <div className="flex justify-end mb-6">
        <Button onClick={() => navigate(`${scope.basePath}/event-landing-pages/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Landing Page
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !landingPages || landingPages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No landing pages created yet</p>
            <Button onClick={() => navigate(`${scope.basePath}/event-landing-pages/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Landing Page
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {landingPages.map((page) => (
            <Card key={page.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {page.title}
                      <Badge variant={page.is_active ? 'default' : 'secondary'}>
                        {page.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {page.associations?.name && (
                        <span className="mr-3">Association: {page.associations.name}</span>
                      )}
                      {page.companies?.name && (
                        <span className="mr-3">Company: {page.companies.name}</span>
                      )}
                      <span>Created: {format(new Date(page.created_at), 'MMM d, yyyy')}</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={page.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: page.id, is_active: checked })
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      /event/{page.slug}
                    </code>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{getRegistrationCount(page)} registrations</span>
                  </div>
                  {page.registration_enabled && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Registration Open
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => openPreview(page.slug)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyUrl(page.slug)}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy URL
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`/event/${page.slug}`, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${scope.basePath}/event-landing-pages/${page.id}/registrations`)}
                  >
                    <ClipboardList className="h-4 w-4 mr-1" />
                    Registrations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${scope.basePath}/event-landing-pages/${page.id}/edit`)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletePageId(page.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletePageId} onOpenChange={() => setDeletePageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Landing Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this landing page? This action cannot be undone.
              All registration data associated with this page will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePageId && deleteMutation.mutate(deletePageId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventLandingPages;
