import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatEventDate(dateString: string | null): string {
  if (!dateString) return 'Details to be announced';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return 'Details to be announced';
  }
}

interface RegistrationRequest {
  landing_page_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  registration_data?: Record<string, unknown>;
  coupon_code?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: RegistrationRequest = await req.json();
    const { landing_page_id, email, first_name, last_name, phone, registration_data, coupon_code, utm_source, utm_medium, utm_campaign } = body;

    if (!landing_page_id || !email || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: landing_page_id, email, first_name, last_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================
    // Phase 1: Validate via RPC (landing page + dup check + coupon)
    // Replaces 4 sequential DB roundtrips with 1 RPC call
    // ============================================================
    const { data: validation, error: valError } = await supabase.rpc('validate_event_registration', {
      p_landing_page_id: landing_page_id,
      p_email: email,
      p_coupon_code: coupon_code || null,
    });

    if (valError) {
      console.error('Validation RPC error:', valError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate registration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: validation.status || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // User resolution + creation (requires Auth Admin API)
    // ============================================================
    const normalizedEmail = email.trim().toLowerCase();

    // Deterministic user lookup via profiles
    const { data: profileMatches } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', normalizedEmail);

    let existingUser = null;
    if (profileMatches && profileMatches.length === 1) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profileMatches[0].id);
      if (authUser && authUser.email?.toLowerCase() === normalizedEmail) {
        existingUser = authUser;
      }
    }

    // Fallback: paginated auth scan
    if (!existingUser && (!profileMatches || profileMatches.length === 0)) {
      let page = 1;
      const perPage = 50;
      let found = false;
      while (!found) {
        const { data: { users } } = await supabase.auth.admin.listUsers({ page, perPage });
        if (!users || users.length === 0) break;
        const match = users.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (match) { existingUser = match; found = true; }
        if (users.length < perPage) break;
        page++;
      }
    }

    let userId: string | null = null;
    let password: string | null = null;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      if (!phone || phone.trim().length < 6) {
        return new Response(
          JSON.stringify({ error: 'Phone number is required for registration' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      password = phone.trim();

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: { first_name, last_name, phone, registered_via_event: landing_page_id }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      isNewUser = true;

      // Create profile
      await supabase.from('profiles').insert({
        id: userId, email: email.toLowerCase(), first_name, last_name, phone
      });
    }

    // ============================================================
    // Phase 2: Complete registration via RPC (atomic)
    // Replaces 6+ sequential DB roundtrips with 1 RPC call
    // ============================================================
    const finalUtmSource = utm_source || validation.default_utm_source || null;
    const finalUtmMedium = utm_medium || validation.default_utm_medium || null;
    const finalUtmCampaign = utm_campaign || validation.default_utm_campaign || null;

    const { data: regResult, error: regError } = await supabase.rpc('complete_event_registration', {
      p_landing_page_id: landing_page_id,
      p_email: email,
      p_first_name: first_name,
      p_last_name: last_name,
      p_phone: phone || null,
      p_user_id: userId,
      p_association_id: validation.association_id || null,
      p_coupon_id: validation.coupon_id || null,
      p_original_amount: validation.original_amount || 0,
      p_discount_amount: validation.discount_amount || 0,
      p_final_amount: validation.final_amount || 0,
      p_registration_data: registration_data || {},
      p_utm_source: finalUtmSource,
      p_utm_medium: finalUtmMedium,
      p_utm_campaign: finalUtmCampaign,
    });

    if (regError || !regResult?.success) {
      console.error('Registration RPC error:', regError || regResult?.error);
      return new Response(
        JSON.stringify({ error: 'Failed to create registration record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // Send welcome email (Resend API — only for new users)
    // ============================================================
    if (isNewUser && password) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const eventTitle = validation.landing_page_title;
        const eventDate = formatEventDate(validation.event_date);
        const eventTime = validation.event_time || 'Details to be announced';
        const eventVenue = validation.event_venue || 'Details to be announced';
        const portalUrl = 'https://smb-connect-hub.lovable.app/auth/login';

        try {
          const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 650px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3d7ab5 100%); padding: 40px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to ${eventTitle}!</h1>
    <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 14px;">Your registration is confirmed</p>
  </div>
  <div style="background: #ffffff; padding: 35px 30px;">
    <p style="font-size: 16px;">Dear <strong>${first_name}</strong>,</p>
    <p style="font-size: 15px; color: #444;">Thank you for registering for <strong>${eventTitle}</strong>! We're excited to have you join the vibrant ecosystem of D2C founders, brand leaders, investors, and industry enablers.</p>
    <p style="font-size: 15px; color: #444;">This registration also gives you exclusive access to the <strong>SMBConnect Portal</strong> — your gateway to meaningful business connections.</p>
    <div style="margin: 30px 0;">
      <h2 style="font-size: 16px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; display: inline-block;">📌 EVENT DETAILS</h2>
      <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px;">
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #64748b; width: 120px;">Event</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${eventTitle}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #64748b;">Date</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${eventDate}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #64748b;">Time</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${eventTime}</td></tr>
        <tr><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Venue</td><td style="padding: 12px 16px;">${eventVenue}</td></tr>
      </table>
    </div>
    <div style="margin: 30px 0;">
      <h2 style="font-size: 16px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; display: inline-block;">🌐 YOUR SMBCONNECT PORTAL ACCESS</h2>
      <table style="width: 100%; border-collapse: collapse; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #bae6fd; font-weight: 600; color: #0369a1;">Portal URL</td><td style="padding: 12px 16px; border-bottom: 1px solid #bae6fd;"><a href="${portalUrl}" style="color: #0284c7;">${portalUrl}</a></td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #bae6fd; font-weight: 600; color: #0369a1;">Username</td><td style="padding: 12px 16px; font-family: monospace;">${email}</td></tr>
        <tr><td style="padding: 12px 16px; font-weight: 600; color: #0369a1;">Temporary Password</td><td style="padding: 12px 16px;"><code style="background: #fff; padding: 4px 10px; border-radius: 4px; font-family: monospace; border: 1px solid #e2e8f0;">${password}</code></td></tr>
      </table>
      <p style="font-size: 13px; color: #dc2626; margin: 10px 0 0 0;">⚠️ For security, please update your password after your first login.</p>
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

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'SMB Connect <noreply@smbconnect.in>',
              to: [email],
              subject: `Welcome to ${eventTitle} & Your SMBConnect Portal Access`,
              html: emailHtml,
            }),
          });
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isNewUser
          ? 'Registration successful! Check your email for login credentials.'
          : 'Registration successful! You can login with your existing account.',
        registration_id: regResult.registration_id,
        is_new_user: isNewUser
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-event-registration:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
