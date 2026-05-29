-- ============================================
-- Phase 2: Professional Data Protection
-- ============================================

-- ============================================
-- Step 2.1: Fix Work Experience Table
-- ============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Users can view all work experience" ON public.work_experience;

-- Create new restrictive policies for work_experience
CREATE POLICY "Users can view own work experience"
ON public.work_experience
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all work experience"
ON public.work_experience
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Connected users can view each other's work experience"
ON public.work_experience
FOR SELECT
USING (is_connected_to(auth.uid(), user_id));

CREATE POLICY "Company managers can view their company members' work experience"
ON public.work_experience
FOR SELECT
USING (is_company_admin_of_user(auth.uid(), user_id));

CREATE POLICY "Association managers can view work experience in their network"
ON public.work_experience
FOR SELECT
USING (is_association_manager_of_user(auth.uid(), user_id));

CREATE POLICY "Company members can view same company work experience"
ON public.work_experience
FOR SELECT
USING (is_same_company(auth.uid(), user_id));

-- ============================================
-- Step 2.2: Fix Education Table
-- ============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Users can view all education" ON public.education;

-- Create new restrictive policies for education
CREATE POLICY "Users can view own education"
ON public.education
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all education"
ON public.education
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Connected users can view each other's education"
ON public.education
FOR SELECT
USING (is_connected_to(auth.uid(), user_id));

CREATE POLICY "Company managers can view their company members' education"
ON public.education
FOR SELECT
USING (is_company_admin_of_user(auth.uid(), user_id));

CREATE POLICY "Association managers can view education in their network"
ON public.education
FOR SELECT
USING (is_association_manager_of_user(auth.uid(), user_id));

CREATE POLICY "Company members can view same company education"
ON public.education
FOR SELECT
USING (is_same_company(auth.uid(), user_id));

-- ============================================
-- Step 2.2: Fix Skills Table
-- ============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Users can view all skills" ON public.skills;

-- Create new restrictive policies for skills
CREATE POLICY "Users can view own skills"
ON public.skills
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all skills"
ON public.skills
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Connected users can view each other's skills"
ON public.skills
FOR SELECT
USING (is_connected_to(auth.uid(), user_id));

CREATE POLICY "Company managers can view their company members' skills"
ON public.skills
FOR SELECT
USING (is_company_admin_of_user(auth.uid(), user_id));

CREATE POLICY "Association managers can view skills in their network"
ON public.skills
FOR SELECT
USING (is_association_manager_of_user(auth.uid(), user_id));

CREATE POLICY "Company members can view same company skills"
ON public.skills
FOR SELECT
USING (is_same_company(auth.uid(), user_id));

-- ============================================
-- Step 2.2: Fix Certifications Table
-- ============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Users can view all certifications" ON public.certifications;

-- Create new restrictive policies for certifications
CREATE POLICY "Users can view own certifications"
ON public.certifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all certifications"
ON public.certifications
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Connected users can view each other's certifications"
ON public.certifications
FOR SELECT
USING (is_connected_to(auth.uid(), user_id));

CREATE POLICY "Company managers can view their company members' certifications"
ON public.certifications
FOR SELECT
USING (is_company_admin_of_user(auth.uid(), user_id));

CREATE POLICY "Association managers can view certifications in their network"
ON public.certifications
FOR SELECT
USING (is_association_manager_of_user(auth.uid(), user_id));

CREATE POLICY "Company members can view same company certifications"
ON public.certifications
FOR SELECT
USING (is_same_company(auth.uid(), user_id));

-- ============================================
-- Step 2.3: Fix Social Features (Posts, Comments, Likes)
-- ============================================

-- Fix Posts table
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;

CREATE POLICY "Authenticated users can view posts"
ON public.posts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix Post Comments table
DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;

CREATE POLICY "Authenticated users can view comments"
ON public.post_comments
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix Post Likes table
DROP POLICY IF EXISTS "Anyone can view likes" ON public.post_likes;

CREATE POLICY "Authenticated users can view likes"
ON public.post_likes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add helpful comments
COMMENT ON POLICY "Connected users can view each other's work experience" ON public.work_experience
IS 'Users with accepted connections can view each other''s professional history.';

COMMENT ON POLICY "Authenticated users can view posts" ON public.posts
IS 'Prevents public scraping of user activity. Requires authentication to view social feed.';