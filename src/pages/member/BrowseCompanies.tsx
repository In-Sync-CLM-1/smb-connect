import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Building2, MapPin, Users, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HomeButton } from "@/components/HomeButton";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
  industry_type: string | null;
  employee_count: number | null;
  year_established: number | null;
  website: string | null;
}

export default function BrowseCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, companies]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      toast.error("Failed to load companies");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...companies];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (company) =>
          company.name.toLowerCase().includes(search) ||
          company.description?.toLowerCase().includes(search) ||
          company.city?.toLowerCase().includes(search) ||
          company.industry_type?.toLowerCase().includes(search)
      );
    }

    setFilteredCompanies(filtered);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Browse Companies</h1>
            <p className="text-muted-foreground">
              Discover and connect with companies in your network
            </p>
          </div>
          <HomeButton />
        </div>

        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by name, industry, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading companies...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No companies found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <Card
                key={company.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/member/company/${company.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    {company.logo ? (
                      <img
                        src={company.logo}
                        alt={company.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate">{company.name}</CardTitle>
                      {company.industry_type && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {company.industry_type}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {company.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {company.description}
                    </p>
                  )}
                  <div className="space-y-2 text-sm">
                    {(company.city || company.state) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {[company.city, company.state].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    {company.employee_count && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{company.employee_count} employees</span>
                      </div>
                    )}
                    {company.year_established && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Established {company.year_established}</span>
                      </div>
                    )}
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    View Profile
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
