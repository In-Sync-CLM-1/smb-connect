import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const companySchema = z.object({
  association_id: z.string().min(1, 'Association is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  postal_code: z.string().optional(),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  business_type: z.string().optional(),
  industry_type: z.string().optional(),
  employee_count: z.string().optional(),
  annual_turnover: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

export default function CreateCompany() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [associations, setAssociations] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      country: 'India',
    },
  });

  useEffect(() => {
    loadAssociations();
  }, []);

  const loadAssociations = async () => {
    try {
      const { data, error } = await supabase
        .from('associations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAssociations(data || []);
    } catch (error: any) {
      console.error('Error loading associations:', error);
    }
  };

  const onSubmit = async (data: CompanyFormData) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('companies')
        .insert([{
          association_id: data.association_id || null,
          name: data.name,
          description: data.description,
          email: data.email,
          phone: data.phone,
          website: data.website,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          postal_code: data.postal_code,
          gst_number: data.gst_number,
          pan_number: data.pan_number,
          business_type: data.business_type,
          industry_type: data.industry_type,
          employee_count: data.employee_count ? parseInt(data.employee_count) : null,
          annual_turnover: data.annual_turnover ? parseFloat(data.annual_turnover) : null,
          is_active: true,
          is_verified: false,
        }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company created successfully',
      });
      navigate('/admin/companies');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create company',
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
            onClick={() => navigate('/admin/companies')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Companies
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pl-20 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create New Company</CardTitle>
            <CardDescription>Add a new company to an association</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="association_id">Association *</Label>
                <Select onValueChange={(value) => setValue('association_id', value)} disabled={loading}>
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
                {errors.association_id && (
                  <p className="text-sm text-destructive mt-1">{errors.association_id.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="name">Company Name *</Label>
                <Input {...register('name')} id="name" disabled={loading} />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea {...register('description')} id="description" disabled={loading} rows={3} />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_type">Business Type</Label>
                  <Input {...register('business_type')} id="business_type" placeholder="Retail, Manufacturing, etc." disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="industry_type">Industry Type</Label>
                  <Input {...register('industry_type')} id="industry_type" placeholder="Technology, Healthcare, etc." disabled={loading} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee_count">Number of Employees</Label>
                  <Input {...register('employee_count')} id="employee_count" type="number" placeholder="e.g., 50" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="annual_turnover">Annual Turnover (₹)</Label>
                  <Input {...register('annual_turnover')} id="annual_turnover" type="number" step="0.01" placeholder="e.g., 10000000" disabled={loading} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input {...register('gst_number')} id="gst_number" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input {...register('pan_number')} id="pan_number" disabled={loading} />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input {...register('website')} id="website" type="url" placeholder="https://" disabled={loading} />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input {...register('address')} id="address" disabled={loading} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input {...register('city')} id="city" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input {...register('state')} id="state" disabled={loading} />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Company'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/admin/companies')}>
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
