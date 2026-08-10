import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const runSetup = async () => {
    setStatus("running");
    setMessage("Creating admin user...");

    try {
      // Get the first distributor to link the admin user
      const { data: distributor } = await supabase
        .from("distributors")
        .select("id")
        .limit(1)
        .single();
      const distributorId = distributor?.id;
      if (!distributorId) {
        throw new Error("No distributor found. Create a distributor first.");
      }

      // Use Supabase's admin API to create the user properly
      const { data, error } = await supabase.auth.admin.createUser({
        email: "admin@creamroute.com",
        password: "Admin@1234",
        email_confirm: true,
        user_metadata: {
          full_name: "Admin User",
          role: "distributor",
          mobile: "+91-9999999999",
        },
      });

      if (error) {
        if (error.message?.includes("already been registered")) {
          // User exists - just update it
          const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
          const existingUser = users?.users.find((u) => u.email === "admin@creamroute.com");
          
          if (existingUser) {
            // Update password
            await supabase.auth.admin.updateUserById(existingUser.id, {
              password: "Admin@1234",
              email_confirm: true,
            });
            
            // Link to users table
            await supabase.from("users").upsert({
              id: existingUser.id,
              email: "admin@creamroute.com",
              full_name: "Admin User",
              role: "distributor",
              status: "active",
              email_verified: true,
              distributor_id: distributorId,
              password_hash: "supabase-managed",
            });

            // Ensure profile exists
            await supabase.from("profiles").upsert({
              id: existingUser.id,
              email: "admin@creamroute.com",
              full_name: "Admin User",
              account_status: "active",
            });

            // Assign admin role
            await supabase.from("user_roles").upsert({
              user_id: existingUser.id,
              role: "admin",
            });

            setStatus("success");
            setMessage("Admin user updated successfully! You can now login.");
            return;
          }
        }
        throw error;
      }

      if (data.user) {
        // Link to users table
        await supabase.from("users").upsert({
          id: data.user.id,
          email: "admin@creamroute.com",
          full_name: "Admin User",
          role: "distributor",
          status: "active",
          email_verified: true,
          distributor_id: distributorId,
          password_hash: "supabase-managed",
        });

        // Ensure profile exists
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: "admin@creamroute.com",
          full_name: "Admin User",
          account_status: "active",
        });

        // Assign admin role
        await supabase.from("user_roles").upsert({
          user_id: data.user.id,
          role: "admin",
        });

        setStatus("success");
        setMessage("Admin user created successfully! You can now login.");
      }
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "Failed to create admin user");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center">
            <CardTitle>Initial Setup</CardTitle>
            <CardDescription>
              Create the first admin user for CreamRoute
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && (
              <Alert variant={status === "error" ? "destructive" : "default"}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {status === "idle" && (
              <Button
                onClick={runSetup}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Admin User
              </Button>
            )}

            {status === "running" && (
              <Button disabled className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </Button>
            )}

            {status === "success" && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <Button
                  onClick={() => navigate({ to: "/auth" })}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Go to Login
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                <Button
                  onClick={runSetup}
                  variant="outline"
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            )}

            <div className="text-xs text-gray-500 text-center pt-4 border-t">
              <p><strong>Credentials:</strong></p>
              <p>Email: admin@creamroute.com</p>
              <p>Password: Admin@1234</p>
              <p className="mt-2 text-red-600">⚠️ Change password after first login!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
