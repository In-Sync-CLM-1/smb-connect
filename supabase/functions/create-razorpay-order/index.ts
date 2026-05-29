import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createRazorpayOrder, getRazorpayCreds } from "../_shared/razorpay.ts";

interface CreateOrderRequest {
  purpose: "event_registration";
  metadata: Record<string, unknown>;
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
    const { purpose, metadata }: CreateOrderRequest = await req.json();

    if (!purpose || !metadata || typeof metadata !== "object") {
      return json(400, { error: "Missing purpose or metadata" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (purpose === "event_registration") {
      return await handleEventRegistration(supabase, metadata);
    }

    return json(400, { error: `Unsupported purpose: ${purpose}` });
  } catch (err) {
    console.error("create-razorpay-order error:", err);
    return json(500, { error: "Internal server error" });
  }
});

async function handleEventRegistration(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  metadata: Record<string, unknown>,
): Promise<Response> {
  const landing_page_id = metadata.landing_page_id as string | undefined;
  const email = metadata.email as string | undefined;
  const first_name = metadata.first_name as string | undefined;
  const last_name = metadata.last_name as string | undefined;
  const phone = metadata.phone as string | undefined;
  const coupon_code = (metadata.coupon_code as string | undefined) ?? null;

  if (!landing_page_id || !email || !first_name || !last_name) {
    return json(400, {
      error: "Missing required fields: landing_page_id, email, first_name, last_name",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json(400, { error: "Invalid email format" });
  }

  // Server-side validation: re-computes amounts and checks for dup registration / coupon validity.
  // This is the single source of truth for the amount; we never trust the client.
  const { data: validation, error: valError } = await supabase.rpc(
    "validate_event_registration",
    {
      p_landing_page_id: landing_page_id,
      p_email: email,
      p_coupon_code: coupon_code,
    },
  );

  if (valError) {
    console.error("validate_event_registration error:", valError);
    return json(500, { error: "Failed to validate registration" });
  }

  if (!validation?.valid) {
    return json(validation?.status ?? 400, { error: validation?.error ?? "Validation failed" });
  }

  const finalAmount = Number(validation.final_amount ?? 0);

  // Free or 100%-coupon — caller should fall back to process-event-registration
  if (finalAmount <= 0) {
    return json(200, {
      skip_payment: true,
      reason: "Final amount is zero",
      validation,
    });
  }

  // Look up existing user_id for record-keeping (optional, payments.user_id can stay null)
  let userId: string | null = null;
  const { data: profileMatches } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email.trim().toLowerCase())
    .limit(1);
  if (profileMatches && profileMatches.length === 1) {
    userId = profileMatches[0].id;
  }

  // Create Razorpay order
  const creds = getRazorpayCreds();
  const amountInPaise = Math.round(finalAmount * 100);
  let order;
  try {
    order = await createRazorpayOrder(creds, {
      amountInPaise,
      currency: "INR",
      receipt: `evt_${landing_page_id.slice(0, 8)}_${Date.now()}`,
      notes: {
        purpose: "event_registration",
        landing_page_id,
        email: email.toLowerCase(),
      },
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    return json(502, { error: "Payment gateway error. Please try again." });
  }

  // Persist payment record. metadata contains everything needed to fulfill on verify.
  const paymentMetadata = {
    landing_page_id,
    email: email.toLowerCase(),
    first_name,
    last_name,
    phone: phone ?? null,
    coupon_code,
    coupon_id: validation.coupon_id ?? null,
    original_amount: validation.original_amount ?? finalAmount,
    discount_amount: validation.discount_amount ?? 0,
    final_amount: finalAmount,
    registration_data: metadata.registration_data ?? {},
    utm_source: metadata.utm_source ?? validation.default_utm_source ?? null,
    utm_medium: metadata.utm_medium ?? validation.default_utm_medium ?? null,
    utm_campaign: metadata.utm_campaign ?? validation.default_utm_campaign ?? null,
    association_id: validation.association_id ?? null,
  };

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      email: email.toLowerCase(),
      purpose: "event_registration",
      reference_table: "event_registrations",
      amount: finalAmount,
      currency: "INR",
      status: "created",
      gateway: "razorpay",
      razorpay_order_id: order.id,
      metadata: paymentMetadata,
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    console.error("payments insert error:", insertError);
    return json(500, { error: "Failed to record payment" });
  }

  return json(200, {
    skip_payment: false,
    payment_id: payment.id,
    razorpay_order_id: order.id,
    amount: amountInPaise, // paise — Razorpay checkout expects this
    currency: "INR",
    key_id: creds.keyId,
    prefill: {
      name: `${first_name} ${last_name}`.trim(),
      email: email.toLowerCase(),
      contact: phone ?? "",
    },
  });
}
