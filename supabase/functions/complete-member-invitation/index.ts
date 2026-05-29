import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { token, password, first_name, last_name } = body;

    if (!token || !password) {
      throw new Error('Missing required fields: token and password');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // ============================================================
    // Step 1: Verify invitation via existing RPC (1 call instead of 2)
    // ============================================================
    const { data: verification, error: verifyError } = await supabase.rpc('verify_member_invitation', {
      p_token: token,
    });

    if (verifyError) {
      console.error('Verification RPC error:', verifyError);
      throw new Error('Invalid or expired invitation');
    }

    if (!verification?.valid) {
      throw new Error(verification?.error || 'Invalid or expired invitation');
    }

    const invitation = verification.invitation || verification;
    const invitationId = invitation.invitation_id || invitation.id;
    const invitationEmail = invitation.email;

    // ============================================================
    // Step 2: Check if user already exists (Auth Admin API)
    // ============================================================
    const normalizedEmail = invitationEmail.trim().toLowerCase();

    const { data: profileMatches } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', normalizedEmail);

    let existingUser = null;
    if (profileMatches && profileMatches.length === 1) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profileMatches[0].id);
      if (authUser && authUser.email?.toLowerCase() === normalizedEmail) {
        existingUser = authUser;
      }
    }

    // Fallback: paginated auth scan
    if (!existingUser && (!profileMatches || profileMatches.length === 0)) {
      let page = 1;
      const perPage = 50;
      let found = false;
      while (!found) {
        const { data: { users } } = await supabase.auth.admin.listUsers({ page, perPage });
        if (!users || users.length === 0) break;
        const match = users.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (match) { existingUser = match; found = true; }
        if (users.length < perPage) break;
        page++;
      }
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'An account with this email already exists. Please sign in instead.',
          code: 'user_exists',
          existing_user: true
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // Step 3: Create Auth user
    // ============================================================
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitationEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: first_name || invitation.first_name,
        last_name: last_name || invitation.last_name,
      }
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'An account with this email already exists. Please sign in instead.',
            code: 'user_exists',
            existing_user: true
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to create user account: ${authError?.message || 'Unknown error'}`);
    }

    // ============================================================
    // Step 4: Complete via RPC (member creation + invitation update + audit)
    // Replaces 3-4 sequential DB calls with 1 atomic RPC
    // If this fails, we roll back the auth user
    // ============================================================
    const { data: completeResult, error: completeError } = await supabase.rpc('complete_member_invitation_db', {
      p_invitation_id: invitationId,
      p_user_id: authData.user.id,
      p_first_name: first_name || null,
      p_last_name: last_name || null,
    });

    if (completeError || !completeResult?.success) {
      console.error('Complete RPC error:', completeError || completeResult?.error);
      // Rollback: delete auth user
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('Failed to rollback user creation:', deleteError);
      }
      throw new Error(completeResult?.error || 'Failed to complete registration');
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        message: 'Registration completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in complete-member-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
