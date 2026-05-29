import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkEmailRequest {
  listId: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  senderEmail: string;
  senderName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(RESEND_API_KEY);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailData: BulkEmailRequest = await req.json();

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token || '');
    
    if (authError || !user?.email) {
      throw new Error('Unauthorized: cannot determine logged-in sender');
    }
    const replyToEmail = user.email;

    // ============================================================
    // Setup campaign via RPC (4 DB roundtrips → 1)
    // Fetches recipients, validates limits, creates campaign + recipient records
    // ============================================================
    const { data: setupResult, error: setupError } = await supabase.rpc('setup_email_campaign', {
      p_user_id: user.id,
      p_list_id: emailData.listId,
      p_subject: emailData.subject,
      p_sender_name: emailData.senderName || 'SMB Connect',
      p_sender_email: emailData.senderEmail,
    });

    if (setupError) {
      throw new Error(`Failed to setup campaign: ${setupError.message}`);
    }

    if (!setupResult.success) {
      return new Response(
        JSON.stringify({ error: setupResult.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const campaign = { id: setupResult.campaign_id };
    const recipients = setupResult.recipients as { email: string; name: string }[];

    const applyMergeTags = (input: string, ctx: { name: string; email: string }) =>
      input
        .replaceAll('{{name}}', ctx.name ?? '')
        .replaceAll('{{email}}', ctx.email ?? '');

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send emails sequentially with rate limiting
    // Resend limits: 2 requests/second, 100 emails/minute
    // Using 600ms delay = 1.67 requests/sec = 100 emails/min
    const DELAY_BETWEEN_EMAILS = 600; // milliseconds
    const REQUEST_TIMEOUT = 30000; // 30 seconds per request

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
      );
      
      const sendPromise = (async () => {
        try {
          const personalisedHtml = applyMergeTags(emailData.bodyHtml, recipient);
          const personalisedSubject = applyMergeTags(emailData.subject, recipient);
          const personalisedText = emailData.bodyText
            ? applyMergeTags(emailData.bodyText, recipient)
            : personalisedHtml.replace(/<[^>]*>/g, '');

          const { data: emailResult, error: emailError } = await resend.emails.send({
            from: `${emailData.senderName || 'SMB Connect'} <noreply@smbconnect.in>`,
            to: [recipient.email],
            subject: personalisedSubject,
            html: personalisedHtml,
            text: personalisedText,
            reply_to: replyToEmail,
            headers: {
              'X-Bulk-List-ID': emailData.listId,
              'X-Campaign-ID': campaign.id,
            },
          });

          if (emailError) {
            results.failed++;
            results.errors.push(`${recipient.email}: ${emailError.message}`);
            return;
          }

          if (!emailResult) {
            results.failed++;
            results.errors.push(`${recipient.email}: No result from Resend`);
            return;
          }

          // Update recipient record with sent status
          const { error: updateError } = await supabase
            .from('email_campaign_recipients')
            .update({
              sent: true,
              sent_at: new Date().toISOString(),
              external_message_id: emailResult.id,
            })
            .eq('campaign_id', campaign.id)
            .eq('email', recipient.email);

          if (updateError) { /* non-blocking */ }

          // Insert sent event
          const { error: eventError } = await supabase
            .from('email_campaign_events')
            .insert({
              campaign_id: campaign.id,
              recipient_email: recipient.email,
              event_type: 'sent',
              external_message_id: emailResult.id,
            });

          if (eventError) { /* non-blocking */ }

          results.sent++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${recipient.email}: ${error.message}`);
        }
      })();

      try {
        await Promise.race([sendPromise, timeoutPromise]);
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${recipient.email}: ${error.message}`);
      }

      // Rate limiting: wait before sending next email (except for last one)
      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
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
});
