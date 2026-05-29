import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Upload, Plus, Mail, Phone, Globe, MapPin, Calendar, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { EditAssociationProfileDialog } from '@/components/association/EditAssociationProfileDialog';
import { AddFunctionaryDialog } from '@/components/association/AddFunctionaryDialog';

export default function AssociationProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData } = useUserRole();
  const [association, setAssociation] = useState<any>(null);
  const [functionaries, setFunctionaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [functionaryDialogOpen, setFunctionaryDialogOpen] = useState(false);
  const [editingFunctionary, setEditingFunctionary] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (userData?.association) {
      loadAssociation(userData.association.id);
      loadFunctionaries(userData.association.id);
    }
  }, [userData]);

  const loadAssociation = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('associations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAssociation(data);
    } catch (error: any) {
      console.error('Error loading association:', error);
      toast({
        title: 'Error',
        description: 'Failed to load association profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFunctionaries = async (associationId: string) => {
    try {
      const { data, error } = await supabase
        .from('key_functionaries')
        .select('*')
        .eq('association_id', associationId)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setFunctionaries(data || []);
    } catch (error: any) {
      console.error('Error loading functionaries:', error);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !association) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      // Delete old logo if exists
      if (association.logo) {
        const oldPath = association.logo.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('association-logos')
            .remove([`${association.id}/${oldPath}`]);
        }
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${association.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('association-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('association-logos')
        .getPublicUrl(filePath);

      // Update association record
      const { error: updateError } = await supabase
        .from('associations')
        .update({ logo: publicUrl })
        .eq('id', association.id);

      if (updateError) throw updateError;

      setAssociation({ ...association, logo: publicUrl });
      toast({
        title: 'Success',
        description: 'Logo updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEditFunctionary = (functionary: any) => {
    setEditingFunctionary(functionary);
    setFunctionaryDialogOpen(true);
  };

  const handleDeleteFunctionary = async (id: string) => {
    if (!confirm('Are you sure you want to remove this functionary?')) return;

    try {
      const { error } = await supabase
        .from('key_functionaries')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Functionary removed successfully',
      });
      loadFunctionaries(association.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove functionary',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!association) return null;

  const socialLinks = association.social_links || {};

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto py-4 md:pl-20">
          <Button
            variant="ghost"
            onClick={() => navigate('/association')}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20 max-w-6xl">
        {/* Header with Logo */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="relative">
                {association.logo ? (
                  <img
                    src={association.logo}
                    alt={association.name}
                    className="w-32 h-32 rounded-lg object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                    <Globe className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 cursor-pointer">
                  <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90">
                    <Upload className="w-4 h-4" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{association.name}</h1>
                    <Badge variant={association.is_active ? 'default' : 'secondary'}>
                      {association.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button onClick={() => setEditDialogOpen(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>

                {association.description && (
                  <p className="text-muted-foreground mb-4">{association.description}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {association.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${association.contact_email}`} className="text-primary hover:underline">
                        {association.contact_email}
                      </a>
                    </div>
                  )}
                  {association.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${association.contact_phone}`} className="hover:underline">
                        {association.contact_phone}
                      </a>
                    </div>
                  )}
                  {association.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <a href={association.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Website
                      </a>
                    </div>
                  )}
                  {association.founded_year && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Founded {association.founded_year}</span>
                    </div>
                  )}
                  {(association.city || association.state) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {association.city}
                        {association.state && `, ${association.state}`}
                        {association.country && ` - ${association.country}`}
                      </span>
                    </div>
                  )}
                </div>

                {association.keywords && association.keywords.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {association.keywords.map((keyword: string, index: number) => (
                        <Badge key={index} variant="outline">{keyword}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Functionaries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Key Functionaries</CardTitle>
                <CardDescription>Leadership and management team</CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingFunctionary(null);
                  setFunctionaryDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Functionary
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {functionaries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No functionaries added yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {functionaries.map((functionary) => (
                  <Card key={functionary.id} className="relative group">
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center">
                        {functionary.photo ? (
                          <img
                            src={functionary.photo}
                            alt={functionary.name}
                            className="w-20 h-20 rounded-full object-cover mb-3"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-3">
                            <span className="text-2xl font-bold text-muted-foreground">
                              {functionary.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <h3 className="font-semibold">{functionary.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{functionary.designation}</p>
                        {functionary.bio && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{functionary.bio}</p>
                        )}
                        <div className="space-y-1 text-xs">
                          {functionary.email && (
                            <div className="flex items-center gap-1 justify-center">
                              <Mail className="w-3 h-3" />
                              <a href={`mailto:${functionary.email}`} className="text-primary hover:underline">
                                Email
                              </a>
                            </div>
                          )}
                          {functionary.phone && (
                            <div className="flex items-center gap-1 justify-center">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${functionary.phone}`} className="hover:underline">
                                {functionary.phone}
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditFunctionary(functionary)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteFunctionary(functionary.id)}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <EditAssociationProfileDialog
        association={association}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => loadAssociation(association.id)}
      />

      <AddFunctionaryDialog
        associationId={association.id}
        functionary={editingFunctionary}
        open={functionaryDialogOpen}
        onOpenChange={(open) => {
          setFunctionaryDialogOpen(open);
          if (!open) setEditingFunctionary(null);
        }}
        onSuccess={() => loadFunctionaries(association.id)}
      />
    </div>
  );
}
