import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ResetPasswordRequest {
  userId: string;
  newPassword?: string;
  sendResetEmail?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Verify caller identity using admin client (reliable, no session needed)
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !caller) {
      console.error('Authentication error:', callerError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = caller.id;
    const callerEmail = caller.email;

    // Verify user is an admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('is_active, is_super_admin')
      .eq('user_id', callerUserId)
      .maybeSingle();

    if (adminError || !adminData?.is_active) {
      console.error('Admin verification error:', adminError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, newPassword, sendResetEmail }: ResetPasswordRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    let action;

    if (sendResetEmail) {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email!,
        options: {
          redirectTo: `${Deno.env.get('VITE_SUPABASE_URL')?.replace('supabase.co', 'lovable.app') || 'https://smb-connect-hub.lovable.app'}/reset-password`
        }
      });

      if (error) {
        console.error('Error generating reset link:', error);
        throw error;
      }

      result = { resetLink: data.properties.action_link };
      action = 'sent_reset_email';
      
    } else if (newPassword) {
      if (newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 8 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (error) {
        console.error('Error updating password:', error);
        throw error;
      }

      result = { success: true };
      action = 'reset_password';
      
    } else {
      return new Response(
        JSON.stringify({ error: 'Either newPassword or sendResetEmail must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action in audit_logs using admin client
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: callerUserId,
        action: action,
        resource: 'user_password',
        resource_id: userId,
        changes: {
          admin_email: callerEmail,
          target_user_id: userId,
          method: sendResetEmail ? 'email_reset_link' : 'manual_password_set'
        },
      });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-reset-user-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
