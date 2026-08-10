import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { hash, verify } from "https://deno.land/x/bcrypt@v0.2.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, mobile, password, ip_address, user_agent } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find user by email or mobile
    let userQuery = supabase.from("users").select("*");
    
    if (email) {
      userQuery = userQuery.eq("email", email);
    } else if (mobile) {
      userQuery = userQuery.eq("mobile", mobile);
    } else {
      return new Response(
        JSON.stringify({ error: "Email or mobile is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: users, error: userError } = await userQuery.single();

    if (userError || !users) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = users;

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return new Response(
        JSON.stringify({ 
          error: "Account is temporarily locked due to failed login attempts",
          locked_until: user.locked_until 
        }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check account status
    if (user.status !== "active") {
      const statusMessages = {
        pending_verification: "Please verify your email first",
        inactive: "Account is inactive",
        suspended: "Account is suspended",
        blocked: "Account is blocked"
      };
      
      return new Response(
        JSON.stringify({ 
          error: statusMessages[user.status as keyof typeof statusMessages] || "Account is not active" 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const passwordValid = await verify(password, user.password_hash);
    
    if (!passwordValid) {
      // Increment failed attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = failedAttempts >= 5 
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString() // Lock for 30 minutes
        : null;
      
      await supabase
        .from("users")
        .update({
          failed_login_attempts: failedAttempts,
          locked_until: lockedUntil
        })
        .eq("id", user.id);
      
      // Log failed login
      await supabase.from("login_history").insert({
        user_id: user.id,
        distributor_id: user.distributor_id,
        ip_address,
        user_agent,
        status: "failed",
        failure_reason: "Invalid password"
      });
      
      return new Response(
        JSON.stringify({ 
          error: failedAttempts >= 5 
            ? `Too many failed attempts. Account locked for 30 minutes`
            : `Invalid credentials. ${5 - failedAttempts} attempts remaining` 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Successful login - reset failed attempts
    await supabase
      .from("users")
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        last_login_ip: ip_address
      })
      .eq("id", user.id);

    // Get user permissions
    const { data: permissions } = await supabase
      .from("role_permissions")
      .select(`
        permission_id,
        permissions:permission_id(name, label, category)
      `)
      .eq("role", user.role);

    const userPermissions = (permissions || []).map((p: any) => ({
      name: p.permissions.name,
      label: p.permissions.label,
      category: p.permissions.category
    }));

    // Get distributor info
    const { data: distributor } = await supabase
      .from("distributors")
      .select("*")
      .eq("id", user.distributor_id)
      .single();

    // Log successful login
    await supabase.from("login_history").insert({
      user_id: user.id,
      distributor_id: user.distributor_id,
      ip_address,
      user_agent,
      status: "success"
    });

    // Log audit
    await supabase.from("audit_logs").insert({
      distributor_id: user.distributor_id,
      user_id: user.id,
      action: "user_login",
      ip_address,
      user_agent
    });

    // Create session (using Supabase auth)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user.email || `${user.id}@creamroute.local`,
      password: password
    });

    if (authError) {
      // Fallback: return user data without Supabase auth session
      return new Response(
        JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            mobile: user.mobile,
            full_name: user.full_name,
            role: user.role,
            employee_id: user.employee_id,
            retailer_id: user.retailer_id,
            status: user.status,
            permissions: userPermissions
          },
          distributor,
          message: "Login successful (session managed client-side)"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          full_name: user.full_name,
          role: user.role,
          employee_id: user.employee_id,
          retailer_id: user.retailer_id,
          status: user.status,
          permissions: userPermissions
        },
        distributor,
        session: authData.session,
        message: "Login successful"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
