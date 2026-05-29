import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseImageUploadOptions {
  bucket?: string;
  pathPrefix?: string;
}

export function useImageUpload(
  quillRef: React.RefObject<any>,
  options: UseImageUploadOptions = {}
) {
  const { bucket = 'email-images', pathPrefix = '' } = options;
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { validateImageUpload } = await import('@/lib/uploadValidation');
    const validation = await validateImageUpload(file);

    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const quill = quillRef.current?.getEditor();
      if (quill) {
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', publicUrl);
        quill.setSelection(range.index + 1);
      }

      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });

      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  }, [bucket, pathPrefix, quillRef, toast]);

  return { imageInputRef, uploadingImage, handleImageUpload };
}
