-- P2/P3: Source of truth reconciliation functions
-- These can be called periodically to fix drift between denormalized data and source tables

-- ============================================================
-- 1. Reconcile email campaign statistics from recipient records
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_campaign_statistics(p_campaign_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign RECORD;
  v_fixed INT := 0;
BEGIN
  FOR v_campaign IN
    SELECT c.id,
      COUNT(*) FILTER (WHERE r.sent = true) AS actual_sent,
      COUNT(*) FILTER (WHERE r.delivered = true) AS actual_delivered,
      COUNT(*) FILTER (WHERE r.opened = true) AS actual_opened,
      COUNT(*) FILTER (WHERE r.clicked = true) AS actual_clicked,
      COUNT(*) FILTER (WHERE r.bounced = true) AS actual_bounced,
      COUNT(*) FILTER (WHERE r.complained = true) AS actual_complained,
      COUNT(*) FILTER (WHERE r.unsubscribed = true) AS actual_unsubscribed,
      c.total_sent, c.total_delivered, c.total_opened, c.total_clicked,
      c.total_bounced, c.total_complained, c.total_unsubscribed
    FROM email_campaigns c
    LEFT JOIN email_campaign_recipients r ON r.campaign_id = c.id
    WHERE (p_campaign_id IS NULL OR c.id = p_campaign_id)
    GROUP BY c.id
  LOOP
    IF v_campaign.total_sent <> v_campaign.actual_sent
      OR v_campaign.total_delivered <> v_campaign.actual_delivered
      OR v_campaign.total_opened <> v_campaign.actual_opened
      OR v_campaign.total_clicked <> v_campaign.actual_clicked
      OR v_campaign.total_bounced <> v_campaign.actual_bounced
    THEN
      UPDATE email_campaigns SET
        total_sent = v_campaign.actual_sent,
        total_delivered = v_campaign.actual_delivered,
        total_opened = v_campaign.actual_opened,
        total_clicked = v_campaign.actual_clicked,
        total_bounced = v_campaign.actual_bounced,
        total_complained = v_campaign.actual_complained,
        total_unsubscribed = v_campaign.actual_unsubscribed,
        open_rate = CASE WHEN v_campaign.actual_sent > 0
          THEN ROUND((v_campaign.actual_opened::NUMERIC / v_campaign.actual_sent) * 100, 2) ELSE 0 END,
        click_rate = CASE WHEN v_campaign.actual_sent > 0
          THEN ROUND((v_campaign.actual_clicked::NUMERIC / v_campaign.actual_sent) * 100, 2) ELSE 0 END,
        bounce_rate = CASE WHEN v_campaign.actual_sent > 0
          THEN ROUND((v_campaign.actual_bounced::NUMERIC / v_campaign.actual_sent) * 100, 2) ELSE 0 END
      WHERE id = v_campaign.id;
      v_fixed := v_fixed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('reconciled_campaigns', v_fixed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_campaign_statistics(UUID) TO service_role;

-- ============================================================
-- 2. Reconcile coupon usage counts from actual usage records
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_coupon_counts(p_coupon_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_fixed INT := 0;
  v_actual_count INT;
BEGIN
  FOR v_coupon IN
    SELECT c.id, c.current_uses,
      (SELECT COUNT(*) FROM event_coupon_usages u WHERE u.coupon_id = c.id) AS actual_uses
    FROM event_coupons c
    WHERE (p_coupon_id IS NULL OR c.id = p_coupon_id)
  LOOP
    IF v_coupon.current_uses <> v_coupon.actual_uses THEN
      UPDATE event_coupons SET current_uses = v_coupon.actual_uses WHERE id = v_coupon.id;
      v_fixed := v_fixed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('reconciled_coupons', v_fixed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_coupon_counts(UUID) TO service_role;
