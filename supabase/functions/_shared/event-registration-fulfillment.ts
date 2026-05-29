// Shared fulfillment for event_registration payments.
// Used by both verify-razorpay-payment (synchronous client-side verification)
// and razorpay-webhook (server-to-server safety net).

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface FulfillResult {
  success: boolean;
  registration_id?: string;
  is_new_user?: boolean;
  message?: string;
  error?: string;
  status?: number;
}

export async function fulfillEventRegistrationPayment(
  supabase: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  payment: any,
  ctx: { razorpayPaymentId: string; razorpaySignature?: string },
): Promise<FulfillResult> {
  const m = payment.metadata ?? {};
  const {
    landing_page_id,
    email,
    first_name,
    last_name,
    phone,
    coupon_id,
    original_amount,
    discount_amount,
    final_amount,
    registration_data,
    utm_source,
    utm_medium,
    utm_campaign,
    association_id,
  } = m;

  if (!landing_page_id || !email || !first_name || !last_name) {
    return { success: false, error: "Payment metadata is incomplete", status: 400 };
  }

  const normalizedEmail = (email as string).trim().toLowerCase();

  // Resolve / create user — mirrors process-event-registration logic.
  let userId: string | null = null;
  let password: string | null = null;
  let isNewUser = false;
  let existingUser = null;

  const { data: profileMatches } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", normalizedEmail);

  if (profileMatches && profileMatches.length === 1) {
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(
      profileMatches[0].id,
    );
    if (authUser && authUser.email?.toLowerCase() === normalizedEmail) {
      existingUser = authUser;
    }
  }

  if (!existingUser && (!profileMatches || profileMatches.length === 0)) {
    let page = 1;
    const perPage = 50;
    let found = false;
    while (!found) {
      const { data: { users } } = await supabase.auth.admin.listUsers({ page, perPage });
      if (!users || users.length === 0) break;
      const match = users.find((u: { email?: string }) =>
        u.email?.toLowerCase() === normalizedEmail
      );
      if (match) {
        existingUser = match;
        found = true;
      }
      if (users.length < perPage) break;
      page++;
    }
  }

  if (existingUser) {
    userId = existingUser.id;
  } else {
    if (!phone || (phone as string).trim().length < 6) {
      return { success: false, error: "Phone number is required for registration", status: 400 };
    }
    password = (phone as string).trim();
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, phone, registered_via_event: landing_page_id },
    });
    if (createError) {
      console.error("Error creating user:", createError);
      return { success: false, error: "Failed to create user account", status: 500 };
    }
    userId = newUser.user.id;
    isNewUser = true;
    await supabase.from("profiles").insert({
      id: userId,
      email: normalizedEmail,
      first_name,
      last_name,
      phone,
    });
  }

  const { data: regResult, error: regError } = await supabase.rpc(
    "complete_event_registration",
    {
      p_landing_page_id: landing_page_id,
      p_email: email,
      p_first_name: first_name,
      p_last_name: last_name,
      p_phone: phone ?? null,
      p_user_id: userId,
      p_association_id: association_id ?? null,
      p_coupon_id: coupon_id ?? null,
      p_original_amount: original_amount ?? 0,
      p_discount_amount: discount_amount ?? 0,
      p_final_amount: final_amount ?? 0,
      p_registration_data: registration_data ?? {},
      p_utm_source: utm_source ?? null,
      p_utm_medium: utm_medium ?? null,
      p_utm_campaign: utm_campaign ?? null,
    },
  );

  if (regError || !regResult?.success) {
    console.error("complete_event_registration error:", regError || regResult?.error);
    await supabase
      .from("payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        razorpay_payment_id: ctx.razorpayPaymentId,
        razorpay_signature: ctx.razorpaySignature ?? null,
        failure_reason: "Payment captured but registration creation failed: " +
          (regError?.message || regResult?.error || "unknown"),
      })
      .eq("id", payment.id);
    return {
      success: false,
      error:
        "Payment was captured but registration failed. Our team has been notified and will contact you.",
      status: 500,
    };
  }

  await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      razorpay_payment_id: ctx.razorpayPaymentId,
      razorpay_signature: ctx.razorpaySignature ?? null,
      reference_id: regResult.registration_id,
      user_id: userId,
    })
    .eq("id", payment.id);

  // Fire-and-forget emails (won't block fulfillment response if they fail)
  const emailCtx: PaymentEmailContext = {
    landingPageId: landing_page_id,
    associationId: association_id ?? null,
    email: normalizedEmail,
    firstName: first_name as string,
    lastName: last_name as string,
    phone: (phone as string) ?? null,
    paymentId: payment.id,
    razorpayPaymentId: ctx.razorpayPaymentId,
    finalAmount: Number(final_amount ?? 0),
    originalAmount: Number(original_amount ?? 0),
    discountAmount: Number(discount_amount ?? 0),
    paidAt: new Date(),
  };

  await Promise.allSettled([
    sendPaymentSuccessEmail(supabase, emailCtx),
    sendAdminPaymentNotification(supabase, emailCtx),
    isNewUser && password
      ? sendWelcomeEmail(supabase, {
        landing_page_id,
        email: normalizedEmail,
        first_name: first_name as string,
        password,
      })
      : Promise.resolve(),
  ]);

  return {
    success: true,
    registration_id: regResult.registration_id,
    is_new_user: isNewUser,
    message: isNewUser
      ? "Payment successful! Check your email for login credentials."
      : "Payment successful! You can login with your existing account.",
  };
}

