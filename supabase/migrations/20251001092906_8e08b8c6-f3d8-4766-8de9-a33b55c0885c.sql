-- Phase 1: Member Independence & Auto-Registration

-- 1. Make company_id nullable in members table (allow members without companies)
ALTER TABLE public.members 
ALTER COLUMN company_id DROP NOT NULL;

-- 2. Update the handle_new_user trigger to auto-create member record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  
  -- Auto-create member record with 'member' role
  INSERT INTO public.members (user_id, role, company_id)
  VALUES (NEW.id, 'member', NULL);
  
  RETURN NEW;
END;
$$;

-- 3. Update RLS policies for independent members

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view their own member record" ON public.members;
DROP POLICY IF EXISTS "Users can create member records" ON public.members;

-- Allow users to view their own member record
CREATE POLICY "Users can view their own member record"
ON public.members
FOR SELECT
USING (user_id = auth.uid());

-- Allow users to update their own member record
CREATE POLICY "Users can update their own member record"
ON public.members
FOR UPDATE
USING (user_id = auth.uid());

-- System can create member records (for the trigger)
CREATE POLICY "System can create member records"
ON public.members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Add index for better query performance on user_id
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);