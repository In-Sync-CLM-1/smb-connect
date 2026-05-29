import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkWhatsAppRequest {
  listId: string;
  message: string;
  senderPhone: string;
  senderName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXOTEL_SID = Deno.env.get('EXOTEL_SID');
    const EXOTEL_API_KEY = Deno.env.get('EXOTEL_API_KEY');
    const EXOTEL_API_TOKEN = Deno.env.get('EXOTEL_API_TOKEN');
    const EXOTEL_SENDER_NUMBER = Deno.env.get('EXOTEL_SENDER_NUMBER');

    if (!EXOTEL_SID || !EXOTEL_API_KEY || !EXOTEL_API_TOKEN || !EXOTEL_SENDER_NUMBER) {
      throw new Error('Exotel credentials are not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const messageData: BulkWhatsAppRequest = await req.json();
    console.log('Sending bulk WhatsApp to list:', messageData.listId);

    // Get all recipients from the list
    const { data: recipients, error: recipientsError } = await supabase
      .from('whatsapp_list_recipients')
      .select('phone, name')
      .eq('list_id', messageData.listId);

    if (recipientsError) throw recipientsError;

    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients found in list');
    }

    console.log(`Sending to ${recipients.length} recipients`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send WhatsApp messages in batches via Exotel
    const BATCH_SIZE = 15;
    const REQUEST_TIMEOUT = 30000;
    const senderNumber = EXOTEL_SENDER_NUMBER.replace(/^\+/, '');
    const exotelUrl = `https://api.exotel.com/v2/accounts/${EXOTEL_SID}/messages`;
    const auth = btoa(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`);

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (recipient) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

            const recipientPhone = recipient.phone.replace(/^\+/, '');
            const exotelPayload = {
              custom_data: senderNumber,
              whatsapp: {
                messages: [
                  {
                    from: senderNumber,
                    to: recipientPhone,
                    content: {
                      recipient_type: "individual",
                      type: "text",
                      text: {
                        body: messageData.message,
                        preview_url: false,
                      },
                    },
                  },
                ],
              },
            };

            const exotelResponse = await fetch(exotelUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(exotelPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!exotelResponse.ok) {
              const errorText = await exotelResponse.text();
              console.error(`Failed to send to ${recipient.phone}:`, errorText);
              results.failed++;
              results.errors.push(`${recipient.phone}: ${errorText}`);
            } else {
              results.sent++;
            }
          } catch (error: any) {
            console.error(`Error sending to ${recipient.phone}:`, error);
            results.failed++;
            results.errors.push(`${recipient.phone}: ${error.message}`);
          }
        })
      );

      // Add delay between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('Bulk send complete:', results);

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
    console.error('Error in send-bulk-whatsapp function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
