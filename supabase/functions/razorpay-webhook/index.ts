// Razorpay webhook handler.
// Subscribed events: payment.captured, payment.failed
// Webhook secret is configured per endpoint in the Razorpay Dashboard.
// Signature header: X-Razorpay-Signature (HMAC-SHA256 of the raw request body).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyWebhookSignature } from "../_shared/razorpay.ts";
import { fulfillEventRegistrationPayment } from "../_shared/event-registration-fulfillment.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return json(500, { error: "Webhook secret not configured" });
    }

    // Razorpay signs the raw request body. Read it as text BEFORE parsing JSON.
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    const valid = await verifyWebhookSignature(webhookSecret, rawBody, signature);
    if (!valid) {
      console.warn("Razorpay webhook: invalid signature");
      return json(400, { error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event;
    const paymentEntity = event.payload?.payment?.entity;

    if (!paymentEntity?.order_id) {
      // Not a payment event we care about; acknowledge so Razorpay doesn't retry.
      return json(200, { ok: true, ignored: true, event: eventType });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment, error: payError } = await supabase
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", paymentEntity.order_id)
      .single();

    if (payError || !payment) {
      console.warn("Webhook: no matching payment for order", paymentEntity.order_id);
      // 200 so Razorpay doesn't retry forever — could be an order created by another service.
      return json(200, { ok: true, ignored: true, reason: "unknown_order" });
    }

    if (eventType === "payment.captured") {
      // Idempotent: skip if already paid + fulfilled
      if (payment.status === "paid" && payment.reference_id) {
        return json(200, { ok: true, already_completed: true });
      }

      if (payment.purpose === "event_registration") {
        const result = await fulfillEventRegistrationPayment(supabase, payment, {
          razorpayPaymentId: paymentEntity.id,
          razorpaySignature: undefined, // webhook path has no checkout signature
        });
        if (!result.success) {
          console.error("webhook fulfillment failed:", result.error);
          // 200 anyway: re-trying via webhook won't fix a registration error.
          // The payment row is annotated with failure_reason for manual reconciliation.
          return json(200, { ok: false, error: result.error });
        }
        return json(200, { ok: true, registration_id: result.registration_id });
      }

      return json(200, { ok: true, ignored: true, reason: "unsupported_purpose" });
    }

    if (eventType === "payment.failed") {
      if (payment.status !== "paid") {
        await supabase
          .from("payments")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            failure_reason: paymentEntity.error_description ?? "Payment failed",
            razorpay_payment_id: paymentEntity.id,
          })
          .eq("id", payment.id);
      }
      return json(200, { ok: true });
    }

    return json(200, { ok: true, ignored: true, event: eventType });
  } catch (err) {
    console.error("razorpay-webhook error:", err);
    // Return 200 to prevent retry storms on parse errors; the issue is already logged.
    return json(200, { ok: false, error: "internal" });
  }
});
