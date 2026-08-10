import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { hash } from "https://deno.land/x/bcrypt@v0.2.4/mod.ts";
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
    const {
      email,
      mobile,
      password,
      full_name,
      role,
      distributor_id,
      created_by,
      ip_address,
      user_agent
    } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");

    // Validate required fields
    if (!full_name || !role || !distributor_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email or mobile already exists
    if (email) {
      const { data: existingEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (existingEmail) {
        return new Response(
          JSON.stringify({ error: "Email already registered" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (mobile) {
      const { data: existingMobile } = await supabase
        .from("users")
        .select("id")
        .eq("mobile", mobile)
        .single();

      if (existingMobile) {
        return new Response(
          JSON.stringify({ error: "Mobile number already registered" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        distributor_id,
        email,
        mobile,
        password_hash,
        full_name,
        role,
        status: "pending_verification",
        created_by,
        email_verified: false
      })
      .select()
      .single();

    if (userError) {
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate verification token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const { error: tokenError } = await supabase
      .from("email_verification_tokens")
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

    // Send verification email
    if (email && role !== "retailer") {
      const verificationUrl = `${Deno.env.get("APP_URL")}/verify-email?token=${token}`;

      await resend.emails.send({
        from: "CreamRoute <noreply@creamroute.com>",
        to: email,
        subject: "Activate Your CreamRoute Account",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a202c; font-size: 24px; margin-bottom: 20px;">Welcome to CreamRoute!</h1>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
              Hello ${full_name},
            </p>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
              Your account has been created with the role of <strong>${role.replace('_', ' ')}</strong>.
            </p>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
              Please verify your email address by clicking the button below:
            </p>
            <a href="${verificationUrl}" 
               style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
              Verify Email Address
            </a>
            <p style="color: #718096; font-size: 14px; line-height: 1.6;">
              Or copy and paste this link into your browser:<br/>
              <a href="${verificationUrl}" style="color: #3182ce; word-break: break-all;">${verificationUrl}</a>
            </p>
            <p style="color: #718096; font-size: 14px; line-height: 1.6;">
              This link will expire in 24 hours.
            </p>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-top: 30px;">
              If you didn't expect this email, you can safely ignore it.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;"/>
            <p style="color: #a0aec0; font-size: 12px; line-height: 1.6;">
              © 2026 CreamRoute. All rights reserved.
            </p>
          </div>
        `
      });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      distributor_id,
      user_id: created_by,
      action: "user_created",
      entity_type: "user",
      entity_id: user.id,
      new_value: { email, role, full_name },
      ip_address,
      user_agent
    });

    return new Response(
      JSON.stringify({
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          full_name: user.full_name,
          role: user.role,
          employee_id: user.employee_id,
          retailer_id: user.retailer_id,
          status: user.status
        }
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
