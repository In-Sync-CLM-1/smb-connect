-- Make Sandipan Ray's super admin profile visible to all users
UPDATE admin_users
SET is_hidden = false, updated_at = now()
WHERE user_id = '9115aebc-1231-4f32-95e8-eca490b93bd8';
