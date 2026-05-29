import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Users,
  Calendar,
  Briefcase,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  industry_type: string | null;
  business_type: string | null;
  employee_count: number | null;
  year_established: number | null;
  annual_turnover: number | null;
}

export default function CompanyProfileView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompany();
  }, [id]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setCompany(data);
    } catch (error: any) {
      toast.error("Failed to load company profile");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading company profile...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Company not found</p>
          <Button onClick={() => navigate("/member/browse-companies")}>
            Back to Companies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 pl-14 md:pl-20 lg:pl-24 pr-4">
        <div className="flex items-center mb-8">
          <BackButton fallbackPath="/dashboard" variant="ghost" label="Back" />
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start gap-6">
                {company.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2">{company.name}</CardTitle>
                  {company.industry_type && (
                    <p className="text-lg text-muted-foreground">
                      {company.industry_type}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {company.description && (
                <p className="text-muted-foreground mb-6">{company.description}</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <a href={`mailto:${company.email}`} className="hover:underline">
                      {company.email}
                    </a>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <a href={`tel:${company.phone}`} className="hover:underline">
                      {company.phone}
                    </a>
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {company.website}
                    </a>
                  </div>
                )}
                {(company.address || company.city || company.state) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                    <div>
                      {company.address && <p>{company.address}</p>}
                      <p>
                        {[company.city, company.state, company.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {company.country && <p>{company.country}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Company Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.business_type && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <span>{company.business_type}</span>
                  </div>
                )}
                {company.employee_count && (
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>{company.employee_count} employees</span>
                  </div>
                )}
                {company.year_established && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span>Established {company.year_established}</span>
                  </div>
                )}
                {company.annual_turnover && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">Annual Turnover:</span>
                    <span>₹{company.annual_turnover.toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
