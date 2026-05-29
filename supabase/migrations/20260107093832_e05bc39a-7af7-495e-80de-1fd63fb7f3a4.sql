-- Fix chat_participants table: remove FK to companies and rename column to member_id
-- Clean up orphaned data first, then restructure

-- Step 1: Drop the foreign key constraint
ALTER TABLE public.chat_participants 
DROP CONSTRAINT IF EXISTS chat_participants_company_id_fkey;

-- Step 2: Delete any chat participants that don't have valid member IDs
DELETE FROM public.chat_participants 
WHERE company_id NOT IN (SELECT id FROM public.members);

-- Step 3: Rename the column from company_id to member_id
ALTER TABLE public.chat_participants 
RENAME COLUMN company_id TO member_id;

-- Step 4: Add new foreign key constraint to members table
ALTER TABLE public.chat_participants 
ADD CONSTRAINT chat_participants_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;