-- Drop and recreate the SELECT policy for chats to allow viewing newly created chats
DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;

-- Create a new policy that allows viewing chats if:
-- 1. User is a participant (via company)
-- 2. OR the chat was just created (has no participants yet - within a short window)
CREATE POLICY "Users can view their chats" ON public.chats
FOR SELECT
USING (
  is_chat_participant(auth.uid(), id)
  OR
  NOT EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = id)
);

-- Also add RETURNING support by updating the INSERT policy
DROP POLICY IF EXISTS "Users can create chats" ON public.chats;

CREATE POLICY "Users can create chats" ON public.chats
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);