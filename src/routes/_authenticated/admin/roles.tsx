import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserManagement } from "@/components/user-management";
import {
  ALL_ROLES,
  roleDescription,
  ROLE_ACCESS,
} from "@/lib/access";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Shield,
  Users,
  RefreshCw,
  FileText,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesManagement,
});

function RolesManagement() {
  const qc = useQueryClient();
  const { is } = usePermissions();
  const isAdmin = is("admin");

  const [activeTab, setActiveTab] = useState<"users" | "roles" | "audit">("users");

  // Audit log (last 100)
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["access-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        // Table might not exist yet if migration hasn't run.
        console.warn("[audit] access_audit_logs query failed:", error);
        return [];
      }
      return data ?? [];
    },
    staleTime: 30_000,
  });

  if (!isAdmin) {
    return (
      <PageContainer>
        <Card className="p-10 text-center">
          <Lock className="size-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-sm font-semibold">Admin access required</div>
          <div className="text-xs text-muted-foreground mt-1">
            Only administrators can manage roles and permissions.
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Roles & Permissions"
        description="Manage users, view access rules, and audit log."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["permissions"] });
              qc.invalidateQueries({ queryKey: ["access-audit-log"] });
              toast.success("Refreshed");
            }}
            className="gap-1.5"
          >
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="size-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="size-4" /> Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <FileText className="size-4" /> Access Audit Log
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB — single merged user management (create, role, status, retailer link) */}
        <TabsContent value="users" className="mt-4">
          <UserManagement />
        </TabsContent>

        {/* ROLES TAB */}
        <TabsContent value="roles" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ALL_ROLES.map((role) => {
              // ROLE_ACCESS maps a role to its allowed route prefixes.
              const allowedRoutes = ROLE_ACCESS[role] ?? [];

              return (
                <Card key={role} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="size-5 text-primary" />
                    <h3 className="font-semibold text-sm capitalize">{role}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {roleDescription(role)}
                  </p>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Allowed routes ({allowedRoutes.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {allowedRoutes.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        No routes assigned
                      </span>
                    )}
                    {allowedRoutes.map((path: string) => (
                      <Badge key={path} variant="outline" className="text-[10px] font-mono">
                        {path}
                      </Badge>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* AUDIT TAB */}
        <TabsContent value="audit" className="mt-4">
          <AuditLog logs={auditLogs} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function AuditLog({ logs }: { logs: any[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.event_type === filter);
  }, [logs, filter]);

  const eventTypeMeta: Record<
    string,
    { label: string; color: string; icon: any }
  > = {
    login_success: { label: "Login OK", color: "text-success", icon: "✅" },
    login_failure: { label: "Login Failed", color: "text-destructive", icon: "⛔" },
    logout: { label: "Logout", color: "text-muted-foreground", icon: "👋" },
    access_denied: { label: "Access Denied", color: "text-warning", icon: "🚫" },
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-3 flex items-center gap-3 border-b">
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all", "login_success", "login_failure", "access_denied"] as const).map(
            (v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={cn(
                  "px-3 py-1.5 font-medium",
                  filter === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {v === "all" ? "All" : eventTypeMeta[v].label}
              </button>
            ),
          )}
        </div>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} events
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No audit events yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2 font-semibold">When</th>
                <th className="text-left px-4 py-2 font-semibold">Event</th>
                <th className="text-left px-4 py-2 font-semibold">User</th>
                <th className="text-left px-4 py-2 font-semibold">Path</th>
                <th className="text-left px-4 py-2 font-semibold">Roles</th>
                <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((log: any) => {
                const meta = eventTypeMeta[log.event_type] ?? {
                  label: log.event_type,
                  color: "text-muted-foreground",
                  icon: "•",
                };
                return (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn("text-xs font-semibold", meta.color)}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs font-medium truncate max-w-[160px]">
                        {log.user_email ?? "(unknown)"}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-mono">
                        {log.route_path ?? "—"}
                      </span>
                      {log.reason && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                          {log.reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {(log.user_roles ?? []).map((r: string) => (
                          <Badge key={r} variant="outline" className="text-[9px]">
                            {r}
                          </Badge>
                        ))}
                      </div>
                      {(log.required_roles ?? []).length > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          needs: {(log.required_roles ?? []).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono hidden md:table-cell">
                      {log.ip_address ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
