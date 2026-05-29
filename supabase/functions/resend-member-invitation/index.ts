import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getOrgFromAddress } from "../_shared/email-from.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const appUrl = Deno.env.get('APP_URL') || 'https://smbconnect.in';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { invitation_id } = body;

    if (!invitation_id) {
      throw new Error('Missing required field: invitation_id');
    }

    // Single RPC call: fetch + verify permissions + update token + get org name + audit
    // Replaces 6 sequential DB roundtrips
    const { data: rpcResult, error: rpcError } = await supabase.rpc('resend_member_invitation_db', {
      p_user_id: user.id,
      p_invitation_id: invitation_id,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw new Error('Failed to resend invitation');
    }

    if (!rpcResult.success) {
      return new Response(
        JSON.stringify({ error: rpcResult.error }),
        { status: rpcResult.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email using raw token from RPC (never persisted in DB)
    const registrationUrl = `${appUrl}/register?token=${rpcResult.raw_token}&org=${rpcResult.organization_id}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔄 Invitation Reminder</h1>
            </div>
            <div class="content">
              <p>Hello${rpcResult.first_name ? ' ' + rpcResult.first_name : ''},</p>
              <p>This is a reminder about your invitation to join <strong>${rpcResult.organization_name}</strong> on SMB Connect.</p>
              <div class="info-box">
                <p><strong>Role:</strong> ${rpcResult.role.charAt(0).toUpperCase() + rpcResult.role.slice(1)}</p>
                ${rpcResult.designation ? `<p><strong>Designation:</strong> ${rpcResult.designation}</p>` : ''}
                ${rpcResult.department ? `<p><strong>Department:</strong> ${rpcResult.department}</p>` : ''}
              </div>
              <p>We've generated a new registration link for you. This invitation expires in <strong>48 hours</strong>.</p>
              <div style="text-align: center;">
                <a href="${registrationUrl}" class="button">Complete Registration</a>
              </div>
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${registrationUrl}">${registrationUrl}</a>
              </p>
            </div>
            <div class="footer">
              <p>© 2025 SMB Connect. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data: invitationRow } = await supabase
      .from('member_invitations')
      .select('organization_id, organization_type')
      .eq('id', invitation_id)
      .maybeSingle();
    const fromAddress = await getOrgFromAddress(
      supabase,
      invitationRow
        ? { type: invitationRow.organization_type as 'association' | 'company', id: invitationRow.organization_id }
        : null,
      { displayName: rpcResult.organization_name },
    );

    try {
      await resend.emails.send({
        from: fromAddress,
        to: [rpcResult.invitation_email],
        subject: `Reminder: Join ${rpcResult.organization_name} on SMB Connect`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      throw new Error('Failed to send email');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Invitation resent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in resend-member-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.message.includes('Unauthorized') ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
