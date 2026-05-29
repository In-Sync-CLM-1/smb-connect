import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getRazorpayCreds, verifyCheckoutSignature } from "../_shared/razorpay.ts";
import { fulfillEventRegistrationPayment } from "../_shared/event-registration-fulfillment.ts";

interface VerifyRequest {
  payment_id: string; // our internal payments.id
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body: VerifyRequest = await req.json();
    const { payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!payment_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(400, { error: "Missing required fields" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment, error: payError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .single();

    if (payError || !payment) {
      console.error("payment lookup error:", payError);
      return json(404, { error: "Payment record not found" });
    }

    if (payment.razorpay_order_id !== razorpay_order_id) {
      return json(400, { error: "Order ID mismatch" });
    }

    // Idempotency: webhook may have fulfilled this already
    if (payment.status === "paid" && payment.reference_id) {
      return json(200, {
        success: true,
        already_completed: true,
        registration_id: payment.reference_id,
        message: "Payment already verified",
      });
    }

    const { keySecret } = getRazorpayCreds();
    const valid = await verifyCheckoutSignature(
      keySecret,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!valid) {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          failure_reason: "Invalid signature",
          razorpay_payment_id,
          razorpay_signature,
        })
        .eq("id", payment_id);
      return json(400, { error: "Invalid payment signature" });
    }

    if (payment.purpose === "event_registration") {
      const result = await fulfillEventRegistrationPayment(supabase, payment, {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
      if (!result.success) {
        return json(result.status ?? 500, { error: result.error });
      }
      return json(200, {
        success: true,
        registration_id: result.registration_id,
        is_new_user: result.is_new_user,
        message: result.message,
      });
    }

    return json(400, { error: `Unsupported purpose: ${payment.purpose}` });
  } catch (err) {
    console.error("verify-razorpay-payment error:", err);
    return json(500, { error: "Internal server error" });
  }
});
