import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HardDeleteRequest {
  userIds: string[];
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

    // Authenticate user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { userIds, password, notes }: HardDeleteRequest = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User IDs array is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!password || !notes) {
      return new Response(
        JSON.stringify({ error: 'Password and notes are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify password
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

    // ============================================================
    // Step 1: Delete all DB records via RPC (1 call instead of N*5)
    // ============================================================
    const { data: dbResult, error: rpcError } = await supabaseAdmin.rpc('hard_delete_users_db', {
      p_admin_user_id: user.id,
      p_user_ids: userIds,
      p_notes: notes,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user records' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // ============================================================
    // Step 2: Delete auth users (requires Auth Admin API)
    // ============================================================
    let authSuccessCount = 0;
    let authFailCount = 0;
    const authErrors: string[] = [];

    // Process auth deletions in parallel batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (userId) => {
        try {
          const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (error) throw error;
          authSuccessCount++;
        } catch (error: any) {
          authFailCount++;
          authErrors.push(`${userId}: ${error.message}`);
        }
      }));
    }

    return new Response(
      JSON.stringify({
        success: dbResult.success,
        failed: dbResult.failed + authFailCount,
        errors: [...(dbResult.errors || []).filter((e: string) => e), ...authErrors].slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Hard delete users error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
