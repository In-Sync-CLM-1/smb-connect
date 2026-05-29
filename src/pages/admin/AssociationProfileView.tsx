import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Mail, Phone, Globe, MapPin, Calendar, Edit, Users, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { EditAssociationDialog } from '@/components/association/EditAssociationDialog';
import { EditAssociationProfileDialog } from '@/components/association/EditAssociationProfileDialog';
import { AddFunctionaryDialog } from '@/components/association/AddFunctionaryDialog';
import { InviteLinkDialog } from '@/components/InviteLinkDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface Association {
  id: string;
  name: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  is_active: boolean;
  founded_year: number;
  logo: string;
  industry: string;
  keywords: string[];
  social_links: any;
}

interface Functionary {
  id: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  bio: string;
  photo: string;
  display_order: number;
}

export default function AssociationProfileView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [association, setAssociation] = useState<Association | null>(null);
  const [functionaries, setFunctionaries] = useState<Functionary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProfileDialogOpen, setEditProfileDialogOpen] = useState(false);
  const [addFunctionaryDialogOpen, setAddFunctionaryDialogOpen] = useState(false);
  const [editingFunctionary, setEditingFunctionary] = useState<Functionary | null>(null);
  const [inviteLinkDialogOpen, setInviteLinkDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadAssociationData();
    }
  }, [id]);

  const loadAssociationData = async () => {
    try {
      setLoading(true);

      // Load association details
      const { data: assocData, error: assocError } = await supabase
        .from('associations')
        .select('*')
        .eq('id', id)
        .single();

      if (assocError) throw assocError;
      setAssociation(assocData);

      // Load functionaries
      const { data: funcData, error: funcError } = await supabase
        .from('key_functionaries')
        .select('*')
        .eq('association_id', id)
        .order('display_order');

      if (funcError) throw funcError;
      setFunctionaries(funcData || []);
    } catch (error: any) {
      console.error('Error loading association:', error);
      toast.error('Failed to load association details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!association) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Association Not Found</CardTitle>
            <CardDescription>The requested association could not be found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin/associations')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Associations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 pl-20">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/admin/associations')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Associations
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setInviteLinkDialogOpen(true)}>
                <Link2 className="w-4 h-4 mr-2" />
                Invite
              </Button>
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Quick Edit
              </Button>
              <Button onClick={() => setEditProfileDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pl-20">
        {/* Header Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0">
                {association.logo ? (
                  <img
                    src={association.logo}
                    alt={association.name}
                    className="w-24 h-24 object-contain rounded-lg border"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h1 className="text-3xl font-bold">{association.name}</h1>
                  <Badge variant={association.is_active ? 'default' : 'secondary'}>
                    {association.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-muted-foreground mb-4">{association.description}</p>
                <div className="flex flex-wrap gap-4 text-sm mb-4">
                  {association.founded_year && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Founded {association.founded_year}</span>
                    </Badge>
                  )}
                  {association.industry && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>{association.industry}</span>
                    </Badge>
                  )}
                </div>
                {association.keywords && association.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {association.keywords.map((keyword, index) => (
                      <Badge key={index} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {association.contact_email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${association.contact_email}`} className="text-primary hover:underline">
                    {association.contact_email}
                  </a>
                </div>
              </div>
            )}
            {association.contact_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <a href={`tel:${association.contact_phone}`} className="hover:underline">
                    {association.contact_phone}
                  </a>
                </div>
              </div>
            )}
            {association.website && (
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Website</p>
                  <a
                    href={association.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {association.website}
                  </a>
                </div>
              </div>
            )}
            {(association.address || association.city) && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p>
                    {association.address && `${association.address}, `}
                    {association.city}
                    {association.state && `, ${association.state}`}
                    {association.postal_code && ` - ${association.postal_code}`}
                    {association.country && `, ${association.country}`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Social Links */}
        {association.social_links && Object.keys(association.social_links).length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Social Media</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              {association.social_links.linkedin && (
                <a
                  href={association.social_links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  LinkedIn
                </a>
              )}
              {association.social_links.twitter && (
                <a
                  href={association.social_links.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Twitter
                </a>
              )}
              {association.social_links.facebook && (
                <a
                  href={association.social_links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Facebook
                </a>
              )}
              {association.social_links.instagram && (
                <a
                  href={association.social_links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Instagram
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Key Functionaries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Key Functionaries
                </CardTitle>
                <CardDescription>Leadership team members</CardDescription>
              </div>
              <Button onClick={() => setAddFunctionaryDialogOpen(true)}>
                Add Functionary
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {functionaries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No functionaries added yet</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {functionaries.map((functionary) => (
                  <Card key={functionary.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center">
                        <Avatar className="w-20 h-20 mb-3">
                          {functionary.photo ? (
                            <AvatarImage src={functionary.photo} alt={functionary.name} />
                          ) : (
                            <AvatarFallback>{functionary.name.charAt(0)}</AvatarFallback>
                          )}
                        </Avatar>
                        <h3 className="font-semibold text-lg">{functionary.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{functionary.designation}</p>
                        {functionary.bio && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{functionary.bio}</p>
                        )}
                        <div className="space-y-1 text-sm w-full">
                          {functionary.email && (
                            <div className="flex items-center justify-center gap-2">
                              <Mail className="w-3 h-3" />
                              <a href={`mailto:${functionary.email}`} className="text-primary hover:underline">
                                {functionary.email}
                              </a>
                            </div>
                          )}
                          {functionary.phone && (
                            <div className="flex items-center justify-center gap-2">
                              <Phone className="w-3 h-3" />
                              <span>{functionary.phone}</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setEditingFunctionary(functionary);
                            setAddFunctionaryDialogOpen(true);
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialogs */}
      {editDialogOpen && (
        <EditAssociationDialog
          association={association}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={loadAssociationData}
        />
      )}

      {editProfileDialogOpen && (
        <EditAssociationProfileDialog
          association={association}
          open={editProfileDialogOpen}
          onOpenChange={setEditProfileDialogOpen}
          onSuccess={loadAssociationData}
        />
      )}

      {inviteLinkDialogOpen && (
        <InviteLinkDialog
          open={inviteLinkDialogOpen}
          onOpenChange={setInviteLinkDialogOpen}
          organizationId={association.id}
          organizationType="association"
          organizationName={association.name}
        />
      )}

      {addFunctionaryDialogOpen && (
        <AddFunctionaryDialog
          associationId={association.id}
          functionary={editingFunctionary}
          open={addFunctionaryDialogOpen}
          onOpenChange={(open) => {
            setAddFunctionaryDialogOpen(open);
            if (!open) setEditingFunctionary(null);
          }}
          onSuccess={loadAssociationData}
        />
      )}
    </div>
  );
}
