import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building, Mail, Phone, Globe, MapPin, Search, Trash2, Download, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface Company {
  id: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  is_active: boolean;
  is_verified: boolean;
  is_default: boolean;
  subscription_tier: string;
  associations: {
    name: string;
  };
}

interface CompaniesListProps {
  onSelectionChange?: (selectedIds: string[]) => void;
  selectedIds?: string[];
}

export function CompaniesList({ onSelectionChange, selectedIds = [] }: CompaniesListProps = {}) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [displayedCompanies, setDisplayedCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteNotes, setDeleteNotes] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [hardDeletingCompany, setHardDeletingCompany] = useState<Company | null>(null);
  const [hardDeletePassword, setHardDeletePassword] = useState('');
  const [hardDeleteNotes, setHardDeleteNotes] = useState('');
  const [isHardDeleting, setIsHardDeleting] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeletePassword, setBulkDeletePassword] = useState('');
  const [bulkDeleteNotes, setBulkDeleteNotes] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    loadCompanies();
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('admin_users')
        .select('is_super_admin')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        setIsSuperAdmin(data.is_super_admin || false);
      }
    } catch (error) {
      console.error('Error checking super admin status:', error);
    }
  };

  useEffect(() => {
    if (searchTerm) {
      const filtered = companies.filter(
        (company) =>
          company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          company.associations?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    } else {
      setFilteredCompanies(companies);
    }
    setPage(1);
  }, [searchTerm, companies]);

  useEffect(() => {
    const startIndex = 0;
    const endIndex = page * ITEMS_PER_PAGE;
    setDisplayedCompanies(filteredCompanies.slice(startIndex, endIndex));
    setHasMore(endIndex < filteredCompanies.length);
  }, [page, filteredCompanies]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
    }
  }, [hasMore, loading]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loadMore]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          associations (
            name
          )
        `)
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
      setFilteredCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (company: Company) => {
    if (!deletePassword.trim() || !deleteNotes.trim()) {
      toast.error('Password and notes are required');
      return;
    }

    setIsVerifying(true);
    try {
      // Re-authenticate user
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user?.email) {
        toast.error('User email not found');
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword
      });

      if (authError) {
        toast.error('Invalid password. Deletion cancelled.');
        setIsVerifying(false);
        return;
      }

      // Proceed with deletion
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      // Log the deletion for audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'delete',
        resource: 'company',
        resource_id: company.id,
        changes: { 
          deleted_company: company.name,
          deletion_notes: deleteNotes 
        }
      });

      toast.success('Company deleted successfully');
      setDeletingCompany(null);
      setDeletePassword('');
      setDeleteNotes('');
      loadCompanies();
    } catch (error: any) {
      console.error('Error deleting company:', error);
      toast.error(error.message || 'Failed to delete company');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleHardDelete = async (company: Company) => {
    if (!hardDeletePassword.trim() || !hardDeleteNotes.trim()) {
      toast.error('Password and notes are required');
      return;
    }

    setIsHardDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No active session');
        return;
      }

      const { data, error } = await supabase.functions.invoke('hard-delete-companies', {
        body: {
          companyIds: [company.id],
          password: hardDeletePassword,
          notes: hardDeleteNotes
        }
      });

      if (error) throw error;

      if (data.failed > 0) {
        toast.error(`Failed to hard delete company: ${data.errors?.[0] || 'Unknown error'}`);
      } else {
        toast.success('Company permanently deleted');
        setHardDeletingCompany(null);
        setHardDeletePassword('');
        setHardDeleteNotes('');
        setSelectedCompanies(new Set());
        await loadCompanies();
      }
    } catch (error: any) {
      console.error('Error hard deleting company:', error);
      toast.error(error.message || 'Failed to hard delete company');
    } finally {
      setIsHardDeleting(false);
    }
  };

  const toggleCompanySelection = (companyId: string) => {
    const newSelection = new Set(selectedCompanies);
    if (newSelection.has(companyId)) {
      newSelection.delete(companyId);
    } else {
      newSelection.add(companyId);
    }
    setSelectedCompanies(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  };

  const toggleSelectAll = () => {
    const newSelection = selectedCompanies.size === displayedCompanies.length 
      ? new Set<string>() 
      : new Set(displayedCompanies.map(c => c.id));
    setSelectedCompanies(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  };

  const handleBulkHardDelete = async () => {
    if (!bulkDeletePassword.trim() || !bulkDeleteNotes.trim()) {
      toast.error('Password and notes are required');
      return;
    }

    setIsBulkDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No active session');
        return;
      }

      const { data, error } = await supabase.functions.invoke('hard-delete-companies', {
        body: {
          companyIds: Array.from(selectedCompanies),
          password: bulkDeletePassword,
          notes: bulkDeleteNotes
        }
      });

      if (error) throw error;

      if (data.failed > 0) {
        toast.error(`${data.success} deleted, ${data.failed} failed`);
      } else {
        toast.success(`${data.success} companies permanently deleted`);
      }
      
      setShowBulkDelete(false);
      setBulkDeletePassword('');
      setBulkDeleteNotes('');
      setSelectedCompanies(new Set());
      await loadCompanies();
    } catch (error: any) {
      console.error('Error bulk deleting companies:', error);
      toast.error(error.message || 'Failed to bulk delete companies');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Company Name', 'Association', 'Email', 'Phone', 'Website', 'City', 'State', 'Status', 'Verified'];
    const csvData = filteredCompanies.map(company => [
      company.name,
      company.associations?.name || '',
      company.email || '',
      company.phone || '',
      company.website || '',
      company.city || '',
      company.state || '',
      company.is_active ? 'Active' : 'Inactive',
      company.is_verified ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `companies_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Companies exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Companies</h2>
          <p className="text-muted-foreground">
            {filteredCompanies.length} of {companies.length} companies
            {selectedCompanies.size > 0 && ` • ${selectedCompanies.size} selected`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            {isSuperAdmin && selectedCompanies.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowBulkDelete(true)}
              >
                <Trash2 className="h-4 w-4 mr-2 fill-current" />
                Hard Delete ({selectedCompanies.size})
              </Button>
            )}
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={exportToCSV}
              title="Export to CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedCompanies.map((company) => (
            <Card 
              key={company.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/admin/companies/${company.id}`)}
            >
              <CardHeader>
              <div className="flex items-start justify-between">
                <Building className="h-8 w-8 text-primary" />
                <div className="flex gap-1 items-center">
                  <Badge variant={company.is_active ? 'default' : 'secondary'}>
                    {company.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {company.is_verified && (
                    <Badge variant="outline">Verified</Badge>
                  )}
                  {isSuperAdmin && (
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingCompany(company);
                        }}
                        title="Soft Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHardDeletingCompany(company);
                        }}
                        title="Hard Delete (Permanent)"
                      >
                        <Trash2 className="h-4 w-4 text-destructive fill-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <CardTitle className="mt-2">
                {company.name}
                {company.is_default && (
                  <Badge variant="outline" className="ml-2 text-xs">Default</Badge>
                )}
              </CardTitle>
              <CardDescription>
                <Badge variant="secondary" className="mt-1">
                  {company.associations?.name}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {company.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {company.description}
                </p>
              )}
              {company.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{company.email}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{company.phone}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {company.website}
                  </a>
                </div>
              )}
              {company.city && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {company.city}
                    {company.state && `, ${company.state}`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {isSuperAdmin && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedCompanies.size === displayedCompanies.length && displayedCompanies.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </TableHead>
                )}
                <TableHead>Company</TableHead>
                <TableHead>Association</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedCompanies.map((company) => (
                <TableRow 
                  key={company.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/admin/companies/${company.id}`)}
                >
                  {isSuperAdmin && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCompanies.has(company.id)}
                        onChange={() => toggleCompanySelection(company.id)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {company.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {company.associations?.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{company.email}</TableCell>
                  <TableCell>{company.phone}</TableCell>
                  <TableCell>
                    {company.city}
                    {company.state && `, ${company.state}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant={company.is_active ? 'default' : 'secondary'}>
                        {company.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {company.is_verified && (
                        <Badge variant="outline">Verified</Badge>
                      )}
                    </div>
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingCompany(company);
                          }}
                          title="Soft Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHardDeletingCompany(company);
                          }}
                          title="Hard Delete (Permanent)"
                        >
                          <Trash2 className="h-4 w-4 text-destructive fill-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      <AlertDialog open={!!deletingCompany} onOpenChange={(open) => {
        if (!open) {
          setDeletingCompany(null);
          setDeletePassword('');
          setDeleteNotes('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company - Re-authentication Required</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete "{deletingCompany?.name}". This action cannot be undone and will also delete all associated members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-notes">Reason for Deletion *</Label>
              <Textarea
                id="delete-notes"
                placeholder="Explain why this company needs to be deleted..."
                value={deleteNotes}
                onChange={(e) => setDeleteNotes(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Confirm Your Password *</Label>
              <Input
                id="delete-password"
                type="password"
                placeholder="Enter your password to confirm"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Re-enter your password to verify this critical action
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => deletingCompany && handleDelete(deletingCompany)}
              disabled={!deletePassword.trim() || !deleteNotes.trim() || isVerifying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isVerifying ? 'Verifying...' : 'Delete Company'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDelete} onOpenChange={(open) => {
        if (!open) {
          setShowBulkDelete(false);
          setBulkDeletePassword('');
          setBulkDeleteNotes('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ BULK HARD DELETE - PERMANENT DELETION</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to PERMANENTLY delete {selectedCompanies.size} companies and ALL their associated data including members, admins, and records. This action CANNOT be undone and the data CANNOT be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-delete-notes">Reason for Permanent Deletion *</Label>
              <Textarea
                id="bulk-delete-notes"
                placeholder="Explain why these companies need to be permanently deleted..."
                value={bulkDeleteNotes}
                onChange={(e) => setBulkDeleteNotes(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-delete-password">Confirm Your Password *</Label>
              <Input
                id="bulk-delete-password"
                type="password"
                placeholder="Enter your password to confirm"
                value={bulkDeletePassword}
                onChange={(e) => setBulkDeletePassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Re-enter your password to verify this PERMANENT action
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleBulkHardDelete}
              disabled={!bulkDeletePassword.trim() || !bulkDeleteNotes.trim() || isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? 'Permanently Deleting...' : `PERMANENTLY DELETE ${selectedCompanies.size} COMPANIES`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hardDeletingCompany} onOpenChange={(open) => {
        if (!open) {
          setHardDeletingCompany(null);
          setHardDeletePassword('');
          setHardDeleteNotes('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ HARD DELETE - PERMANENT DELETION</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to PERMANENTLY delete "{hardDeletingCompany?.name}" and ALL associated data including members, admins, and records. This action CANNOT be undone and the data CANNOT be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hard-delete-notes">Reason for Permanent Deletion *</Label>
              <Textarea
                id="hard-delete-notes"
                placeholder="Explain why this company needs to be permanently deleted..."
                value={hardDeleteNotes}
                onChange={(e) => setHardDeleteNotes(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hard-delete-password">Confirm Your Password *</Label>
              <Input
                id="hard-delete-password"
                type="password"
                placeholder="Enter your password to confirm"
                value={hardDeletePassword}
                onChange={(e) => setHardDeletePassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Re-enter your password to verify this PERMANENT action
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => hardDeletingCompany && handleHardDelete(hardDeletingCompany)}
              disabled={!hardDeletePassword.trim() || !hardDeleteNotes.trim() || isHardDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isHardDeleting ? 'Permanently Deleting...' : 'PERMANENTLY DELETE'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
