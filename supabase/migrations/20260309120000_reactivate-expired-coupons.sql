-- Reactivate all expired coupons by extending valid_until to end of 2026 and setting is_active = true
UPDATE event_coupons
SET valid_until = '2026-12-31 23:59:59+00',
    is_active = true
WHERE valid_until < NOW() OR is_active = false;
