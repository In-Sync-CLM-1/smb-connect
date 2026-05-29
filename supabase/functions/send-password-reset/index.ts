import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'https://esm.sh/resend@3.0.0'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    
    const payload = await req.json()
    
    const {
      user,
      email_data: { token, email_action_type },
    } = payload

    // Only process recovery emails
    if (email_action_type !== 'recovery') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - SMB Connect</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f6f9fc;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Reset Your Password</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Hi there,
                      </p>
                      
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        We received a request to reset the password for your SMB Connect account (<strong>${user.email}</strong>).
                      </p>
                      
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                        Your verification code is:
                      </p>
                      
                      <!-- Code Box -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 20px 0 30px 0;">
                            <div style="background-color: #f4f4f4; border-radius: 8px; padding: 24px; display: inline-block;">
                              <p style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">
                                VERIFICATION CODE
                              </p>
                              <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333; margin: 0; font-family: 'Courier New', monospace;">
                                ${token}
                              </p>
                            </div>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Enter this 6-digit code on the password reset page to continue. This code will expire in <strong>1 hour</strong>.
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e6e6e6; margin-top: 30px; padding-top: 20px;">
                        <tr>
                          <td>
                            <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">
                              If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                      <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                        <strong>SMB Connect Hub</strong>
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        Connecting Small & Medium Businesses
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'SMB Connect <noreply@smbconnect.in>',
      to: [user.email],
      subject: 'Reset Your Password - SMB Connect',
      html: htmlContent,
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ success: true, messageId: data?.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send password reset email',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
