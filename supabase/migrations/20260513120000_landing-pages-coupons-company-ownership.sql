-- Extend event_landing_pages and event_coupons so that Companies can own
-- their own landing pages and coupons, independently from any Association.
-- Super Admins continue to see everything.
--
-- Ownership model:
--   - event_landing_pages: exactly one of (association_id, company_id) must be set.
--   - event_coupons: scoped via landing_page_id. For non-admins, landing_page_id
--     must be set and point to a landing page they own.

-- 1. Schema change: event_landing_pages
ALTER TABLE public.event_landing_pages
  ALTER COLUMN association_id DROP NOT NULL;

ALTER TABLE public.event_landing_pages
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.event_landing_pages
  DROP CONSTRAINT IF EXISTS event_landing_pages_owner_xor;

ALTER TABLE public.event_landing_pages
  ADD CONSTRAINT event_landing_pages_owner_xor
    CHECK (
      (association_id IS NOT NULL AND company_id IS NULL) OR
      (association_id IS NULL AND company_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_event_landing_pages_company
  ON public.event_landing_pages(company_id);

-- 2. RLS: company owners/admins can manage their company's landing pages
DROP POLICY IF EXISTS "Company owners can view their landing pages"
  ON public.event_landing_pages;
CREATE POLICY "Company owners can view their landing pages"
  ON public.event_landing_pages FOR SELECT
  USING (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
        AND company_id = event_landing_pages.company_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Company owners can insert landing pages"
  ON public.event_landing_pages;
CREATE POLICY "Company owners can insert landing pages"
  ON public.event_landing_pages FOR INSERT
  WITH CHECK (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
        AND company_id = event_landing_pages.company_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Company owners can update their landing pages"
  ON public.event_landing_pages;
CREATE POLICY "Company owners can update their landing pages"
  ON public.event_landing_pages FOR UPDATE
  USING (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
        AND company_id = event_landing_pages.company_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  )
  WITH CHECK (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
        AND company_id = event_landing_pages.company_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Company owners can delete their landing pages"
  ON public.event_landing_pages;
CREATE POLICY "Company owners can delete their landing pages"
  ON public.event_landing_pages FOR DELETE
  USING (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
        AND company_id = event_landing_pages.company_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- 3. Add a missing DELETE policy for association managers
-- (existing migrations have SELECT/INSERT/UPDATE but not DELETE for assoc managers)
DROP POLICY IF EXISTS "Association managers can delete their landing pages"
  ON public.event_landing_pages;
CREATE POLICY "Association managers can delete their landing pages"
  ON public.event_landing_pages FOR DELETE
  USING (
    association_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.association_managers
      WHERE user_id = auth.uid()
        AND association_id = event_landing_pages.association_id
        AND is_active = true
    )
  );

-- 4. RLS: extend event_coupons to association managers and company owners
-- Scope is derived through the linked landing_page_id.

DROP POLICY IF EXISTS "Association managers can manage their coupons"
  ON public.event_coupons;
CREATE POLICY "Association managers can manage their coupons"
  ON public.event_coupons FOR ALL
  USING (
    landing_page_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.event_landing_pages elp
      JOIN public.association_managers am
        ON am.association_id = elp.association_id
      WHERE elp.id = event_coupons.landing_page_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  )
  WITH CHECK (
    landing_page_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.event_landing_pages elp
      JOIN public.association_managers am
        ON am.association_id = elp.association_id
      WHERE elp.id = event_coupons.landing_page_id
        AND am.user_id = auth.uid()
        AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "Company owners can manage their coupons"
  ON public.event_coupons;
CREATE POLICY "Company owners can manage their coupons"
  ON public.event_coupons FOR ALL
  USING (
    landing_page_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.event_landing_pages elp
      JOIN public.members m
        ON m.company_id = elp.company_id
      WHERE elp.id = event_coupons.landing_page_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
        AND m.is_active = true
    )
  )
  WITH CHECK (
    landing_page_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.event_landing_pages elp
      JOIN public.members m
        ON m.company_id = elp.company_id
      WHERE elp.id = event_coupons.landing_page_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
        AND m.is_active = true
    )
  );