interface PaymentEmailContext {
  landingPageId: string;
  associationId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  paymentId: string;
  razorpayPaymentId: string;
  finalAmount: number;
  originalAmount: number;
  discountAmount: number;
  paidAt: Date;
}

function inr(n: number): string {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendPaymentSuccessEmail(
  supabase: SupabaseClient,
  ctx: PaymentEmailContext,
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return;

  try {
    const { data: lp } = await supabase
      .from("event_landing_pages")
      .select("title, event_date, event_time, event_venue")
      .eq("id", ctx.landingPageId)
      .single();

    const eventTitle = lp?.title ?? "Event";
    const eventDate = formatEventDate(lp?.event_date ?? null);
    const eventTime = lp?.event_time ?? "Details to be announced";
    const eventVenue = lp?.event_venue ?? "Details to be announced";
    const paidOn = ctx.paidAt.toLocaleString("en-IN", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const discountRow = ctx.discountAmount > 0
      ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;">Original Price</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;text-decoration:line-through;color:#94a3b8;">${inr(ctx.originalAmount)}</td></tr>
        <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#16a34a;">Discount</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;color:#16a34a;">- ${inr(ctx.discountAmount)}</td></tr>`
      : "";

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;max-width:650px;margin:0 auto;background:#f5f5f5;">
  <div style="background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);padding:36px 30px;text-align:center;">
    <div style="background:#fff;width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
      <span style="font-size:36px;color:#16a34a;">✓</span>
    </div>
    <h1 style="color:#fff;margin:0;font-size:26px;">Payment Successful</h1>
    <p style="color:#dcfce7;margin:8px 0 0;font-size:14px;">Your registration for ${escapeHtml(eventTitle)} is confirmed</p>
  </div>
  <div style="background:#fff;padding:32px 30px;">
    <p style="font-size:16px;">Hi <strong>${escapeHtml(ctx.firstName)}</strong>,</p>
    <p style="font-size:15px;color:#444;">Thank you for your payment. Below is your receipt — please save it for your records.</p>

    <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;display:inline-block;margin-top:24px;">PAYMENT RECEIPT</h2>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">
      ${discountRow}
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;width:140px;">Amount Paid</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#16a34a;font-size:16px;">${inr(ctx.finalAmount)}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;">Payment ID</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:13px;">${escapeHtml(ctx.razorpayPaymentId)}</td></tr>
      <tr><td style="padding:10px 16px;font-weight:600;color:#64748b;">Paid On</td><td style="padding:10px 16px;">${paidOn}</td></tr>
    </table>

    <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;display:inline-block;margin-top:24px;">EVENT DETAILS</h2>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;width:140px;">Event</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(eventTitle)}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;">Date</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(eventDate)}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;">Time</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(eventTime)}</td></tr>
      <tr><td style="padding:10px 16px;font-weight:600;color:#64748b;">Venue</td><td style="padding:10px 16px;">${escapeHtml(eventVenue)}</td></tr>
    </table>

    <p style="font-size:14px;color:#64748b;margin-top:28px;">If you have any questions about your registration, just reply to this email.</p>
    <p style="font-size:15px;color:#333;margin-top:20px;">Warm regards,<br><strong style="color:#1e3a5f;">SMBConnect</strong></p>
  </div>
  <div style="background:#f8fafc;padding:18px 30px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#64748b;font-size:12px;margin:0;">© ${new Date().getFullYear()} SMBConnect. All rights reserved.</p>
  </div>
</body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SMB Connect <noreply@smbconnect.in>",
        to: [ctx.email],
        subject: `Payment Successful — ${eventTitle}`,
        html: emailHtml,
      }),
    });
  } catch (err) {
    console.error("payment-success email error:", err);
  }
}

