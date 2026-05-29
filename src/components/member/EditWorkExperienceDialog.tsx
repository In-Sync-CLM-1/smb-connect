import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { JOB_TITLES, INDIAN_CITIES } from '@/lib/profileOptions';

interface EditWorkExperienceDialogProps {
  onSave: () => void;
}

export function EditWorkExperienceDialog({ onSave }: EditWorkExperienceDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    title: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('work_experience').insert({
        user_id: user.id,
        company: formData.company,
        title: formData.title,
        location: formData.location || null,
        start_date: formData.start_date,
        end_date: formData.is_current ? null : formData.end_date || null,
        is_current: formData.is_current,
        description: formData.description || null,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Work experience added',
      });
      setOpen(false);
      setFormData({
        company: '',
        title: '',
        location: '',
        start_date: '',
        end_date: '',
        is_current: false,
        description: '',
      });
      onSave();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to add work experience',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Work Experience</DialogTitle>
          <DialogDescription>Add a new position to your work history</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Combobox
              options={JOB_TITLES}
              value={formData.title}
              onValueChange={(value) => setFormData({ ...formData, title: value })}
              placeholder="Select or type job title..."
              searchPlaceholder="Search titles..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              placeholder="e.g., Tech Corp"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              required
            />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                disabled={formData.is_current}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_current"
              checked={formData.is_current}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_current: checked as boolean })
              }
            />
            <Label htmlFor="is_current" className="cursor-pointer">
              I currently work here
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your responsibilities and achievements..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Experience'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}