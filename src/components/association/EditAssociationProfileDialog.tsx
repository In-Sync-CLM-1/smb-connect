import { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  contact_email: z.string().email('Invalid email address'),
  contact_phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  postal_code: z.string().optional(),
  founded_year: z.string().optional(),
  industry: z.string().optional(),
  keywords: z.string().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  facebook: z.string().optional(),
  instagram: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface EditAssociationProfileDialogProps {
  association: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAssociationProfileDialog({ 
  association, 
  open, 
  onOpenChange, 
  onSuccess 
}: EditAssociationProfileDialogProps) {
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(association.logo || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(association.cover_image || null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const socialLinks = association.social_links || {};

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Logo must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Cover image must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File, type: 'logo' | 'cover'): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const bucket = type === 'logo' ? 'association-logos' : 'profile-images';
      
      // Cover uploads use user-scoped folders. Association logos use a dedicated bucket.
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast({
        title: 'Upload failed',
        description: `Failed to upload ${type}. Please try again.`,
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: association.name,
      description: association.description || '',
      contact_email: association.contact_email,
      contact_phone: association.contact_phone || '',
      website: association.website || '',
      address: association.address || '',
      city: association.city || '',
      state: association.state || '',
      country: association.country || 'India',
      postal_code: association.postal_code || '',
      founded_year: association.founded_year?.toString() || '',
      industry: association.industry || undefined,
      keywords: association.keywords?.join(', ') || '',
      linkedin: socialLinks.linkedin || '',
      twitter: socialLinks.twitter || '',
      facebook: socialLinks.facebook || '',
      instagram: socialLinks.instagram || '',
    },
  });

  useEffect(() => {
    if (!open) return;

    setLogoFile(null);
    setCoverFile(null);
    setLogoPreview(association.logo || null);
    setCoverPreview(association.cover_image || null);
    reset({
      name: association.name,
      description: association.description || '',
      contact_email: association.contact_email,
      contact_phone: association.contact_phone || '',
      website: association.website || '',
      address: association.address || '',
      city: association.city || '',
      state: association.state || '',
      country: association.country || 'India',
      postal_code: association.postal_code || '',
      founded_year: association.founded_year?.toString() || '',
      industry: association.industry || undefined,
      keywords: association.keywords?.join(', ') || '',
      linkedin: socialLinks.linkedin || '',
      twitter: socialLinks.twitter || '',
      facebook: socialLinks.facebook || '',
      instagram: socialLinks.instagram || '',
    });
  }, [open, association, reset, socialLinks.linkedin, socialLinks.twitter, socialLinks.facebook, socialLinks.instagram]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setLoading(true);

      const updates: Record<string, unknown> = {};

      if (logoFile) {
        const uploadedUrl = await uploadImage(logoFile, 'logo');
        if (uploadedUrl) {
          updates.logo = uploadedUrl;
        } else {
          setLoading(false);
          return;
        }
      }

      if (coverFile) {
        const uploadedUrl = await uploadImage(coverFile, 'cover');
        if (uploadedUrl) {
          updates.cover_image = uploadedUrl;
        } else {
          setLoading(false);
          return;
        }
      }

      // Parse keywords from comma-separated string
      const keywordsArray = data.keywords
        ? data.keywords.split(',').map(k => k.trim()).filter(k => k)
        : [];

      // Build social links object
      const socialLinksObj: any = {};
      if (data.linkedin) socialLinksObj.linkedin = data.linkedin;
      if (data.twitter) socialLinksObj.twitter = data.twitter;
      if (data.facebook) socialLinksObj.facebook = data.facebook;
      if (data.instagram) socialLinksObj.instagram = data.instagram;

      const nextDescription = data.description || '';
      const nextContactPhone = data.contact_phone || '';
      const nextWebsite = data.website || '';
      const nextAddress = data.address || '';
      const nextCity = data.city || '';
      const nextState = data.state || '';
      const nextCountry = data.country || 'India';
      const nextPostalCode = data.postal_code || '';
      const nextFoundedYear = data.founded_year ? parseInt(data.founded_year) : null;
      const nextIndustry = data.industry || null;
      const currentSocialLinks = association.social_links || {};

      if (data.name !== association.name) updates.name = data.name;
      if (nextDescription !== (association.description || '')) updates.description = nextDescription;
      if (data.contact_email !== association.contact_email) updates.contact_email = data.contact_email;
      if (nextContactPhone !== (association.contact_phone || '')) updates.contact_phone = nextContactPhone;
      if (nextWebsite !== (association.website || '')) updates.website = nextWebsite;
      if (nextAddress !== (association.address || '')) updates.address = nextAddress;
      if (nextCity !== (association.city || '')) updates.city = nextCity;
      if (nextState !== (association.state || '')) updates.state = nextState;
      if (nextCountry !== (association.country || 'India')) updates.country = nextCountry;
      if (nextPostalCode !== (association.postal_code || '')) updates.postal_code = nextPostalCode;
      if (nextFoundedYear !== (association.founded_year ?? null)) updates.founded_year = nextFoundedYear;
      if (nextIndustry !== (association.industry || null)) updates.industry = nextIndustry;
      if (JSON.stringify(keywordsArray) !== JSON.stringify(association.keywords || [])) updates.keywords = keywordsArray;
      if (JSON.stringify(socialLinksObj) !== JSON.stringify(currentSocialLinks)) updates.social_links = socialLinksObj;

      if (Object.keys(updates).length === 0) {
        setLogoFile(null);
        setCoverFile(null);
        onOpenChange(false);
        return;
      }

      const { error } = await supabase
        .from('associations')
        .update(updates as any)
        .eq('id', association.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
      setLogoFile(null);
      setCoverFile(null);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Association Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="social">Social & Keywords</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {/* Cover Image Upload */}
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <p className="text-xs text-muted-foreground mb-2">Recommended: 1200 x 300 pixels (4:1 ratio)</p>
                <div 
                  className="relative h-32 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-lg overflow-hidden group cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                        <span className="text-sm">Click to upload cover image</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  className="hidden"
                />
                {coverFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      setCoverFile(null);
                      setCoverPreview(association.cover_image || null);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" /> Remove new cover
                  </Button>
                )}
              </div>

              {/* Logo Upload */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="w-20 h-20 border-2 border-muted">
                    <AvatarImage src={logoPreview || undefined} />
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                      {association.name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={loading}
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <Label>Logo</Label>
                  <p className="text-xs text-muted-foreground">Recommended: 200 x 200 pixels (1:1 ratio, max 5MB)</p>
                  {logoFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-destructive"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(association.logo || null);
                      }}
                    >
                      <X className="w-3 h-3 mr-1" /> Remove new logo
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="name">Name *</Label>
                <Input {...register('name')} id="name" disabled={loading} />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea {...register('description')} id="description" disabled={loading} rows={4} />
              </div>

              <div>
                <Label htmlFor="founded_year">Founded Year</Label>
                <Input {...register('founded_year')} id="founded_year" type="number" placeholder="2020" disabled={loading} />
              </div>

              <div>
                <Label htmlFor="industry">Industry</Label>
                <Controller
                  name="industry"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={loading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Agriculture & Allied Activities">Agriculture & Allied Activities</SelectItem>
                        <SelectItem value="Automobile & Auto Components">Automobile & Auto Components</SelectItem>
                        <SelectItem value="Aviation">Aviation</SelectItem>
                        <SelectItem value="Banking, Financial Services & Insurance (BFSI)">Banking, Financial Services & Insurance (BFSI)</SelectItem>
                        <SelectItem value="Biotechnology & Life Sciences">Biotechnology & Life Sciences</SelectItem>
                        <SelectItem value="Chemicals & Petrochemicals">Chemicals & Petrochemicals</SelectItem>
                        <SelectItem value="Construction & Real Estate">Construction & Real Estate</SelectItem>
                        <SelectItem value="Consumer Goods (FMCG & Consumer Durables)">Consumer Goods (FMCG & Consumer Durables)</SelectItem>
                        <SelectItem value="Defence & Aerospace">Defence & Aerospace</SelectItem>
                        <SelectItem value="Education & EdTech">Education & EdTech</SelectItem>
                        <SelectItem value="Electronics & Electricals">Electronics & Electricals</SelectItem>
                        <SelectItem value="Energy (Oil, Gas, Power, Renewables)">Energy (Oil, Gas, Power, Renewables)</SelectItem>
                        <SelectItem value="Engineering & Capital Goods">Engineering & Capital Goods</SelectItem>
                        <SelectItem value="Environmental Services & Waste Management">Environmental Services & Waste Management</SelectItem>
                        <SelectItem value="Food Processing & Beverages">Food Processing & Beverages</SelectItem>
                        <SelectItem value="Healthcare & Pharmaceuticals">Healthcare & Pharmaceuticals</SelectItem>
                        <SelectItem value="Hospitality & Tourism">Hospitality & Tourism</SelectItem>
                        <SelectItem value="Information Technology (IT) & ITES">Information Technology (IT) & ITES</SelectItem>
                        <SelectItem value="Infrastructure & Logistics">Infrastructure & Logistics</SelectItem>
                        <SelectItem value="Legal & Professional Services">Legal & Professional Services</SelectItem>
                        <SelectItem value="Manufacturing (General)">Manufacturing (General)</SelectItem>
                        <SelectItem value="Media, Entertainment & Publishing">Media, Entertainment & Publishing</SelectItem>
                        <SelectItem value="Metals & Mining">Metals & Mining</SelectItem>
                        <SelectItem value="Public Sector & Government">Public Sector & Government</SelectItem>
                        <SelectItem value="Retail & E-commerce">Retail & E-commerce</SelectItem>
                        <SelectItem value="Telecommunications">Telecommunications</SelectItem>
                        <SelectItem value="Textiles & Apparel">Textiles & Apparel</SelectItem>
                        <SelectItem value="Transport & Mobility">Transport & Mobility</SelectItem>
                        <SelectItem value="Water & Sanitation">Water & Sanitation</SelectItem>
                        <SelectItem value="Non-Profit & Social Enterprises">Non-Profit & Social Enterprises</SelectItem>
                        <SelectItem value="Startups & Emerging Businesses">Startups & Emerging Businesses</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input {...register('keywords')} id="keywords" placeholder="industry, technology, innovation" disabled={loading} />
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <Input {...register('contact_email')} id="contact_email" type="email" disabled={loading} />
                  {errors.contact_email && (
                    <p className="text-sm text-destructive mt-1">{errors.contact_email.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input {...register('contact_phone')} id="contact_phone" type="tel" disabled={loading} />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input {...register('website')} id="website" type="url" placeholder="https://" disabled={loading} />
                {errors.website && (
                  <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
                )}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input {...register('country')} id="country" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input {...register('postal_code')} id="postal_code" disabled={loading} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              <div>
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input {...register('linkedin')} id="linkedin" placeholder="https://linkedin.com/company/..." disabled={loading} />
              </div>

              <div>
                <Label htmlFor="twitter">Twitter/X</Label>
                <Input {...register('twitter')} id="twitter" placeholder="https://twitter.com/..." disabled={loading} />
              </div>

              <div>
                <Label htmlFor="facebook">Facebook</Label>
                <Input {...register('facebook')} id="facebook" placeholder="https://facebook.com/..." disabled={loading} />
              </div>

              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input {...register('instagram')} id="instagram" placeholder="https://instagram.com/..." disabled={loading} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
