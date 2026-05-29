import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SHA-256 hash for token verification
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
    const { token } = body;

    if (!token || token.length !== 64) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verifying invitation token');

    // Hash the token to match database
    const tokenHash = await hashToken(token);

    // Query invitation by token hash
    const { data: invitation, error: inviteError } = await supabase
      .from('member_invitations')
      .select(`
        id,
        email,
        first_name,
        last_name,
        organization_id,
        organization_type,
        role,
        designation,
        department,
        status,
        expires_at,
        accepted_at
      `)
      .eq('token_hash', tokenHash)
      .single();

    if (inviteError || !invitation) {
      console.log('Invitation not found for token hash');
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid or expired invitation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already accepted
    if (invitation.status === 'accepted') {
      return new Response(
        JSON.stringify({ valid: false, error: 'This invitation has already been used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if revoked
    if (invitation.status === 'revoked') {
      return new Response(
        JSON.stringify({ valid: false, error: 'This invitation has been revoked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < now) {
      // Auto-update status to expired
      await supabase
        .from('member_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return new Response(
        JSON.stringify({ valid: false, error: 'This invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch organization name
    let organizationName = '';
    if (invitation.organization_type === 'company') {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', invitation.organization_id)
        .single();
      organizationName = company?.name || 'Unknown Company';
    } else {
      const { data: association } = await supabase
        .from('associations')
        .select('name')
        .eq('id', invitation.organization_id)
        .single();
      organizationName = association?.name || 'Unknown Association';
    }

    console.log('Invitation verified successfully:', invitation.id);

    // Log audit trail (viewed action)
    await supabase
      .from('member_invitation_audit')
      .insert({
        invitation_id: invitation.id,
        action: 'viewed',
        notes: 'Invitation token verified from registration page'
      });

    // Return safe invitation details
    return new Response(
      JSON.stringify({
        valid: true,
        email: invitation.email,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        organization_name: organizationName,
        organization_id: invitation.organization_id,
        organization_type: invitation.organization_type,
        role: invitation.role,
        designation: invitation.designation,
        department: invitation.department,
        expires_at: invitation.expires_at
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-member-invitation:', error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