async function sendAdminPaymentNotification(
  supabase: SupabaseClient,
  ctx: PaymentEmailContext,
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return;
  if (!ctx.associationId) return;

  try {
    const [{ data: association }, { data: lp }] = await Promise.all([
      supabase
        .from("associations")
        .select("name, contact_email")
        .eq("id", ctx.associationId)
        .single(),
      supabase
        .from("event_landing_pages")
        .select("title")
        .eq("id", ctx.landingPageId)
        .single(),
    ]);

    const adminEmail = association?.contact_email;
    if (!adminEmail) return;

    const eventTitle = lp?.title ?? "Event";
    const orgName = association?.name ?? "your organization";
    const fullName = `${ctx.firstName} ${ctx.lastName}`.trim();
    const paidOn = ctx.paidAt.toLocaleString("en-IN", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;max-width:650px;margin:0 auto;background:#f5f5f5;">
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);padding:32px 30px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">New Paid Registration</h1>
    <p style="color:#cbd5e1;margin:6px 0 0;font-size:14px;">${escapeHtml(eventTitle)}</p>
  </div>
  <div style="background:#fff;padding:30px;">
    <p style="font-size:15px;">Hi ${escapeHtml(orgName)} team,</p>
    <p style="font-size:15px;color:#444;">A new attendee just completed payment for <strong>${escapeHtml(eventTitle)}</strong>. Details below:</p>

    <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;display:inline-block;margin-top:20px;">REGISTRANT</h2>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;width:140px;">Name</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(fullName) || "—"}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;">Email</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;"><a href="mailto:${escapeHtml(ctx.email)}" style="color:#0284c7;">${escapeHtml(ctx.email)}</a></td></tr>
      <tr><td style="padding:10px 16px;font-weight:600;color:#64748b;">Phone</td><td style="padding:10px 16px;">${escapeHtml(ctx.phone || "—")}</td></tr>
    </table>

    <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;display:inline-block;margin-top:20px;">PAYMENT</h2>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;width:140px;">Amount</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#16a34a;">${inr(ctx.finalAmount)}</td></tr>
      ${ctx.discountAmount > 0 ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;">Discount Applied</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${inr(ctx.discountAmount)} (off ${inr(ctx.originalAmount)})</td></tr>` : ""}
      <tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#64748b;">Razorpay ID</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:13px;">${escapeHtml(ctx.razorpayPaymentId)}</td></tr>
      <tr><td style="padding:10px 16px;font-weight:600;color:#64748b;">Paid On</td><td style="padding:10px 16px;">${paidOn}</td></tr>
    </table>

    <p style="font-size:13px;color:#64748b;margin-top:24px;">View all registrations in the <strong>Event Registrations</strong> tab of your admin dashboard.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 30px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#64748b;font-size:12px;margin:0;">© ${new Date().getFullYear()} SMBConnect. Automated notification.</p>
  </div>
</body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SMB Connect <noreply@smbconnect.in>",
        to: [adminEmail],
        subject: `New paid registration: ${fullName || ctx.email} — ${eventTitle}`,
        html: emailHtml,
      }),
    });
  } catch (err) {
    console.error("admin-payment notification error:", err);
  }
}

