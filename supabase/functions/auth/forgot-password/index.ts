import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { Resend } from "https://esm.sh/resend@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !user) {
      // Don't reveal if email exists or not (security best practice)
      return new Response(
        JSON.stringify({ message: "If an account exists with that email, we've sent reset instructions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reset token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error: tokenError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt
      });

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: tokenError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send reset email
    const resetUrl = `${Deno.env.get("APP_URL")}/reset-password?token=${token}&user_id=${user.id}`;

    await resend.emails.send({
      from: "CreamRoute <noreply@creamroute.com>",
      to: email,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a202c; font-size: 24px; margin-bottom: 20px;">Password Reset Request</h1>
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
            Hello ${user.full_name},
          </p>
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          <a href="${resetUrl}" 
             style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #718096; font-size: 14px; line-height: 1.6;">
            Or copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #3182ce; word-break: break-all;">${resetUrl}</a>
          </p>
          <p style="color: #718096; font-size: 14px; line-height: 1.6;">
            This link will expire in 1 hour.
          </p>
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-top: 30px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;"/>
          <p style="color: #a0aec0; font-size: 12px; line-height: 1.6;">
            © 2026 CreamRoute. All rights reserved.
          </p>
        </div>
      `
    });

    // Log audit
    await supabase.from("audit_logs").insert({
      distributor_id: user.distributor_id,
      user_id: user.id,
      action: "password_reset_requested",
      entity_type: "user",
      entity_id: user.id
    });

    return new Response(
      JSON.stringify({ message: "If an account exists with that email, we've sent reset instructions" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
