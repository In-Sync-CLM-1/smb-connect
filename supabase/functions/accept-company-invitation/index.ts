import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, userId } = await req.json();

    if (!token || !userId) {
      return new Response(
        JSON.stringify({ error: 'Token and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify user email via Auth Admin (cannot be done in PostgreSQL)
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user || !user.email) {
      return new Response(
        JSON.stringify({ error: 'Email does not match invitation' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Delegate all DB operations to RPC (single atomic transaction)
    // Replaces: 5 sequential DB roundtrips with race condition vulnerability
    // RPC uses FOR UPDATE lock to prevent concurrent duplicate company creation
    const { data, error: rpcError } = await supabase.rpc('accept_company_invitation', {
      p_token: token,
      p_user_id: userId,
      p_user_email: user.email,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!data?.success) {
      const status = data?.error?.includes('not found') ? 404
        : data?.error?.includes('Email') ? 403
        : 400;
      return new Response(
        JSON.stringify({ error: data?.error || 'Failed to accept invitation' }),
        {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
