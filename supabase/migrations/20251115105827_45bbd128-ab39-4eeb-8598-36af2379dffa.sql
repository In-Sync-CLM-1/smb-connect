-- Add revoked_at and revoked_by columns to member_invitations table
ALTER TABLE public.member_invitations 
ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN revoked_by UUID REFERENCES auth.users(id);