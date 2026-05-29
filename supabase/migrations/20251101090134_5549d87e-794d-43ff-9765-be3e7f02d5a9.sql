-- Drop the existing foreign key that points to auth.users
ALTER TABLE public.members
DROP CONSTRAINT IF EXISTS members_user_id_fkey;

-- Add new foreign key that points to profiles instead
ALTER TABLE public.members
ADD CONSTRAINT members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;