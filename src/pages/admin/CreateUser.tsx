import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, Key, Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const userSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'association', 'company', 'member']),
  organization_id: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface Association {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  association_id?: string;
  is_default?: boolean;
}

export default function CreateUser() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [creationMethod, setCreationMethod] = useState<'invitation' | 'manual'>('invitation');
  const [password, setPassword] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'member',
    },
  });

  const selectedRole = watch('role');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const [associationsRes, companiesRes] = await Promise.all([
        supabase.from('associations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('companies').select('id, name, association_id, is_default').eq('is_active', true).order('name'),
      ]);

      if (associationsRes.data) setAssociations(associationsRes.data);
      if (companiesRes.data) {
        // Sort companies to put default ones first
        const sortedCompanies = companiesRes.data.sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return a.name.localeCompare(b.name);
        });
        setCompanies(sortedCompanies);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const onSubmit = async (data: UserFormData) => {
    try {
      setLoading(true);

      // For member/company roles, organization is required
      if ((data.role === 'company' || data.role === 'member') && !data.organization_id) {
        toast({
          title: 'Error',
          description: 'Please select a company',
          variant: 'destructive',
        });
        return;
      }

      // For association role, organization is required
      if (data.role === 'association' && !data.organization_id) {
        toast({
          title: 'Error',
          description: 'Please select an association',
          variant: 'destructive',
        });
        return;
      }

      if (creationMethod === 'invitation') {
        // Use the member invitation system
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          throw new Error('Not authenticated');
        }

        const invitationData: any = {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          role: data.role === 'company' ? 'admin' : data.role === 'association' ? 'manager' : data.role,
          organization_type: data.role === 'association' ? 'association' : 'company',
          organization_id: data.organization_id || null,
          designation: data.designation || null,
          department: data.department || null,
        };

        // For admin role, we'll handle it differently
        if (data.role === 'admin') {
          // Create user directly for admin role
          const { data: result, error } = await supabase.functions.invoke('create-member-invitation', {
            body: {
              ...invitationData,
              organization_type: 'company',
              organization_id: companies[0]?.id, // Use first company as placeholder
              role: 'admin',
            },
          });

          if (error) throw error;
        } else {
          const { data: result, error } = await supabase.functions.invoke('create-member-invitation', {
            body: invitationData,
          });

          if (error) throw error;
        }

        toast({
          title: 'Invitation Sent',
          description: `An invitation email has been sent to ${data.email}`,
        });
      } else {
        // Manual password creation - would need admin SDK on backend
        toast({
          title: 'Info',
          description: 'Manual user creation requires backend implementation. Using invitation method instead.',
          variant: 'destructive',
        });
        return;
      }

      navigate('/admin/users');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 pl-20">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/users')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pl-20 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
            <CardDescription>Add a new user to the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input {...register('first_name')} id="first_name" disabled={loading} />
                    {errors.first_name && (
                      <p className="text-sm text-destructive mt-1">{errors.first_name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input {...register('last_name')} id="last_name" disabled={loading} />
                    {errors.last_name && (
                      <p className="text-sm text-destructive mt-1">{errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input {...register('email')} id="email" type="email" disabled={loading} />
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input {...register('phone')} id="phone" type="tel" disabled={loading} />
                  </div>
                </div>
              </div>

              {/* Role Assignment */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Role Assignment</h3>
                
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value: any) => {
                      setValue('role', value);
                      setValue('organization_id', '');
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Platform Admin</SelectItem>
                      <SelectItem value="association">Association Manager</SelectItem>
                      <SelectItem value="company">Company Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Association selector for association managers */}
                {selectedRole === 'association' && (
                  <div>
                    <Label htmlFor="organization_id">Association *</Label>
                    <Select
                      onValueChange={(value) => setValue('organization_id', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select association" />
                      </SelectTrigger>
                      <SelectContent>
                        {associations.map((assoc) => (
                          <SelectItem key={assoc.id} value={assoc.id}>
                            {assoc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Company selector for company admins and members */}
                {(selectedRole === 'company' || selectedRole === 'member') && (
                  <div>
                    <Label htmlFor="organization_id">Company *</Label>
                    <Select
                      onValueChange={(value) => setValue('organization_id', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                            {company.is_default && (
                              <span className="text-muted-foreground text-xs ml-2">(Default)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Additional fields for company roles */}
                {(selectedRole === 'company' || selectedRole === 'member') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="designation">Designation</Label>
                      <Input {...register('designation')} id="designation" placeholder="e.g., Manager" disabled={loading} />
                    </div>
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input {...register('department')} id="department" placeholder="e.g., Sales" disabled={loading} />
                    </div>
                  </div>
                )}
              </div>

              {/* Creation Method */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Account Setup</h3>
                
                <RadioGroup
                  value={creationMethod}
                  onValueChange={(value: 'invitation' | 'manual') => setCreationMethod(value)}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="invitation" id="invitation" />
                    <Label htmlFor="invitation" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Send Invitation Email</p>
                        <p className="text-sm text-muted-foreground">User will receive an email to set up their password</p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 opacity-50">
                    <RadioGroupItem value="manual" id="manual" disabled />
                    <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Set Password Manually</p>
                        <p className="text-sm text-muted-foreground">Create account with a temporary password (Coming soon)</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/admin/users')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
