import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Resend webhook event structure
interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 
        'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: { link: string };
    bounce?: { type: string; message: string };
  };
}

// Verify Resend webhook signature using Svix format
async function verifyWebhookSignature(
  payload: string,
  headers: Headers,
  secret: string
): Promise<boolean> {
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Missing svix headers');
    return false;
  }

  // Check timestamp is recent (within 5 minutes)
  const timestamp = parseInt(svixTimestamp);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.error('Webhook timestamp too old or too far in future');
    return false;
  }

  // Construct the signed content
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;

  // Remove whsec_ prefix from secret
  const secretKey = secret.startsWith('whsec_') ? secret.substring(6) : secret;

  // Create HMAC signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedContent)
  );

  // Convert to base64
  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  );

  // Resend sends multiple signatures (v1), extract and compare
  const signatures = svixSignature.split(' ');
  for (const versionedSig of signatures) {
    const [version, sig] = versionedSig.split(',');
    if (version === 'v1' && sig === expectedSignature) {
      console.log('Webhook signature verified ✓');
      return true;
    }
  }

  console.error('Signature mismatch');
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EMAIL WEBHOOK RECEIVED ===');
    
    // Get the raw body for signature verification
    const rawBody = await req.text();
    
    // Verify webhook signature
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('RESEND_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const isValid = await verifyWebhookSignature(
      rawBody,
      req.headers,
      webhookSecret
    );

    if (!isValid) {
      console.error('❌ Invalid webhook signature - possible security threat');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    console.log('✅ Webhook signature verified - processing event');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the JSON after verification
    const webhookData: ResendWebhookEvent = JSON.parse(rawBody);
    console.log('Event type:', webhookData.type);
    console.log('Email ID:', webhookData.data.email_id);
    console.log('To:', webhookData.data.to);

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
    };

    const ourEventType = eventTypeMap[webhookData.type];
    if (!ourEventType) {
      console.log('Ignoring unknown event type:', webhookData.type);
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log('Mapped to event type:', ourEventType);

    // Find the recipient by external_message_id
    console.log('=== FINDING RECIPIENT ===');
    const { data: recipient, error: recipientError } = await supabase
      .from('email_campaign_recipients')
      .select('*')
      .eq('external_message_id', webhookData.data.email_id)
      .single();

    if (recipientError || !recipient) {
      console.error('Recipient not found:', recipientError);
      return new Response(
        JSON.stringify({ error: 'Recipient not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    console.log('Found recipient:', recipient.email, 'Campaign:', recipient.campaign_id);

    // Update recipient based on event type
    console.log('=== UPDATING RECIPIENT STATUS ===');
    const updates: any = {};
    
    switch (ourEventType) {
      case 'delivered':
        updates.delivered = true;
        updates.delivered_at = webhookData.created_at;
        break;
      case 'opened':
        updates.opened = true;
        if (!recipient.first_opened_at) {
          updates.first_opened_at = webhookData.created_at;
        }
        updates.last_opened_at = webhookData.created_at;
        break;
      case 'clicked':
        updates.clicked = true;
        if (!recipient.first_clicked_at) {
          updates.first_clicked_at = webhookData.created_at;
        }
        updates.last_clicked_at = webhookData.created_at;
        break;
      case 'bounced':
        updates.bounced = true;
        updates.bounced_at = webhookData.created_at;
        break;
      case 'complained':
        updates.complained = true;
        break;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('email_campaign_recipients')
        .update(updates)
        .eq('id', recipient.id);

      if (updateError) {
        console.error('Failed to update recipient:', updateError);
      } else {
        console.log('Updated recipient with:', updates);
      }
    }

    // Increment counters for open and click events
    if (ourEventType === 'opened') {
      console.log('Incrementing open count');
      await supabase.rpc('increment_open_count', { recipient_id: recipient.id });
    } else if (ourEventType === 'clicked') {
      console.log('Incrementing click count');
      await supabase.rpc('increment_click_count', { recipient_id: recipient.id });
    }

    // Insert event record
    console.log('=== INSERTING EVENT RECORD ===');
    const { error: eventError } = await supabase
      .from('email_campaign_events')
      .insert({
        campaign_id: recipient.campaign_id,
        recipient_id: recipient.id,
        recipient_email: recipient.email,
        event_type: ourEventType,
        external_message_id: webhookData.data.email_id,
        occurred_at: webhookData.created_at,
        event_data: webhookData.data.click ? { link: webhookData.data.click.link } : 
                    webhookData.data.bounce ? { bounce: webhookData.data.bounce } : null,
      });

    if (eventError) {
      console.error('Failed to insert event:', eventError);
    } else {
      console.log('Event record inserted successfully');
    }

    console.log('=== WEBHOOK PROCESSED SUCCESSFULLY ===');

    return new Response(
      JSON.stringify({ status: 'processed', event_type: ourEventType }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack?.split('\n').slice(0, 5).join('\n'),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
