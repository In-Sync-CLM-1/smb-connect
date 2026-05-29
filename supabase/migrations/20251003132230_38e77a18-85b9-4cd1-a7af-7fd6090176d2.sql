-- Allow all authenticated members to view other members' basic information
CREATE POLICY "Members can view other active members" 
ON public.members 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Allow all authenticated users to view profiles
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);