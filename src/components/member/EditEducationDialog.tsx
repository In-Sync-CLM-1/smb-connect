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
import { Combobox } from '@/components/ui/combobox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil } from 'lucide-react';
import { DEGREES, FIELDS_OF_STUDY } from '@/lib/profileOptions';

interface EducationData {
  id: string;
  school: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  grade?: string | null;
  description: string | null;
}

interface EditEducationDialogProps {
  onSave: () => void;
  education?: EducationData;
  trigger?: React.ReactNode;
}

const emptyForm = {
  school: '',
  degree: '',
  field_of_study: '',
  start_date: '',
  end_date: '',
  grade: '',
  description: '',
};

export function EditEducationDialog({ onSave, education, trigger }: EditEducationDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const isEditMode = !!education;

  useEffect(() => {
    if (open && education) {
      setFormData({
        school: education.school || '',
        degree: education.degree || '',
        field_of_study: education.field_of_study || '',
        start_date: education.start_date || '',
        end_date: education.end_date || '',
        grade: education.grade || '',
        description: education.description || '',
      });
    } else if (open && !education) {
      setFormData(emptyForm);
    }
  }, [open, education]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      const payload = {
        school: formData.school,
        degree: formData.degree || null,
        field_of_study: formData.field_of_study || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        grade: formData.grade || null,
        description: formData.description || null,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('education')
          .update(payload)
          .eq('id', education.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('education').insert({
          user_id: user.id,
          ...payload,
        });
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: isEditMode ? 'Education updated' : 'Education added',
      });
      setOpen(false);
      onSave();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: isEditMode ? 'Failed to update education' : 'Failed to add education',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Education' : 'Add Education'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update your educational background' : 'Add your educational background'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="school">School *</Label>
            <Input
              id="school"
              placeholder="e.g., Stanford University"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="degree">Degree</Label>
            <Combobox
              options={DEGREES}
              value={formData.degree}
              onValueChange={(value) => setFormData({ ...formData, degree: value })}
              placeholder="Select or type degree..."
              searchPlaceholder="Search degrees..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field_of_study">Field of Study</Label>
            <Combobox
              options={FIELDS_OF_STUDY}
              value={formData.field_of_study}
              onValueChange={(value) => setFormData({ ...formData, field_of_study: value })}
              placeholder="Select or type field of study..."
              searchPlaceholder="Search fields..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">Grade</Label>
            <Input
              id="grade"
              placeholder="e.g., 3.8 GPA"
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Activities, achievements, coursework..."
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
              {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Education' : 'Add Education')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
