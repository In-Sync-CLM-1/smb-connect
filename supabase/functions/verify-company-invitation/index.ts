import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Verifying company invitation with token:', token);

    // Query company_invitations using service role to bypass RLS
    const { data: invitation, error: invitationError } = await supabase
      .from('company_invitations')
      .select(`
        *,
        associations:association_id (
          id,
          name
        )
      `)
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      console.error('Invitation not found:', invitationError);
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Invitation not found or invalid' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if invitation is expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < now) {
      console.log('Invitation expired:', { expiresAt, now });
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'This invitation has expired' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if invitation is already accepted
    if (invitation.status === 'accepted') {
      console.log('Invitation already accepted');
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'This invitation has already been accepted' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return valid invitation details
    return new Response(
      JSON.stringify({
        valid: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          company_name: invitation.company_name,
          association_id: invitation.association_id,
          association_name: invitation.associations?.name,
          expires_at: invitation.expires_at,
          status: invitation.status
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error verifying company invitation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
