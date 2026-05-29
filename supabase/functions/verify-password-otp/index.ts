import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, otp, newPassword } = await req.json()

    if (!email || !otp || !newPassword) {
      throw new Error('Email, OTP code, and new password are required')
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedOtp = String(otp).trim()

    console.log('[verify-password-otp] attempt', {
      email: normalizedEmail,
      otp_len: normalizedOtp.length,
      otp_last2: normalizedOtp.slice(-2),
    })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Atomic OTP verification + consumption + user resolution via RPC
    // Eliminates race condition: two concurrent requests cannot use the same OTP
    const { data: otpResult, error: rpcError } = await supabaseAdmin.rpc('verify_and_consume_otp', {
      p_email: normalizedEmail,
      p_otp: normalizedOtp,
    })

    if (rpcError) {
      console.error('[verify-password-otp] RPC error:', rpcError)
      throw new Error('Failed to verify code')
    }

    console.log('[verify-password-otp] rpc result', otpResult)

    if (!otpResult.valid) {
      throw new Error(otpResult.error || 'Invalid or expired verification code')
    }

    let resolvedUserId: string | null = otpResult.user_id || null

    // Fallback: paginated auth scan if profile lookup found no match
    if (!resolvedUserId && otpResult.needs_auth_scan) {
      let page = 1
      const perPage = 50
      let found = false
      while (!found) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        })
        if (listError) break
        if (!users || users.length === 0) break

        const match = users.find(u => u.email?.toLowerCase() === normalizedEmail)
        if (match) {
          resolvedUserId = match.id
          found = true
        }
        if (users.length < perPage) break
        page++
      }
    }

    if (!resolvedUserId) {
      throw new Error('User not found')
    }

    // Safety guard: verify the resolved auth user's email matches
    const { data: { user: resolvedUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId)

    if (getUserError || !resolvedUser) {
      throw new Error('Failed to verify user identity')
    }

    if (resolvedUser.email?.toLowerCase() !== normalizedEmail) {
      throw new Error('User identity verification failed - password NOT updated')
    }

    // Update user password via Auth Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resolvedUserId,
      { password: newPassword }
    )

    if (updateError) {
      throw new Error('Failed to update password')
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})