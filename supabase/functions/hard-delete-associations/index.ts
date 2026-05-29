import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HardDeleteRequest {
  associationIds: string[];
  password: string;
  notes: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get current user using the JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { associationIds, password, notes }: HardDeleteRequest = await req.json();

    if (!associationIds || !Array.isArray(associationIds) || associationIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Association IDs array is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!password || !notes) {
      return new Response(
        JSON.stringify({ error: 'Password and notes are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify password (requires Auth API — cannot be done in PostgreSQL)
    const { error: authError } = await supabaseClient.auth.signInWithPassword({
      email: user.email!,
      password: password
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Delegate all DB operations to RPC (single call replaces N*7 sequential roundtrips)
    const { data, error: rpcError } = await supabaseAdmin.rpc('hard_delete_associations', {
      p_association_ids: associationIds,
      p_user_id: user.id,
      p_notes: notes,
    });

    if (rpcError) throw rpcError;

    if (data?.error) {
      return new Response(
        JSON.stringify({ error: data.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Hard delete associations error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});