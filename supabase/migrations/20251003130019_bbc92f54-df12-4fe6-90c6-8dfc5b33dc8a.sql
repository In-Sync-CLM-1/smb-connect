-- Create table to track user onboarding progress
CREATE TABLE public.user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_version TEXT NOT NULL DEFAULT 'v1',
  completed_steps JSONB DEFAULT '[]'::jsonb,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, onboarding_version)
);

-- Enable RLS
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

-- Users can view their own onboarding progress
CREATE POLICY "Users can view own onboarding"
  ON public.user_onboarding
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own onboarding progress
CREATE POLICY "Users can update own onboarding"
  ON public.user_onboarding
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own onboarding record
CREATE POLICY "Users can insert own onboarding"
  ON public.user_onboarding
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all onboarding records
CREATE POLICY "Admins can view all onboarding"
  ON public.user_onboarding
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_user_onboarding_user_id ON public.user_onboarding(user_id);
CREATE INDEX idx_user_onboarding_completed ON public.user_onboarding(is_completed);

-- Trigger to update updated_at
CREATE TRIGGER update_user_onboarding_updated_at
  BEFORE UPDATE ON public.user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();