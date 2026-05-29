-- Drop the existing function and recreate with fixed logic
CREATE OR REPLACE FUNCTION public.can_add_chat_participant(check_user_id uuid, check_chat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Allow adding participants if:
  -- 1. The chat has no participants yet (new chat)
  -- 2. OR the user is already a participant in the chat via their company
  SELECT 
    NOT EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = check_chat_id)
    OR
    EXISTS (
      SELECT 1
      FROM chat_participants cp
      JOIN members m ON m.company_id = cp.company_id
      WHERE cp.chat_id = check_chat_id
      AND m.user_id = check_user_id
      AND m.is_active = true
    );
$$;