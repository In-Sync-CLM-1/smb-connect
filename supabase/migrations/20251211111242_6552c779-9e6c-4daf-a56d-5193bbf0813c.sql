-- Clean up existing incorrect association_managers records for users who should only be regular members
DELETE FROM association_managers am
WHERE am.user_id IN (
  SELECT DISTINCT mi.accepted_by
  FROM member_invitations mi
  WHERE mi.organization_type = 'association'
    AND mi.role = 'member'
    AND mi.status = 'accepted'
    AND mi.accepted_by IS NOT NULL
);