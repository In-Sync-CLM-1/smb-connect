import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getOrgFromAddress } from "../_shared/email-from.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate cryptographically secure 64-character hex token (bulk path only)
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash for secure token storage (bulk path only)
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildInvitationEmailHtml(
  firstName: string,
  organizationName: string,
  registrationUrl: string,
  role: string,
  designation?: string | null,
  department?: string | null,
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Invited!</h1>
          </div>
          <div class="content">
            <p>Hello${firstName ? ' ' + firstName : ''},</p>
            <p>You've been invited to join <strong>${organizationName}</strong> on SMB Connect!</p>
            <div class="info-box">
              <p><strong>Role:</strong> ${(role || 'member').charAt(0).toUpperCase() + (role || 'member').slice(1)}</p>
              ${designation ? `<p><strong>Designation:</strong> ${designation}</p>` : ''}
              ${department ? `<p><strong>Department:</strong> ${department}</p>` : ''}
            </div>
            <p>Click the button below to complete your registration. This invitation expires in <strong>48 hours</strong>.</p>
            <div style="text-align: center;">
              <a href="${registrationUrl}" class="button">Complete Registration</a>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${registrationUrl}">${registrationUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2025 SMB Connect. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const appUrl = Deno.env.get('APP_URL') || 'https://smbconnect.in';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const {
      email,
      first_name,
      last_name,
      organization_id,
      organization_type,
      role,
      designation,
      department,
      invitations // Array for bulk invitations
    } = body;

    // Check if this is a bulk invitation request
    const isBulk = Array.isArray(invitations);

    // ================================================================
    // BULK INVITATION PATH (permission check done here, inserts done here)
    // ================================================================
    if (isBulk) {
      // Verify user has permission to invite to this organization
      if (organization_type === 'company') {
        const { data: memberCheck } = await supabase
          .from('members')
          .select('role')
          .eq('user_id', user.id)
          .eq('company_id', organization_id)
          .in('role', ['owner', 'admin'])
          .single();

        if (!memberCheck) {
          throw new Error('Unauthorized: User cannot invite to this company');
        }
      } else if (organization_type === 'association') {
        const { data: managerCheck } = await supabase
          .from('association_managers')
          .select('id')
          .eq('user_id', user.id)
          .eq('association_id', organization_id)
          .single();

        if (!managerCheck) {
          throw new Error('Unauthorized: User cannot invite to this association');
        }
      }

      const results = {
        successful: [] as string[],
        failed: [] as { email: string; error: string }[]
      };

      // Validate all invitations first
      const validInvitations = [];
      for (const inv of invitations) {
        if (!inv.email || !inv.first_name || !inv.last_name) {
          results.failed.push({ email: inv.email || 'unknown', error: 'Missing required fields' });
        } else {
          validInvitations.push({
            ...inv,
            email: inv.email.toLowerCase()
          });
        }
      }

      if (validInvitations.length === 0) {
        return new Response(
          JSON.stringify({ success: false, results, message: 'No valid invitations to process' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Batch check for existing pending invitations
      const emails = validInvitations.map(inv => inv.email);
      const firstInvitation = validInvitations[0];

      const { data: existingInvites } = await supabase
        .from('member_invitations')
        .select('email')
        .eq('organization_id', firstInvitation.organization_id)
        .eq('status', 'pending')
        .in('email', emails);

      const existingEmails = new Set((existingInvites || []).map(inv => inv.email));

      const newInvitations = validInvitations.filter(inv => {
        if (existingEmails.has(inv.email)) {
          results.failed.push({ email: inv.email, error: 'Active invitation already exists' });
          return false;
        }
        return true;
      });

      if (newInvitations.length === 0) {
        return new Response(
          JSON.stringify({ success: true, results, message: 'All invitations already exist' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch organization name once
      let organizationName = 'the organization';
      if (firstInvitation.organization_type === 'company') {
        const { data: company } = await supabase
          .from('companies').select('name').eq('id', firstInvitation.organization_id).single();
        if (company) organizationName = company.name;
      } else {
        const { data: association } = await supabase
          .from('associations').select('name').eq('id', firstInvitation.organization_id).single();
        if (association) organizationName = association.name;
      }

      // Prepare invitation records (NO plaintext token stored)
      const invitationRecords = [];
      const tokenMap = new Map<string, string>(); // email -> raw token (for email URLs only)

      for (const inv of newInvitations) {
        try {
          const rawToken = generateToken();
          const tokenHash = await hashToken(rawToken);
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

          tokenMap.set(inv.email, rawToken);

          invitationRecords.push({
            email: inv.email,
            first_name: inv.first_name,
            last_name: inv.last_name,
            organization_id: inv.organization_id,
            organization_type: inv.organization_type,
            role: inv.role || 'member',
            designation: inv.designation || null,
            department: inv.department || null,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
            invited_by: user.id,
            status: 'pending'
          });
        } catch (err: any) {
          results.failed.push({ email: inv.email, error: err.message });
        }
      }

      // Batch insert all invitations
      const { data: insertedInvitations, error: batchInsertError } = await supabase
        .from('member_invitations')
        .insert(invitationRecords)
        .select();

      if (batchInsertError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create invitations: ' + batchInsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Batch insert audit logs
      const auditRecords = insertedInvitations.map(inv => ({
        invitation_id: inv.id,
        action: 'created',
        performed_by: user.id
      }));

      try {
        await supabase.from('member_invitation_audit').insert(auditRecords);
      } catch { /* non-blocking */ }

      // Send all emails in background (fire and forget)
      const emailPromises = insertedInvitations.map(async (invitation) => {
        const rawToken = tokenMap.get(invitation.email);
        if (!rawToken) return;

        const invData = newInvitations.find(inv => inv.email === invitation.email);
        if (!invData) return;

        const registrationUrl = `${appUrl}/register?token=${rawToken}`;
        const emailHtml = buildInvitationEmailHtml(
          invData.first_name, organizationName, registrationUrl,
          invData.role, invData.designation, invData.department,
        );

        try {
          const bulkFromAddress = await getOrgFromAddress(
            supabase,
            { type: firstInvitation.organization_type as 'association' | 'company', id: firstInvitation.organization_id },
            { displayName: organizationName },
          );
          await resend.emails.send({
            from: bulkFromAddress,
            to: [invitation.email],
            subject: `You're invited to join ${organizationName} on SMB Connect`,
            html: emailHtml,
          });
          results.successful.push(invitation.email);
        } catch { /* non-blocking email error */ }
      });

      Promise.all(emailPromises).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true, results,
          message: `Created ${insertedInvitations.length} invitations successfully. Emails are being sent in the background.`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ================================================================
    // SINGLE INVITATION PATH (uses RPC — 6 DB roundtrips → 1 atomic call)
    // RPC handles: permission check, rate limit, dedup, insert, org name, audit
    // Token is generated by pgcrypto in the RPC and NEVER persisted as plaintext
    // ================================================================
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_single_member_invitation', {
      p_user_id: user.id,
      p_email: email,
      p_first_name: first_name,
      p_last_name: last_name,
      p_organization_id: organization_id,
      p_organization_type: organization_type,
      p_role: role,
      p_designation: designation || null,
      p_department: department || null,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw new Error('Failed to create invitation');
    }

    if (!rpcResult.success) {
      return new Response(
        JSON.stringify({ error: rpcResult.error }),
        { status: rpcResult.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send invitation email using the raw token from RPC (never persisted in DB)
    const registrationUrl = `${appUrl}/register?token=${rpcResult.raw_token}`;
    const emailHtml = buildInvitationEmailHtml(
      first_name, rpcResult.organization_name, registrationUrl,
      role, designation, department,
    );

    const singleFromAddress = await getOrgFromAddress(
      supabase,
      { type: organization_type as 'association' | 'company', id: organization_id },
      { displayName: rpcResult.organization_name },
    );
    try {
      await resend.emails.send({
        from: singleFromAddress,
        to: [email],
        subject: `You're invited to join ${rpcResult.organization_name} on SMB Connect`,
        html: emailHtml,
      });
    } catch { /* non-blocking email error */ }

    return new Response(
      JSON.stringify({
        success: true,
        invitation_id: rpcResult.invitation_id,
        message: 'Invitation created and email sent successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.message.includes('Unauthorized') ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
