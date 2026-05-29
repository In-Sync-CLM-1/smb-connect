import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { HomeButton } from "@/components/HomeButton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Users,
  Calendar,
  Briefcase,
  DollarSign,
  FileText,
  Link2,
} from "lucide-react";
import { InviteLinkDialog } from "@/components/InviteLinkDialog";

interface Company {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  business_type: string | null;
  industry_type: string | null;
  employee_count: number | null;
  year_established: number | null;
  annual_turnover: number | null;
  gst_number: string | null;
  pan_number: string | null;
  is_active: boolean;
  is_verified: boolean;
  association_id: string;
  created_at: string;
}

interface Association {
  id: string;
  name: string;
}

export default function AdminCompanyProfileView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [association, setAssociation] = useState<Association | null>(null);
  const [membersCount, setMembersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inviteLinkDialogOpen, setInviteLinkDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadCompanyData();
    }
  }, [id]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);

      // Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch association details
      if (companyData.association_id) {
        const { data: assocData } = await supabase
          .from("associations")
          .select("id, name")
          .eq("id", companyData.association_id)
          .single();

        setAssociation(assocData);
      }

      // Fetch members count
      const { count } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("company_id", id)
        .eq("is_active", true);

      setMembersCount(count || 0);
    } catch (error: any) {
      console.error("Error loading company:", error);
      toast.error("Failed to load company details");
    } finally {
      setLoading(false);
    }
  };

  const toggleActiveStatus = async () => {
    if (!company) return;

    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_active: !company.is_active })
        .eq("id", company.id);

      if (error) throw error;

      toast.success(
        `Company ${company.is_active ? "deactivated" : "activated"} successfully`
      );
      loadCompanyData();
    } catch (error: any) {
      console.error("Error updating company status:", error);
      toast.error("Failed to update company status");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-4 md:py-8 md:!pl-20 md:!pl-24">
          <BackButton fallbackPath="/admin/companies" variant="ghost" label="Back" />
          <div className="text-center mt-8">
            <p className="text-muted-foreground">Company not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 md:!pl-20 md:!pl-24">
        <div className="flex items-center justify-between mb-8">
          <BackButton fallbackPath="/admin/companies" variant="ghost" label="Back" />
          <HomeButton />
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={company.name}
                  className="w-24 h-24 rounded-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
                  <div className="flex gap-2 mb-3">
                    <Badge variant={company.is_active ? "default" : "secondary"}>
                      {company.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {company.is_verified && (
                      <Badge variant="outline">Verified</Badge>
                    )}
                  </div>
                  {association && (
                    <p className="text-sm text-muted-foreground">
                      Association: {association.name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setInviteLinkDialogOpen(true)}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Invite
                  </Button>
                  <Button
                    variant={company.is_active ? "destructive" : "default"}
                    onClick={toggleActiveStatus}
                  >
                    {company.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
              {company.description && (
                <p className="text-muted-foreground mt-4">{company.description}</p>
              )}
            </div>
          </div>
        </div>

        {inviteLinkDialogOpen && (
          <InviteLinkDialog
            open={inviteLinkDialogOpen}
            onOpenChange={setInviteLinkDialogOpen}
            organizationId={company.id}
            organizationType="company"
            organizationName={company.name}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{company.email}</span>
              </div>
              {company.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{company.phone}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {company.website}
                  </a>
                </div>
              )}
              {company.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">
                    {company.address}
                    {company.city && `, ${company.city}`}
                    {company.state && `, ${company.state}`}
                    {company.postal_code && ` - ${company.postal_code}`}
                    <br />
                    {company.country}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.business_type && (
                <div className="flex items-center gap-3">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{company.business_type}</span>
                </div>
              )}
              {company.industry_type && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{company.industry_type}</span>
                </div>
              )}
              {company.employee_count && (
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{company.employee_count} employees</span>
                </div>
              )}
              {company.year_established && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Established {company.year_established}</span>
                </div>
              )}
              {company.annual_turnover && (
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    ₹{company.annual_turnover.toLocaleString()} annual turnover
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tax Information */}
          {(company.gst_number || company.pan_number) && (
            <Card>
              <CardHeader>
                <CardTitle>Tax Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {company.gst_number && (
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">GST Number</p>
                      <p className="text-sm">{company.gst_number}</p>
                    </div>
                  </div>
                )}
                {company.pan_number && (
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">PAN Number</p>
                      <p className="text-sm">{company.pan_number}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{membersCount} active members</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
