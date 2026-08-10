import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
});

const searchSchema = z.object({
  token: z.string().optional(),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/verify-email" });
  const [step, setStep] = useState<"verifying" | "create-password" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  // Auto-verify token on page load
  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setError("Invalid or missing verification token");
      setStep("error");
    }
  }, [token]);

  const verifyToken = async (token: string) => {
    try {
      const { data: tokenData, error } = await supabase
        .from("email_verification_tokens")
        .select("*, users:users(id, email, full_name)")
        .eq("token", token)
        .is("used_at", null)
        .single();

      if (error || !tokenData) {
        setError("Invalid or expired verification token");
        setStep("error");
        return;
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        setError("Verification token has expired. Please request a new one.");
        setStep("error");
        return;
      }

      setUserId(tokenData.users.id);
      setStep("create-password");
    } catch (error) {
      setError("Verification failed. Please try again.");
      setStep("error");
    }
  };

  const onSubmit = async (data: PasswordForm) => {
    if (!userId || !token) {
      setError("Invalid verification session");
      return;
    }

    setIsLoading(true);

    try {
      // Hash password (in production, this should be done server-side)
      // For now, we'll send it to a server function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          token,
          password: data.password,
          user_id: userId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Verification failed");
        setStep("error");
        return;
      }

      setStep("success");
      toast.success("Email verified successfully! You can now login.");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate({ to: "/auth" });
      }, 3000);

    } catch (error) {
      setError("Verification failed. Please try again.");
      setStep("error");
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const labels = ["Weak", "Fair", "Good", "Strong"];
    const colors = ["bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

    return {
      strength,
      label: labels[strength - 1] || "Weak",
      color: colors[strength - 1] || "bg-red-500",
    };
  };

  const passwordStrength = getPasswordStrength(errors.password?.message ? "" : "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center">
            {step === "verifying" && (
              <>
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                <CardTitle>Verifying Email</CardTitle>
                <CardDescription>Please wait while we verify your email address...</CardDescription>
              </>
            )}
            {step === "create-password" && (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <CardTitle>Email Verified!</CardTitle>
                <CardDescription>Create a password to activate your account</CardDescription>
              </>
            )}
            {step === "success" && (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <CardTitle>Account Activated!</CardTitle>
                <CardDescription>Your account is now active. Redirecting to login...</CardDescription>
              </>
            )}
            {step === "error" && (
              <>
                <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <CardTitle>Verification Failed</CardTitle>
                <CardDescription>{error}</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {step === "create-password" && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
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
                  
                  {/* Password Strength Indicator */}
                  {register("password").name && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded ${
                              i <= passwordStrength.strength ? passwordStrength.color : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-600">
                        Password strength: <span className="font-medium">{passwordStrength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    {...register("confirmPassword")}
                    disabled={isLoading}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating password...
                    </>
                  ) : (
                    "Create Password & Activate Account"
                  )}
                </Button>
              </form>
            )}

            {step === "error" && (
              <div className="text-center space-y-4">
                <Button
                  onClick={() => navigate({ to: "/auth" })}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Back to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