async function sendWelcomeEmail(
  supabase: SupabaseClient,
  args: { landing_page_id: string; email: string; first_name: string; password: string },
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return;

  try {
    const { data: lp } = await supabase
      .from("event_landing_pages")
      .select("title, event_date, event_time, event_venue")
      .eq("id", args.landing_page_id)
      .single();

    const eventTitle = lp?.title ?? "Event";
    const eventDate = formatEventDate(lp?.event_date ?? null);
    const eventTime = lp?.event_time ?? "Details to be announced";
    const eventVenue = lp?.event_venue ?? "Details to be announced";
    const portalUrl = "https://smb-connect-hub.lovable.app/auth/login";

    const emailHtml =
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 650px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3d7ab5 100%); padding: 40px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to ${eventTitle}!</h1>
    <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 14px;">Your registration is confirmed</p>
  </div>
  <div style="background: #ffffff; padding: 35px 30px;">
    <p style="font-size: 16px;">Dear <strong>${args.first_name}</strong>,</p>
    <p style="font-size: 15px; color: #444;">Thank you for registering for <strong>${eventTitle}</strong>! Your payment has been received and your spot is confirmed.</p>
    <div style="margin: 30px 0;">
      <h2 style="font-size: 16px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; display: inline-block;">EVENT DETAILS</h2>
      <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px;">
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #64748b; width: 120px;">Event</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${eventTitle}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #64748b;">Date</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${eventDate}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #64748b;">Time</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${eventTime}</td></tr>
        <tr><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Venue</td><td style="padding: 12px 16px;">${eventVenue}</td></tr>
      </table>
    </div>
    <div style="margin: 30px 0;">
      <h2 style="font-size: 16px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; display: inline-block;">YOUR SMBCONNECT PORTAL ACCESS</h2>
      <table style="width: 100%; border-collapse: collapse; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #bae6fd; font-weight: 600; color: #0369a1;">Portal URL</td><td style="padding: 12px 16px; border-bottom: 1px solid #bae6fd;"><a href="${portalUrl}" style="color: #0284c7;">${portalUrl}</a></td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #bae6fd; font-weight: 600; color: #0369a1;">Username</td><td style="padding: 12px 16px; font-family: monospace;">${args.email}</td></tr>
        <tr><td style="padding: 12px 16px; font-weight: 600; color: #0369a1;">Temporary Password</td><td style="padding: 12px 16px;"><code style="background: #fff; padding: 4px 10px; border-radius: 4px; font-family: monospace; border: 1px solid #e2e8f0;">${args.password}</code></td></tr>
      </table>
      <p style="font-size: 13px; color: #dc2626; margin: 10px 0 0 0;">For security, please update your password after your first login.</p>
    </div>
    <div style="text-align: center; margin: 35px 0 25px 0;">
      <a href="${portalUrl}" style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Login to SMBConnect Portal</a>
    </div>
    <p style="font-size: 15px; color: #333;">Warm regards,<br><strong style="color: #1e3a5f;">SMBConnect</strong></p>
  </div>
  <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="color: #64748b; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} SMBConnect. All rights reserved.</p>
  </div>
</body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SMB Connect <noreply@smbconnect.in>",
        to: [args.email],
        subject: `Welcome to ${eventTitle} & Your SMBConnect Portal Access`,
        html: emailHtml,
      }),
    });
  } catch (err) {
    console.error("welcome email error:", err);
  }
}

function formatEventDate(dateString: string | null): string {
  if (!dateString) return "Details to be announced";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "Details to be announced";
  }
}
