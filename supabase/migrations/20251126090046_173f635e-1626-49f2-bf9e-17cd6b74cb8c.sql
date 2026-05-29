-- Create the Advaita association
INSERT INTO associations (name, contact_email, is_active, country)
VALUES ('Advaita', 'cheshta.minocha@asrmedia.in', true, 'India');

-- Add user as association manager with full rights
INSERT INTO association_managers (
  user_id,
  association_id,
  is_active,
  role,
  permissions
)
SELECT 
  '5dc43268-5884-463f-8d98-c1c3a4d2017f',
  id,
  true,
  'admin',
  '{
    "manage_members": true,
    "manage_companies": true,
    "manage_events": true,
    "manage_invitations": true,
    "send_emails": true,
    "send_whatsapp": true,
    "view_analytics": true,
    "edit_association": true,
    "manage_email_lists": true,
    "manage_whatsapp_lists": true
  }'::jsonb
FROM associations
WHERE name = 'Advaita'
AND contact_email = 'cheshta.minocha@asrmedia.in';