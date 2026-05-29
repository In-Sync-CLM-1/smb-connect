import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { invitation_id, reason } = body;

    if (!invitation_id) {
      throw new Error('Missing required field: invitation_id');
    }

    console.log('Revoking invitation:', invitation_id);

    // Fetch invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('member_invitations')
      .select('*')
      .eq('id', invitation_id)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      throw new Error('Invitation not found or cannot be revoked');
    }

    // Verify user has permission
    if (invitation.organization_type === 'company') {
      const { data: memberCheck } = await supabase
        .from('members')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', invitation.organization_id)
        .in('role', ['owner', 'admin'])
        .single();

      if (!memberCheck) {
        throw new Error('Unauthorized: User cannot revoke this invitation');
      }
    } else if (invitation.organization_type === 'association') {
      const { data: managerCheck } = await supabase
        .from('association_managers')
        .select('id')
        .eq('user_id', user.id)
        .eq('association_id', invitation.organization_id)
        .single();

      if (!managerCheck) {
        throw new Error('Unauthorized: User cannot revoke this invitation');
      }
    }

    // Update invitation status to revoked
    const { error: updateError } = await supabase
      .from('member_invitations')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq('id', invitation_id)
      .eq('status', 'pending');

    if (updateError) {
      console.error('Error revoking invitation:', updateError);
      throw updateError;
    }

    console.log('Invitation revoked successfully');

    // Log audit trail
    await supabase
      .from('member_invitation_audit')
      .insert({
        invitation_id: invitation_id,
        action: 'revoked',
        performed_by: user.id,
        notes: reason || 'Invitation revoked'
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation revoked successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in revoke-member-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.message.includes('Unauthorized') ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
