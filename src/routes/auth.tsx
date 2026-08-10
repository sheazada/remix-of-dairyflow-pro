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
  component: LoginPage,
});

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
      // Find user by email or mobile
      let query = supabase.from("users").select("*");
      
      if (data.email) {
        query = query.eq("email", data.email);
      } else if (data.mobile) {
        query = query.eq("mobile", data.mobile);
      }

      const { data: users, error: queryError } = await query.single();

      if (queryError || !users) {
        setError("Invalid credentials");
        toast.error("Invalid credentials");
        setIsLoading(false);
        return;
      }

      const user = users;

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
        setError("Invalid credentials");
        toast.error("Invalid credentials");
        setIsLoading(false);
        return;
      }

      // Get user permissions
      const { data: permissionsData } = await supabase.rpc("get_user_permissions", {
        _user_id: user.id,
      });

      const userPermissions = (permissionsData ?? []).map((p: any) => ({
        name: p.permission_name,
        label: p.permission_label,
        category: p.category,
      }));

      // Store user data
      localStorage.setItem("creamroute_user", JSON.stringify({
        ...user,
        id: authData.user?.id ?? user.id,
        permissions: userPermissions,
      }));

      // Get distributor
      const { data: distributor } = await supabase
        .from("distributors")
        .select("*")
        .eq("id", user.distributor_id)
        .single();

      if (distributor) {
        localStorage.setItem("creamroute_distributor", JSON.stringify(distributor));
      }

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

      const dashboard = roleDashboards[user.role] || "/dashboard";
      navigate({ to: dashboard });

    } catch (error) {
      setError("Network error. Please try again.");
      toast.error("Network error");
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CreamRoute</h1>
          <p className="text-gray-600">Business Login</p>
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
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          © 2026 CreamRoute. All rights reserved.
        </p>
      </div>
    </div>
  );
}
