import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event: string;
  message_id: string;
  from_email: string;
  from_name?: string;
  to_email: string;
  subject: string;
  body_html?: string;
  body_text?: string;
  headers?: Record<string, string>;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const webhookData: WebhookPayload = await req.json();
    console.log('Received email webhook:', {
      event: webhookData.event,
      from: webhookData.from_email,
      to: webhookData.to_email,
      subject: webhookData.subject,
    });

    // Only process incoming emails (replies)
    if (webhookData.event !== 'email.received' && webhookData.event !== 'inbound') {
      console.log('Skipping non-inbound event:', webhookData.event);
      return new Response(
        JSON.stringify({ success: true, message: 'Event acknowledged but not processed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Try to find existing conversation by checking custom headers
    let conversationId = webhookData.headers?.['X-Conversation-ID'];

    // If no conversation ID in headers, try to find by subject or sender/recipient
    if (!conversationId) {
      // Look for existing conversation by matching subject and participants
      const { data: existingConvs } = await supabase
        .from('email_conversations')
        .select('id, subject')
        .or(`subject.eq.${webhookData.subject},subject.eq.Re: ${webhookData.subject}`)
        .limit(10);

      if (existingConvs && existingConvs.length > 0) {
        // Try to match by checking if sender/recipient emails are in the conversation
        const { data: messages } = await supabase
          .from('email_messages')
          .select('conversation_id')
          .in('conversation_id', existingConvs.map(c => c.id))
          .or(`sender_email.eq.${webhookData.from_email},recipient_email.eq.${webhookData.from_email}`)
          .limit(1);

        if (messages && messages.length > 0) {
          conversationId = messages[0].conversation_id;
        }
      }
    }

    if (!conversationId) {
      console.log('No conversation found for reply, email may be orphaned');
      // You might want to handle orphaned replies differently
      return new Response(
        JSON.stringify({ success: true, message: 'No matching conversation found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Store the inbound message
    const { error: msgError } = await supabase
      .from('email_messages')
      .insert({
        conversation_id: conversationId,
        sender_email: webhookData.from_email,
        recipient_email: webhookData.to_email,
        subject: webhookData.subject,
        body_html: webhookData.body_html || '',
        body_text: webhookData.body_text || '',
        direction: 'inbound',
        external_message_id: webhookData.message_id,
        sender_name: webhookData.from_name || webhookData.from_email,
        is_read: false,
      });

    if (msgError) {
      console.error('Failed to store inbound message:', msgError);
      throw msgError;
    }

    // Update conversation's last_message_at
    await supabase
      .from('email_conversations')
      .update({ last_message_at: new Date(webhookData.timestamp).toISOString() })
      .eq('id', conversationId);

    console.log('Inbound email stored successfully');

    return new Response(
      JSON.stringify({ success: true, conversationId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in receive-email webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
