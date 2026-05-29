import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsAppRequest {
  conversationId?: string;
  recipientPhone: string;
  recipientName?: string;
  message: string;
  senderPhone: string;
  senderName: string;
  senderId: string;
  senderType: 'association' | 'company';
  recipientId: string;
  recipientType: 'company' | 'member';
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

    const messageData: SendWhatsAppRequest = await req.json();
    console.log('Sending WhatsApp message to:', messageData.recipientPhone);

    let conversationId = messageData.conversationId;

    // Create or update conversation
    if (!conversationId) {
      const { data: newConversation, error: conversationError } = await supabase
        .from('whatsapp_conversations')
        .insert({
          sender_id: messageData.senderId,
          sender_type: messageData.senderType,
          recipient_id: messageData.recipientId,
          recipient_type: messageData.recipientType,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (conversationError) throw conversationError;
      conversationId = newConversation.id;
    } else {
      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    // Send WhatsApp message via Exotel
    const exotelUrl = `https://api.exotel.com/v2/accounts/${EXOTEL_SID}/messages`;
    const auth = btoa(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`);

    const senderNumber = EXOTEL_SENDER_NUMBER.replace(/^\+/, '');
    const recipientPhone = messageData.recipientPhone.replace(/^\+/, '');

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
    });

    if (!exotelResponse.ok) {
      const errorText = await exotelResponse.text();
      console.error('Exotel error:', errorText);
      throw new Error(`Failed to send WhatsApp message: ${errorText}`);
    }

    const exotelData = await exotelResponse.json();
    console.log('Exotel response:', exotelData);

    const externalMessageId = exotelData?.response?.whatsapp?.messages?.[0]?.data?.sid || null;

    // Store message in database
    const { data: message, error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        sender_phone: EXOTEL_SENDER_NUMBER,
        sender_name: messageData.senderName,
        recipient_phone: messageData.recipientPhone,
        body_text: messageData.message,
        direction: 'outbound',
        external_message_id: externalMessageId,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (messageError) throw messageError;

    return new Response(
      JSON.stringify({
        success: true,
        conversationId,
        messageId: message.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-whatsapp function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
