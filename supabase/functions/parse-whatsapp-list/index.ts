import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseWhatsAppListRequest {
  listId: string;
  csvContent: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { listId, csvContent }: ParseWhatsAppListRequest = await req.json();
    console.log('Parsing WhatsApp list CSV for list:', listId);

    // Parse CSV content
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Skip header row
    const dataLines = lines.slice(1);
    const recipients = [];

    for (const line of dataLines) {
      const [phone, name] = line.split(',').map(val => val.trim());
      
      if (!phone) continue;

      // Basic phone validation (should start with + and contain only digits)
      const cleanPhone = phone.replace(/\s/g, '');
      if (!cleanPhone.match(/^\+\d{10,15}$/)) {
        console.warn(`Invalid phone format: ${phone}`);
        continue;
      }

      recipients.push({
        list_id: listId,
        phone: cleanPhone,
        name: name || null,
      });
    }

    if (recipients.length === 0) {
      throw new Error('No valid recipients found in CSV');
    }

    console.log(`Inserting ${recipients.length} recipients`);

    // Insert recipients
    const { error: insertError } = await supabase
      .from('whatsapp_list_recipients')
      .insert(recipients);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        count: recipients.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in parse-whatsapp-list function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
