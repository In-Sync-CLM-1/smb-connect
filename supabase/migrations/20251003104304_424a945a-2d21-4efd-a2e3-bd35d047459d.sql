-- Update Sneha's role from 'admin' to 'member' so they see the member dashboard
UPDATE members 
SET role = 'member'
WHERE user_id = '7bc5e526-72dd-4cc0-a2df-0692fbc92606' 
AND role = 'admin';