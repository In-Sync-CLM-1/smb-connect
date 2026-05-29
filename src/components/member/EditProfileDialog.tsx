import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Edit } from 'lucide-react';
import { INDIAN_CITIES } from '@/lib/profileOptions';

interface EditProfileDialogProps {
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    headline: string | null;
    bio: string | null;
    location: string | null;
    phone: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    website_url: string | null;
    employment_status: string | null;
    open_to_work: boolean;
  };
  onSave: () => void;
}

export function EditProfileDialog({ profile, onSave }: EditProfileDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: profile.first_name,
    last_name: profile.last_name,
    headline: profile.headline || '',
    bio: profile.bio || '',
    location: profile.location || '',
    phone: profile.phone || '',
    linkedin_url: profile.linkedin_url || '',
    twitter_url: profile.twitter_url || '',
    website_url: profile.website_url || '',
    employment_status: profile.employment_status || '',
    open_to_work: profile.open_to_work || false,
  });

  // Sync formData when profile changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        first_name: profile.first_name,
        last_name: profile.last_name,
        headline: profile.headline || '',
        bio: profile.bio || '',
        location: profile.location || '',
        phone: profile.phone || '',
        linkedin_url: profile.linkedin_url || '',
        twitter_url: profile.twitter_url || '',
        website_url: profile.website_url || '',
        employment_status: profile.employment_status || '',
        open_to_work: profile.open_to_work || false,
      });
    }
  }, [open, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Updating profile with data:', {
        id: profile.id,
        bio: formData.bio,
        bioLength: formData.bio.length
      });

      const { data, error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          headline: formData.headline || null,
          bio: formData.bio || null,
          location: formData.location || null,
          phone: formData.phone || null,
          linkedin_url: formData.linkedin_url || null,
          twitter_url: formData.twitter_url || null,
          website_url: formData.website_url || null,
          employment_status: formData.employment_status || null,
          open_to_work: formData.open_to_work,
        })
        .eq('id', profile.id)
        .select();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      console.log('Update successful:', data);

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
      setOpen(false);
      onSave();
    } catch (error: any) {
      console.error('Profile update failed:', error);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your profile information</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Professional Headline</Label>
            <Input
              id="headline"
              placeholder="e.g., Senior Software Engineer at Tech Corp"
              value={formData.headline}
              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">
              About
              <span className="text-xs text-muted-foreground ml-2">
                ({formData.bio.length}/500 characters)
              </span>
            </Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setFormData({ ...formData, bio: e.target.value });
                }
              }}
              maxLength={500}
              rows={6}
            />
            {formData.bio.length >= 500 && (
              <p className="text-xs text-destructive">Maximum character limit reached</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employment_status">Employment Status</Label>
            <Select
              value={formData.employment_status}
              onValueChange={(value) => setFormData({ ...formData, employment_status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="currently_working">💼 Currently working</SelectItem>
                <SelectItem value="open_to_opportunities">🟢 Open to opportunities</SelectItem>
                <SelectItem value="actively_looking">🔍 Actively looking</SelectItem>
                <SelectItem value="hiring">📢 Hiring</SelectItem>
                <SelectItem value="not_looking">Not looking</SelectItem>
                <SelectItem value="open_to_consulting">💼 Open to consulting</SelectItem>
                <SelectItem value="available_for_freelance">✨ Available for freelance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="open_to_work"
              checked={formData.open_to_work}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, open_to_work: checked as boolean })
              }
            />
            <Label htmlFor="open_to_work" className="cursor-pointer">
              Show "Open to Work" badge on profile
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Combobox
              options={INDIAN_CITIES}
              value={formData.location}
              onValueChange={(value) => setFormData({ ...formData, location: value })}
              placeholder="Select or type city..."
              searchPlaceholder="Search cities..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn URL</Label>
            <Input
              id="linkedin_url"
              type="url"
              placeholder="https://linkedin.com/in/yourprofile"
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitter_url">Twitter/X URL</Label>
            <Input
              id="twitter_url"
              type="url"
              placeholder="https://twitter.com/yourhandle"
              value={formData.twitter_url}
              onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url">Website</Label>
            <Input
              id="website_url"
              type="url"
              placeholder="https://yourwebsite.com"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}