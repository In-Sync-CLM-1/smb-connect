import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, UserPlus, Search, Check, Clock, X, Filter, Building2, MapPin, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RoleNavigation } from '@/components/RoleNavigation';
import { MobileNavigation } from '@/components/layout/MobileNavigation';

interface Member {
  id: string;
  user_id: string;
  profile: {
    first_name: string;
    last_name: string;
    avatar: string | null;
    bio: string | null;
  };
  company: {
    id: string;
    name: string;
    association_id: string;
    employee_count: number | null;
    annual_turnover: number | null;
    city: string | null;
    state: string | null;
    country: string | null;
    association: {
      id: string;
      name: string;
    } | null;
  } | null;
  connectionStatus?: 'none' | 'pending_sent' | 'pending_received' | 'connected';
}

interface Association {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  association_id: string;
}

// Cap how many rows we render at once. With ~1,400 members, painting every
// matching row at once blocks the main thread, so we show a slice and let the
// user narrow with search/filters.
const MAX_VISIBLE_RESULTS = 100;

// The criteria that actually drive filtering. These only change when the user
// clicks Search / presses Enter — the input state is the "draft" being edited.
interface AppliedFilters {
  search: string;
  association: string;
  company: string;
  minEmployees: string;
  maxEmployees: string;
  minTurnover: string;
  maxTurnover: string;
  city: string;
  state: string;
  country: string;
}

const EMPTY_FILTERS: AppliedFilters = {
  search: '', association: '', company: '', minEmployees: '', maxEmployees: '',
  minTurnover: '', maxTurnover: '', city: '', state: '', country: '',
};

