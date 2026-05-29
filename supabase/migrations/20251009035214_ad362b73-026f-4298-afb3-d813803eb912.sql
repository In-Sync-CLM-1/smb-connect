-- Update super admin email from sr@asrmedia.com to sr@asrmedia.in
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the user_id for sr@asrmedia.com
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'sr@asrmedia.com';

  -- Update email in auth.users
  UPDATE auth.users
  SET email = 'sr@asrmedia.in',
      updated_at = now()
  WHERE id = admin_user_id;

  -- Update identity_data in auth.identities
  UPDATE auth.identities
  SET identity_data = format('{"sub":"%s","email":"sr@asrmedia.in"}', admin_user_id::text)::jsonb,
      updated_at = now()
  WHERE user_id = admin_user_id AND provider = 'email';
END $$;