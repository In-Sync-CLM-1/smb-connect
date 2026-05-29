-- Add accepted_by column to member_invitations table
ALTER TABLE public.member_invitations 
ADD COLUMN accepted_by UUID REFERENCES auth.users(id);