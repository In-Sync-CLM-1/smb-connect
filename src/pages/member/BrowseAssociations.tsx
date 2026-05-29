import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Building, MapPin, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HomeButton } from "@/components/HomeButton";
import { toast } from "sonner";

interface Association {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  founded_year: number | null;
  website: string | null;
}

export default function BrowseAssociations() {
  const navigate = useNavigate();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [filteredAssociations, setFilteredAssociations] = useState<Association[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssociations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, associations]);

  const loadAssociations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("associations")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAssociations(data || []);
    } catch (error: any) {
      toast.error("Failed to load associations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...associations];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (assoc) =>
          assoc.name.toLowerCase().includes(search) ||
          assoc.description?.toLowerCase().includes(search) ||
          assoc.city?.toLowerCase().includes(search) ||
          assoc.industry?.toLowerCase().includes(search)
      );
    }

    setFilteredAssociations(filtered);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Browse Associations</h1>
            <p className="text-muted-foreground">
              Discover associations and organizations in your network
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
            <p className="text-muted-foreground">Loading associations...</p>
          </div>
        ) : filteredAssociations.length === 0 ? (
          <div className="text-center py-12">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No associations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssociations.map((association) => (
              <Card
                key={association.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/member/association/${association.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    {association.logo ? (
                      <img
                        src={association.logo}
                        alt={association.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building className="h-8 w-8 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate">{association.name}</CardTitle>
                      {association.industry && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {association.industry}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {association.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {association.description}
                    </p>
                  )}
                  <div className="space-y-2 text-sm">
                    {(association.city || association.state) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {[association.city, association.state].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    {association.founded_year && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Founded {association.founded_year}</span>
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
