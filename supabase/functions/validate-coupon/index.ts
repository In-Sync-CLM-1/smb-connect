import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ValidateCouponRequest {
  code: string;
  landing_page_id: string;
  email: string;
}

interface CouponValidationResult {
  valid: boolean;
  coupon_id?: string;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { code, landing_page_id, email }: ValidateCouponRequest = await req.json();

    if (!code || !email) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize the code to uppercase
    const normalizedCode = code.toUpperCase().trim();

    // Fetch the coupon
    const { data: coupon, error: couponError } = await supabase
      .from("event_coupons")
      .select("*")
      .eq("code", normalizedCode)
      .single();

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid coupon code" } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if coupon is active
    if (!coupon.is_active) {
      return new Response(
        JSON.stringify({ valid: false, message: "This coupon is no longer active" } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check validity dates
    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = new Date(coupon.valid_until);

    if (now < validFrom) {
      return new Response(
        JSON.stringify({ valid: false, message: "This coupon is not yet valid" } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (now > validUntil) {
      return new Response(
        JSON.stringify({ valid: false, message: "This coupon has expired" } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check landing page applicability (null means all pages)
    if (coupon.landing_page_id && coupon.landing_page_id !== landing_page_id) {
      return new Response(
        JSON.stringify({ valid: false, message: "This coupon is not valid for this event" } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check total usage limit
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, message: "This coupon has reached its usage limit" } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check per-user usage limit
    const normalizedEmail = email.toLowerCase().trim();
    const { count: userUsageCount } = await supabase
      .from("event_coupon_usages")
      .select("*", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("email", normalizedEmail);

    if (userUsageCount !== null && userUsageCount >= coupon.max_uses_per_user) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: "You have already used this coupon the maximum number of times" 
        } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Coupon is valid!
    const result: CouponValidationResult = {
      valid: true,
      coupon_id: coupon.id,
      discount_type: coupon.discount_type,
      discount_value: parseFloat(coupon.discount_value),
      message: `Coupon applied! ${
        coupon.discount_type === "percentage"
          ? `${coupon.discount_value}% off`
          : `₹${coupon.discount_value} off`
      }`,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return new Response(
      JSON.stringify({ valid: false, message: "An error occurred while validating the coupon" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
