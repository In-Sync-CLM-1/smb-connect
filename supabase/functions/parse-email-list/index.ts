import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseEmailListRequest {
  listId: string;
  fileContent: string; // Base64 encoded CSV content
  fileName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { listId, fileContent, fileName }: ParseEmailListRequest = await req.json();
    console.log('Parsing email list file:', fileName);

    // Decode base64 content
    const decodedContent = atob(fileContent);
    
    // Parse CSV content
    const lines = decodedContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIndex = headers.findIndex(h => h === 'email' || h === 'e-mail' || h === 'email address');
    const nameIndex = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname');

    if (emailIndex === -1) {
      throw new Error('CSV must have an "email" column');
    }

    // Parse data rows
    const recipients = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Simple CSV parsing (handles basic cases)
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      
      const email = values[emailIndex]?.trim();
      if (!email) {
        errors.push(`Row ${i + 1}: Missing email`);
        continue;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Row ${i + 1}: Invalid email format: ${email}`);
        continue;
      }

      const name = nameIndex >= 0 ? values[nameIndex]?.trim() : null;
      
      // Collect any additional columns as metadata
      const metadata: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (idx !== emailIndex && idx !== nameIndex && values[idx]) {
          metadata[header] = values[idx];
        }
      });

      recipients.push({
        list_id: listId,
        email,
        name: name || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      });
    }

    console.log(`Parsed ${recipients.length} recipients, ${errors.length} errors`);

    // Insert recipients in batches
    if (recipients.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const { error } = await supabase
          .from('email_list_recipients')
          .insert(batch);

        if (error) {
          console.error('Error inserting batch:', error);
          throw error;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: recipients.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in parse-email-list function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
