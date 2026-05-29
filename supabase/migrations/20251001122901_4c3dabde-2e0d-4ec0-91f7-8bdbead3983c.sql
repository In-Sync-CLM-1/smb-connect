-- ============================================
-- Phase 1, Step 1.3: Fix Chat Participants Infinite Recursion
-- ============================================

-- Create security definer function to check if user is a chat participant
-- This bypasses RLS and prevents infinite recursion
CREATE OR REPLACE FUNCTION public.is_chat_participant(check_user_id uuid, check_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_participants cp
    JOIN members m ON m.company_id = cp.company_id
    WHERE cp.chat_id = check_chat_id
    AND m.user_id = check_user_id
    AND m.is_active = true
  );
$$;

-- Create security definer function to check if user can add participants to a chat
CREATE OR REPLACE FUNCTION public.can_add_chat_participant(check_user_id uuid, check_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_participants cp
    JOIN members m ON m.company_id = cp.company_id
    WHERE cp.chat_id = check_chat_id
    AND m.user_id = check_user_id
    AND m.is_active = true
  );
$$;

-- Drop existing problematic policies on chat_participants
DROP POLICY IF EXISTS "Users can view chat participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can add chat participants" ON public.chat_participants;

-- Create new non-recursive policies for chat_participants
CREATE POLICY "Users can view chat participants"
ON public.chat_participants
FOR SELECT
USING (is_chat_participant(auth.uid(), chat_id));

CREATE POLICY "Users can add chat participants"
ON public.chat_participants
FOR INSERT
WITH CHECK (can_add_chat_participant(auth.uid(), chat_id));

-- Also fix the chats table policies that reference chat_participants
DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can update their chats" ON public.chats;

-- Create new non-recursive policies for chats table
CREATE POLICY "Users can view their chats"
ON public.chats
FOR SELECT
USING (is_chat_participant(auth.uid(), id));

CREATE POLICY "Users can update their chats"
ON public.chats
FOR UPDATE
USING (is_chat_participant(auth.uid(), id));

-- Add helpful comments
COMMENT ON FUNCTION public.is_chat_participant(uuid, uuid) 
IS 'Security definer function to check chat participation. Prevents infinite recursion in RLS policies.';

COMMENT ON POLICY "Users can view chat participants" ON public.chat_participants
IS 'Uses security definer function to prevent infinite recursion when checking chat membership.';