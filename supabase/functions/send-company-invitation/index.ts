import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getOrgFromAddress } from "../_shared/email-from.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationEmailRequest {
  invitationId: string;
  companyName: string;
  recipientEmail: string;
  invitedByName: string;
  invitedByEmail: string;
  associationName: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(RESEND_API_KEY);

    const inviteData: InvitationEmailRequest = await req.json();

    // Use the production app URL for invitation links
    const appUrl = Deno.env.get('APP_URL') || 'https://smbconnect.in';
    const acceptUrl = `${appUrl}/accept-invitation?token=${inviteData.token}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Company Invitation</h1>
            </div>
            <div class="content">
              <h2>You've been invited by ${inviteData.associationName}</h2>
              <p>Hello,</p>
              <p><strong>${inviteData.invitedByName}</strong> (${inviteData.invitedByEmail}) from <strong>${inviteData.associationName}</strong> has invited you to register <strong>${inviteData.companyName}</strong> on SMB Connect.</p>
              <p>Click the button below to accept this invitation:</p>
              <p style="text-align: center;">
                <a href="${acceptUrl}" class="button">Accept Invitation</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">${acceptUrl}</p>
              <p><strong>Note:</strong> This invitation will expire in 7 days.</p>
            </div>
            <div class="footer">
              <p>Best regards,<br>SMB Connect Team</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data: invitationRow } = await supabase
      .from('company_invitations')
      .select('association_id')
      .eq('id', inviteData.invitationId)
      .maybeSingle();
    const fromAddress = await getOrgFromAddress(
      supabase,
      invitationRow?.association_id
        ? { type: 'association', id: invitationRow.association_id }
        : null,
      { displayName: inviteData.associationName },
    );

    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: [inviteData.recipientEmail],
      subject: `Invitation from ${inviteData.associationName} to join SMB Connect`,
      html: emailHtml,
      reply_to: inviteData.invitedByEmail,
      headers: {
        'X-Invitation-ID': inviteData.invitationId,
      },
    });

    // Check if Resend returned an error
    if (emailResponse.error) {
      throw new Error(emailResponse.error.message || 'Failed to send email via Resend');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: emailResponse.data?.id 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

serve(handler);
