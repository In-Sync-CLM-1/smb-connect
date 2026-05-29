-- Drop existing restrictive RLS policies on chats table
DROP POLICY IF EXISTS "Users can create chats" ON chats;
DROP POLICY IF EXISTS "Users can update their chats" ON chats;
DROP POLICY IF EXISTS "Users can view their chats" ON chats;

-- Drop existing restrictive RLS policies on chat_participants table
DROP POLICY IF EXISTS "Users can add chat participants" ON chat_participants;
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;

-- Drop existing restrictive RLS policies on messages table
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;

-- Drop helper functions that are no longer needed
DROP FUNCTION IF EXISTS public.can_add_chat_participant(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_chat_participant(uuid, uuid);

-- Create simple permissive policies for chats
CREATE POLICY "Authenticated users can manage chats" 
ON chats FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create simple permissive policies for chat_participants
CREATE POLICY "Authenticated users can manage chat participants" 
ON chat_participants FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create simple permissive policies for messages
CREATE POLICY "Authenticated users can view messages" 
ON messages FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can send messages as themselves" 
ON messages FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM members 
    WHERE members.id = messages.sender_id 
    AND members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own messages" 
ON messages FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM members 
    WHERE members.id = messages.sender_id 
    AND members.user_id = auth.uid()
  )
);