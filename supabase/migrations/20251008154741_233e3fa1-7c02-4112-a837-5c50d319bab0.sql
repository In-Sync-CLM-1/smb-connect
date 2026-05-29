
-- Create new super admin user and update admin_users table
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert user into auth.users with specified password
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'sr@asrmedia.com',
    crypt('ASRMedia@2009', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Super","last_name":"Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Insert identity record with provider_id
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id::text,
    new_user_id,
    format('{"sub":"%s","email":"sr@asrmedia.com"}', new_user_id::text)::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  -- Remove super admin status from old user
  UPDATE admin_users 
  SET is_super_admin = false, is_active = false
  WHERE user_id = '9115aebc-1231-4f32-95e8-eca490b93bd8';

  -- Add new super admin (profile and member will be auto-created by triggers)
  INSERT INTO admin_users (user_id, is_super_admin, is_active)
  VALUES (new_user_id, true, true);
END $$;
