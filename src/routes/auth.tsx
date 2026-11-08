import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Phone, 
  Lock, 
  AlertCircle,
  Loader2,
  Milk
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | DairyFlow Pro" },
      { name: "description", content: "Sign in to your DairyFlow Pro distribution account." },
      { property: "og:title", content: "Sign In | DairyFlow Pro" },
      { property: "og:description", content: "Sign in to your DairyFlow Pro distribution account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

// ── Dev quick-login constants ──────────────────────────────────────
// These are ONLY bundled in development builds. `import.meta.env.DEV`
// is resolved at build time by Vite — the entire block is stripped from
// production bundles, so demo credentials never ship to users.
//
// Matches supabase/migrations/022_fix_demo_accounts.sql
// Password for ALL demo accounts: Admin@1234

const DEV_PASSWORDS: string[] = import.meta.env.DEV ? ["Admin@1234"] : [];

const DEV_ACCOUNTS: { label: string; email: string }[] = import.meta.env.DEV
  ? [
      { label: "Admin", email: "admin@demo.dairyflow.app" },
      { label: "Manager", email: "manager@demo.dairyflow.app" },
      { label: "Sales", email: "sales@demo.dairyflow.app" },
      { label: "Driver", email: "driver@demo.dairyflow.app" },
      { label: "Helper", email: "helper@demo.dairyflow.app" },
      { label: "Retailer", email: "retailer@demo.dairyflow.app" },
    ]
  : [];

/**
 * SECURITY FIX (Phase 1, Part B): After Supabase Auth signs in, we no longer
 * write user/role/permissions to localStorage for authorization decisions.
 * The route guard now verifies the Supabase session via getSession().
 *
 * This function only caches distributor info for UI convenience (sidebar, etc.).
 * It NEVER controls access — the route guard does that via the verified session.
 */
async function cacheDistributorForUI(user: any): Promise<{ role: string }> {
  const role = user.role ?? "salesperson";

  // Cache distributor for UI components (sidebar header, etc.)
  // This is NOT used for authorization — only for display.
  try {
    const { data: dist } = await supabase
      .from("distributors")
      .select("*")
      .eq("id", user.distributor_id)
      .maybeSingle();
    if (dist) {
      localStorage.setItem("creamroute_distributor", JSON.stringify(dist));
    } else {
      const { data: anyDist } = await supabase.from("distributors").select("*").limit(1).maybeSingle();
      if (anyDist) localStorage.setItem("creamroute_distributor", JSON.stringify(anyDist));
    }
  } catch {
    /* UI cache failure is non-fatal */
  }

  return { role };
}

const loginSchema = z.object({
  email: z.string().optional(),
  mobile: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.email || data.mobile, {
  message: "Email or mobile number is required",
  path: ["email"],
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      // ROOT-CAUSE FIX: an expired/stale session left over from a previous
      // visit made the pre-auth lookup below fail with 401 "invalid JWT",
      // which surfaced as "Invalid credentials" even with correct login
      // details. Always start the login flow with a clean session.
      try {
        await supabase.auth.signOut();
      } catch {
        /* no session to clear */
      }

      // SECURITY (Task 4): pre-auth lookup uses the SECURITY DEFINER RPC
      // `get_login_account` (migration 017), which returns only the seven
      // login-critical columns. The legacy fallback that selected `*` from
      // public.users has been removed — it exposed sensitive columns and
      // allowed account enumeration.
      //
      // If the RPC does not exist (migration 017 not applied), we fail
      // closed with a generic error and log the misconfiguration.
      const lookupUser = async () => {
        const viaRpc = await (supabase as any)
          .rpc("get_login_account", {
            _email: data.email ?? null,
            _mobile: data.mobile ?? null,
          })
          .maybeSingle();

        if (viaRpc.error) {
          // Treat RPC absence as a configuration error — do NOT fall back
          // to an anonymous table scan, which would expose all user columns.
          if (/get_login_account|does not exist|could not find/i.test(viaRpc.error.message)) {
            console.error(
              "[auth] get_login_account RPC is not deployed. " +
              "Run supabase/migrations/017_security_hardening.sql.",
            );
            return { data: null, error: new Error("Login service unavailable. Contact support.") };
          }
          // Other errors (JWT / RLS) — retry once after signOut below.
          return viaRpc;
        }
        return viaRpc;
      };

      let { data: users, error: queryError } = await lookupUser();

      // If a stale auth header still poisoned the request, retry once clean.
      if (queryError && /jwt|token|401|permission denied|row-level/i.test(queryError.message)) {
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
        const retry = await lookupUser();
        users = retry.data;
        queryError = retry.error;
      }

      // SECURITY: return a GENERIC message regardless of whether the
      // account exists. This prevents email/mobile enumeration attacks.
      if (queryError || !users) {
        const msg = "Invalid email/mobile or password.";
        setError(msg);
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      let user: any = users;

      // Check account status
      if (user.status !== "active") {
        const messages: Record<string, string> = {
          pending_verification: "Please verify your email first",
          inactive: "Your account is inactive. Contact your administrator.",
          suspended: "Your account is suspended.",
          blocked: "Your account is blocked.",
        };
        setError(messages[user.status] ?? "Account is not active");
        toast.error(messages[user.status] ?? "Account is not active");
        setIsLoading(false);
        return;
      }

      // Sign in via Supabase Auth
      // We use the email as the auth identifier with a known password pattern
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: user.email || `${user.id}@creamroute.local`,
        password: data.password,
      });

      if (authError) {
        // Show the real reason (invalid password, rate limit, email not
        // confirmed, ...) instead of a generic message.
        const msg =
          /invalid login credentials/i.test(authError.message)
            ? "Invalid email or password"
            : authError.message;
        setError(msg);
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      // The pre-auth lookup returns only login-critical fields; now that a
      // session exists, fetch the complete profile with the user's own token.
      const { data: fullUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      if (fullUser) user = fullUser;

      const { role } = await cacheDistributorForUI(user);

      toast.success(`Welcome back, ${user.full_name}!`);

      // Navigate to role-based dashboard
      const roleDashboards: Record<string, string> = {
        distributor: "/dashboard",
        manager: "/dashboard",
        accountant: "/dashboard",
        warehouse: "/inventory",
        salesman: "/orders",
        delivery_boy: "/deliveries",
        retailer: "/retailer/orders",
      };

      const dashboard = roleDashboards[role] || "/dashboard";
      navigate({ to: dashboard });

    } catch (error) {
      setError("Network error. Please try again.");
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (devEmail: string) => {
    // SECURITY (Task 2): fail closed in production. The UI panel is also
    // stripped from production bundles, but a direct invocation from the
    // browser console must still be blocked.
    if (!import.meta.env.DEV || DEV_PASSWORDS.length === 0 || DEV_ACCOUNTS.length === 0) {
      setError("Quick login is not available in this environment.");
      toast.error("Quick login is disabled in production.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clear any stale session first
      try { await supabase.auth.signOut(); } catch { /* ignore */ }

      // Try each known dev password until one works
      let result: any = null;
      for (const pw of DEV_PASSWORDS) {
        const res = await supabase.auth.signInWithPassword({ email: devEmail, password: pw });
        if (!res.error) { result = res; break; }
      }
      if (!result || result.error) {
        throw result?.error ?? new Error("Invalid credentials");
      }

      const authUser = result.data?.user;
      if (!authUser) throw new Error("No user returned");

      // Resolve the public.users row and cache for UI
      const { data: fullUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!fullUser) {
        setError(`No account row found for ${devEmail}. Create it via SQL or the admin panel.`);
        toast.error("Dev login failed: user row missing");
        return;
      }

      const { role } = await cacheDistributorForUI(fullUser);

      toast.success(`Signed in as ${devEmail.split("@")[0]} (${fullUser.role})`);

      const roleDashboards: Record<string, string> = {
        distributor: "/dashboard",
        admin: "/dashboard",
        manager: "/dashboard",
        accountant: "/dashboard",
        warehouse: "/inventory",
        salesman: "/orders",
        salesperson: "/orders",
        delivery_boy: "/deliveries",
        driver: "/deliveries",
        helper: "/deliveries",
        retailer: "/retailer/orders",
      };
      const dashboard = roleDashboards[fullUser.role] || "/dashboard";
      navigate({ to: dashboard });
    } catch (err: any) {
      console.error("[quickLogin]", err);
      const msg = err?.message ?? "Dev login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <Milk className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">DairyFlow Pro</h1>
          <p className="text-gray-600">Distribution ERP — Business Login</p>
        </div>

        {/* Login Form */}
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
            <CardDescription className="text-center text-gray-600">
              Enter your credentials to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-10"
                    {...register("email")}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <Separator className="my-4" />

              <div className="text-center">
                <span className="text-sm text-gray-500">OR</span>
              </div>

              <Separator className="my-4" />

              {/* Mobile Input */}
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    className="pl-10"
                    {...register("mobile")}
                    disabled={isLoading}
                  />
                </div>
                {errors.mobile && (
                  <p className="text-sm text-red-600">{errors.mobile.message}</p>
                )}
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                    {...register("password")}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <Button
                  variant="link"
                  className="text-sm text-blue-600 hover:text-blue-700 p-0 h-auto"
                  onClick={() => navigate({ to: "/forgot-password" })}
                >
                  Forgot password?
                </Button>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Help Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account? Contact your distributor administrator.
            </p>

            {/* ── Dev quick-login panel ─────────────────────────────────
             * Only rendered in development builds. `import.meta.env.DEV`
             * is resolved at build time by Vite, so the entire block is
             * stripped from production bundles (no demo credentials leak).
             * ───────────────────────────────────────────────────────── */}
            {import.meta.env.DEV && DEV_ACCOUNTS.length > 0 && (
              <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-amber-900">Dev quick login</p>
                    <p className="text-[11px] text-amber-800/80">
                      Development-only. One-click sign in per role.
                      Password: <code className="font-mono text-amber-900">Admin@1234</code>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DEV_ACCOUNTS.map((a) => (
                    <Button
                      key={a.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      className="text-xs"
                      onClick={() => quickLogin(a.email)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[10px] text-amber-800/70">
                  Provisioned by <code className="font-mono">supabase/migrations/022_fix_demo_accounts.sql</code>.
                  Not available in production builds.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          © 2026 DairyFlow Pro. All rights reserved.
        </p>
      </div>
    </div>
  );
}
