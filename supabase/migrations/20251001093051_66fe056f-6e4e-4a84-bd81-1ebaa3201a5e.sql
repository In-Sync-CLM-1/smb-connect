-- Phase 2: Connection System for Members

-- 1. Create connections table
CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);

-- 2. Create index for better query performance
CREATE INDEX idx_connections_sender ON public.connections(sender_id);
CREATE INDEX idx_connections_receiver ON public.connections(receiver_id);
CREATE INDEX idx_connections_status ON public.connections(status);

-- 3. Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for connections

-- Users can view connections they're part of
CREATE POLICY "Users can view their connections"
ON public.connections
FOR SELECT
USING (
  sender_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  OR receiver_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- Users can send connection requests
CREATE POLICY "Users can send connection requests"
ON public.connections
FOR INSERT
WITH CHECK (
  sender_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- Users can update connections they received (accept/reject)
CREATE POLICY "Users can respond to connection requests"
ON public.connections
FOR UPDATE
USING (
  receiver_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- Users can delete their own sent requests
CREATE POLICY "Users can delete their sent requests"
ON public.connections
FOR DELETE
USING (
  sender_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  AND status = 'pending'
);

-- 5. Trigger to update updated_at timestamp
CREATE TRIGGER update_connections_updated_at
BEFORE UPDATE ON public.connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();