export default function BrowseMembers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData, loading: userLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  
  // Filter states
  const [associations, setAssociations] = useState<Association[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedAssociation, setSelectedAssociation] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [minEmployees, setMinEmployees] = useState<string>('');
  const [maxEmployees, setMaxEmployees] = useState<string>('');
  const [minTurnover, setMinTurnover] = useState<string>('');
  const [maxTurnover, setMaxTurnover] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  // Snapshot of the criteria actually being applied. Updated only on Search/Enter/Clear.
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(EMPTY_FILTERS);

  useEffect(() => {
    if (!userLoading && userData) {
      loadMembers();
      loadFiltersData();
    }
  }, [userLoading, userData]);

  // Re-filter only when the applied criteria change or the member list reloads —
  // not while the user is typing.
  useEffect(() => {
    applyFilters();
  }, [appliedFilters, members]);

  const loadFiltersData = async () => {
    try {
      // Load associations
      const { data: associationsData } = await supabase
        .from('associations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (associationsData) setAssociations(associationsData);

      // Load companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, association_id')
        .eq('is_active', true)
        .order('name');
      
      if (companiesData) setCompanies(companiesData);
    } catch (error) {
      console.error('Error loading filters data:', error);
    }
  };

  const applyFilters = () => {
    const f = appliedFilters;
    let filtered = [...members];

    // Search term filter
    if (f.search) {
      const search = f.search.toLowerCase();
      filtered = filtered.filter(m => {
        const fullName = `${m.profile.first_name} ${m.profile.last_name}`.toLowerCase();
        const companyName = m.company?.name.toLowerCase() || '';
        return fullName.includes(search) || companyName.includes(search);
      });
    }

    // Association filter
    if (f.association) {
      filtered = filtered.filter(m => m.company?.association_id === f.association);
    }

    // Company filter
    if (f.company) {
      filtered = filtered.filter(m => m.company?.id === f.company);
    }

    // Employee count filter
    if (f.minEmployees) {
      const min = parseInt(f.minEmployees);
      filtered = filtered.filter(m => m.company?.employee_count && m.company.employee_count >= min);
    }
    if (f.maxEmployees) {
      const max = parseInt(f.maxEmployees);
      filtered = filtered.filter(m => m.company?.employee_count && m.company.employee_count <= max);
    }

    // Turnover filter
    if (f.minTurnover) {
      const min = parseFloat(f.minTurnover);
      filtered = filtered.filter(m => m.company?.annual_turnover && m.company.annual_turnover >= min);
    }
    if (f.maxTurnover) {
      const max = parseFloat(f.maxTurnover);
      filtered = filtered.filter(m => m.company?.annual_turnover && m.company.annual_turnover <= max);
    }

    // Location filters
    if (f.city) {
      filtered = filtered.filter(m => m.company?.city?.toLowerCase() === f.city.toLowerCase());
    }
    if (f.state) {
      filtered = filtered.filter(m => m.company?.state?.toLowerCase() === f.state.toLowerCase());
    }
    if (f.country) {
      filtered = filtered.filter(m => m.company?.country?.toLowerCase() === f.country.toLowerCase());
    }

    setFilteredMembers(filtered);
  };

  // Snapshot the current draft inputs into the applied filters — this is the trigger.
  const runSearch = () => {
    setAppliedFilters({
      search: searchTerm,
      association: selectedAssociation,
      company: selectedCompany,
      minEmployees,
      maxEmployees,
      minTurnover,
      maxTurnover,
      city: selectedCity,
      state: selectedState,
      country: selectedCountry,
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAssociation('');
    setSelectedCompany('');
    setMinEmployees('');
    setMaxEmployees('');
    setMinTurnover('');
    setMaxTurnover('');
    setSelectedCity('');
    setSelectedState('');
    setSelectedCountry('');
    setAppliedFilters(EMPTY_FILTERS);
  };

  const loadMembers = async () => {
    try {
      setLoading(true);

      // Get current auth user
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        console.log('No authenticated user found');
        return;
      }

      // Look up the current user's member record by auth user_id (use limit(1) to handle duplicate member records)
      const { data: currentMembers } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      const currentMember = currentMembers?.[0] || null;

      if (currentMember) {
        setCurrentMemberId(currentMember.id);
      }
      console.log('Loading members, current member id:', currentMember?.id || 'none (non-member user)');

      // Load all members (exclude current user if they have a member record) with company and association details
      // Fetch in pages of 1000 to bypass Supabase's default row limit
      const PAGE_SIZE = 1000;
      let allMembersData: any[] = [];
      let pageOffset = 0;
      let hasMore = true;

      while (hasMore) {
        let membersQuery = supabase
          .from('members')
          .select(`
            id,
            user_id,
            company:companies!members_company_id_fkey(
              id,
              name,
              association_id,
              employee_count,
              annual_turnover,
              city,
              state,
              country,
              association:associations(id, name)
            )
          `)
          .eq('is_active', true)
          .range(pageOffset, pageOffset + PAGE_SIZE - 1);

        if (currentMember) {
          membersQuery = membersQuery.neq('id', currentMember.id);
        }

        const { data: pageData, error: membersError } = await membersQuery;

        if (membersError) throw membersError;

        if (pageData && pageData.length > 0) {
          allMembersData = allMembersData.concat(pageData);
          pageOffset += PAGE_SIZE;
          hasMore = pageData.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      const membersData = allMembersData;

      console.log('Members query result:', { count: membersData.length });

      // Batch fetch all profiles in chunked queries (to avoid URL length limits)
      const userIds = (membersData || []).map(m => m.user_id);
      const CHUNK_SIZE = 50;
      const profilesById: Record<string, any> = {};

      for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
        const chunk = userIds.slice(i, i + CHUNK_SIZE);
        const { data: profilesChunk } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar, bio')
          .in('id', chunk);

        (profilesChunk || []).forEach(p => {
          profilesById[p.id] = {
            ...p,
            first_name: p.first_name || '',
            last_name: p.last_name || '',
          };
        });
      }

      const membersWithProfiles = (membersData || []).map(member => ({
        ...member,
        profile: profilesById[member.user_id] || { first_name: '', last_name: '', avatar: null, bio: null },
      }));

      // Load existing connections and map status (only if current user has a member record)
      let membersWithStatus: typeof membersWithProfiles & { connectionStatus: Member['connectionStatus'] }[];
      if (currentMember) {
        const { data: connectionsData, error: connectionsError } = await supabase
          .from('connections')
          .select('sender_id, receiver_id, status')
          .or(`sender_id.eq.${currentMember.id},receiver_id.eq.${currentMember.id}`);

        if (connectionsError) throw connectionsError;

        membersWithStatus = membersWithProfiles.map(member => {
          const connection = connectionsData?.find(
            c => c.sender_id === member.id || c.receiver_id === member.id
          );

          let connectionStatus: Member['connectionStatus'] = 'none';
          if (connection && (connection.status === 'accepted' || connection.status === 'pending')) {
            if (connection.status === 'accepted') {
              connectionStatus = 'connected';
            } else if (connection.sender_id === currentMember.id) {
              connectionStatus = 'pending_sent';
            } else {
              connectionStatus = 'pending_received';
            }
          }

          return { ...member, connectionStatus };
        });
      } else {
        // Non-member users (e.g. super admins) can browse but have no connection status
        membersWithStatus = membersWithProfiles.map(member => ({
          ...member,
          connectionStatus: 'none' as Member['connectionStatus'],
        }));
      }

      console.log('Final members with status:', { count: membersWithStatus.length, sample: membersWithStatus[0] });

      setMembers(membersWithStatus);
      setFilteredMembers(membersWithStatus);
    } catch (error: any) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedMember || !currentMemberId) return;

    try {
      setSendingRequest(true);

      // Remove any previously rejected connection before re-sending
      await supabase
        .from('connections')
        .delete()
        .eq('sender_id', currentMemberId)
        .eq('receiver_id', selectedMember.id)
        .eq('status', 'rejected');

      const { error } = await supabase
        .from('connections')
        .insert({
          sender_id: currentMemberId,
          receiver_id: selectedMember.id,
          message: connectionMessage || null,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request sent',
      });

      setSelectedMember(null);
      setConnectionMessage('');
      loadMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send connection request',
        variant: 'destructive',
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const getConnectionButton = (member: Member) => {
    switch (member.connectionStatus) {
      case 'connected':
        return (
          <Badge variant="secondary">
            <Check className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case 'pending_sent':
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'pending_received':
        return (
          <Button size="sm" onClick={() => navigate('/connections')}>
            Respond
          </Button>
        );
      default:
        return (
          <Button size="sm" onClick={() => setSelectedMember(member)}>
            <UserPlus className="w-4 h-4 mr-1" />
            Connect
          </Button>
        );
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to browse members</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b bg-card">
        <div className="container mx-auto py-3 md:py-4 md:pl-20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg md:text-xl font-bold">Browse Members</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <RoleNavigation />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Browse Members</h1>
          <p className="text-muted-foreground">Connect with professionals in your network</p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-10"
                  />
                </div>
                <Button onClick={runSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      {showFilters ? 'Hide' : 'Show'} Advanced Filters
                    </Button>
                  </CollapsibleTrigger>
                  {(selectedAssociation || selectedCompany || minEmployees || maxEmployees || minTurnover || maxTurnover || selectedCity || selectedState || selectedCountry) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  )}
                </div>

                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Association Filter */}
                    <div className="space-y-2">
                      <Label>Association</Label>
                      <Select value={selectedAssociation} onValueChange={setSelectedAssociation}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="All associations" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value=" ">All associations</SelectItem>
                          {associations.map(assoc => (
                            <SelectItem key={assoc.id} value={assoc.id}>
                              {assoc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Company Filter */}
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Select 
                        value={selectedCompany} 
                        onValueChange={setSelectedCompany}
                        disabled={!selectedAssociation && selectedAssociation !== ' '}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="All companies" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value=" ">All companies</SelectItem>
                          {companies
                            .filter(c => !selectedAssociation || selectedAssociation === ' ' || c.association_id === selectedAssociation)
                            .map(company => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* City Filter */}
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        placeholder="Enter city..."
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                      />
                    </div>

                    {/* State Filter */}
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        placeholder="Enter state..."
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                      />
                    </div>

                    {/* Country Filter */}
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Input
                        placeholder="Enter country..."
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Employee Count Range */}
                    <div className="space-y-2">
                      <Label>Number of Employees</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={minEmployees}
                          onChange={(e) => setMinEmployees(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={maxEmployees}
                          onChange={(e) => setMaxEmployees(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                        />
                      </div>
                    </div>

                    {/* Turnover Range */}
                    <div className="space-y-2">
                      <Label>Annual Turnover (₹)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={minTurnover}
                          onChange={(e) => setMinTurnover(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={maxTurnover}
                          onChange={(e) => setMaxTurnover(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={runSearch}>
                      <Search className="h-4 w-4 mr-2" />
                      Apply Filters
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading members...</p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[300px] font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Location</TableHead>
                    <TableHead className="text-right font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <p className="text-muted-foreground">No members available</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                    {filteredMembers.slice(0, MAX_VISIBLE_RESULTS).map(member => {
                      const firstName = member.profile.first_name || '';
                      const lastName = member.profile.last_name || '';
                      const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
                      const initials = `${firstName[0] || '?'}${lastName[0] || '?'}`;

                      return (
                        <TableRow 
                          key={member.id} 
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={member.profile.avatar || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <button
                                  onClick={() => navigate(`/profile/${member.user_id}`)}
                                  className="font-semibold text-base hover:text-primary hover:underline text-left transition-colors"
                                >
                                  {fullName}
                                </button>
                                {member.profile.bio && (
                                  <span className="text-sm text-muted-foreground line-clamp-1 max-w-[250px]">
                                    {member.profile.bio}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {member.company ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="font-medium text-sm">{member.company.name}</span>
                                </div>
                                {member.company.association && (
                                  <span className="text-xs text-muted-foreground pl-6">
                                    {member.company.association.name}
                                  </span>
                                )}
                                {member.company.employee_count && (
                                  <div className="flex items-center gap-1 pl-6 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    <span>{member.company.employee_count} employees</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.company?.city || member.company?.state || member.company?.country ? (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm">
                                  {[
                                    member.company.city,
                                    member.company.state,
                                    member.company.country
                                  ].filter(Boolean).join(', ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {getConnectionButton(member)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredMembers.length > MAX_VISIBLE_RESULTS && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">
                          Showing first {MAX_VISIBLE_RESULTS} of {filteredMembers.length} members. Refine your search or use filters to narrow results.
                        </TableCell>
                      </TableRow>
                    )}
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Connection Request</DialogTitle>
            <DialogDescription>
              Send a connection request to {selectedMember?.profile.first_name} {selectedMember?.profile.last_name}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add a personal message (optional)"
            value={connectionMessage}
            onChange={(e) => setConnectionMessage(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMember(null)}>
              Cancel
            </Button>
            <Button onClick={handleSendRequest} disabled={sendingRequest}>
              {sendingRequest ? 'Sending...' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <MobileNavigation />
    </div>
  );
}
