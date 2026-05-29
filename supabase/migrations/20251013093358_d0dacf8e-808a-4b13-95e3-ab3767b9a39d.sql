-- Create default company for standalone members
INSERT INTO companies (
  id,
  name,
  description,
  email,
  association_id,
  is_active,
  is_verified,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'The Rise - Direct Members',
  'Default company for members directly associated with The Rise association',
  'marketing@asrmedia.in',
  '9cb4672e-6423-429e-a260-1e7ad12f34d5',
  true,
  true,
  NOW(),
  NOW()
);

-- Assign all standalone members created on 2025-10-13 to the default company
UPDATE members 
SET 
  company_id = (
    SELECT id 
    FROM companies 
    WHERE name = 'The Rise - Direct Members' 
    AND association_id = '9cb4672e-6423-429e-a260-1e7ad12f34d5'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE company_id IS NULL 
  AND created_at::date = '2025-10-13';