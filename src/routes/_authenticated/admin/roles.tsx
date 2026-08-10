import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  ALL_ROLES,
  roleDescription,
  ROLE_ACCESS,
  type StaffRole,
} from "@/lib/access";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Shield,
  Search,
  Plus,
  Trash2,
  Users,
  Eye,
  RefreshCw,
  FileText,
  Lock,
  Link2,
  Link2Off,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  linkCustomerToUser,
  unlinkCustomerFromUser,
} from "@/lib/dev-users.functions";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesManagement,
});

type UserWithRoles = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  roles: string[];
  linkedCustomer: {
    id: string;
    name: string;
    shop_name: string | null;
    status: string | null;
  } | null;
};

function RolesManagement() {
  const qc = useQueryClient();
  const { is } = usePermissions();
  const isAdmin = is("admin");

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "audit">("users");

  // Users + roles + linked customer
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-with-roles"],
    queryFn: async () => {
      // Profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone");
      // User roles (join)
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role");
      // Customers linked to auth users (user_id is nullable)
      const { data: linkedCustomers } = await supabase
        .from("customers")
        .select("id, user_id, name, shop_name, status")
        .not("user_id", "is", null);

      const byUser = new Map<
        string,
        {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          roles: string[];
          linkedCustomer: UserWithRoles["linkedCustomer"];
        }
      >();

      for (const p of profiles ?? []) {
        byUser.set(p.id, {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          phone: p.phone,
          roles: [],
          linkedCustomer: null,
        });
      }
      for (const r of roleRows ?? []) {
        const u = byUser.get(r.user_id);
        if (u) u.roles.push(r.role);
      }
      for (const c of linkedCustomers ?? []) {
        const u = byUser.get(c.user_id as string);
        if (u) {
          u.linkedCustomer = {
            id: c.id,
            name: c.name,
            shop_name: c.shop_name,
            status: c.status,
          };
        }
      }

      return Array.from(byUser.values());
    },
  });

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

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.roles.some((r) => r.toLowerCase().includes(q)),
    );
  }, [users, search]);

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
        description="Manage user roles, view access rules, and audit log."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["admin-users-with-roles"] });
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
            <Users className="size-4" /> Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="size-4" /> Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <FileText className="size-4" /> Access Audit Log
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-4 space-y-3">
          <Card className="p-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="text-xs text-muted-foreground ml-auto">
              {filteredUsers.length} of {users.length} users
            </div>
          </Card>

          {usersLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading...</Card>
          ) : filteredUsers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No users found</Card>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onRolesChanged={() => {
                    qc.invalidateQueries({ queryKey: ["admin-users-with-roles"] });
                    qc.invalidateQueries({ queryKey: ["permissions"] });
                  }}
                />
              ))}
            </div>
          )}
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

function UserRow({
  user,
  onRolesChanged,
}: {
  user: UserWithRoles;
  onRolesChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState<StaffRole>("driver");
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  // Fetch customers for link picker
  const { data: customers = [] } = useQuery({
    queryKey: ["admin-linkable-customers", customerSearch],
    enabled: showLinkPicker,
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, name, shop_name, status")
        .order("name");
      if (customerSearch.trim()) {
        q = q.ilike("name", `%${customerSearch.trim()}%`);
      }
      const { data } = await q;
      return (data ?? []) as { id: string; name: string; shop_name: string | null; status: string | null }[];
    },
  });

  const addRole = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: newRole });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Added ${newRole} role to ${user.email ?? "user"}`);
      onRolesChanged();
    }
  };

  const removeRole = async (role: string) => {
    if (!confirm(`Remove ${role} role from ${user.email ?? "this user"}?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("role", role as StaffRole);
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Removed ${role} role`);
      onRolesChanged();
    }
  };

  const linkToCustomer = async (customerId: string) => {
    if (!user.email) {
      toast.error("User has no email — cannot link");
      return;
    }
    setLinking(true);
    try {
      await linkCustomerToUser({ data: { customerId, userEmail: user.email } });
      toast.success(`Linked ${user.email} to customer`);
      onRolesChanged();
      setShowLinkPicker(false);
      setCustomerSearch("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to link");
    } finally {
      setLinking(false);
    }
  };

  const unlinkFromCustomer = async () => {
    if (!user.linkedCustomer) return;
    if (!confirm(`Unlink ${user.linkedCustomer.shop_name ?? user.linkedCustomer.name} from ${user.email ?? "this user"}? The retailer portal will no longer load for this user.`)) return;
    setUnlinking(true);
    try {
      await unlinkCustomerFromUser({ data: { customerId: user.linkedCustomer.id } });
      toast.success("Unlinked");
      onRolesChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to unlink");
    } finally {
      setUnlinking(false);
    }
  };

  const isRetailer = user.roles.includes("retailer") || user.roles.includes("retailer_user");

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {user.full_name ?? user.email ?? "Unnamed"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {user.email ?? "No email"} · {user.phone ?? "No phone"}
          </div>

          {/* Linked customer (only visible for retailer users) */}
          {isRetailer && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Store className="size-3.5 text-muted-foreground" />
              {user.linkedCustomer ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium">{user.linkedCustomer.shop_name ?? user.linkedCustomer.name}</span>
                  <Badge variant="outline" className="text-[10px]">linked</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={unlinkFromCustomer}
                    disabled={unlinking}
                    className="h-5 px-1.5 text-[10px] text-destructive"
                    title="Unlink customer"
                  >
                    <Link2Off className="size-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground italic">not linked to any customer</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowLinkPicker(true)}
                    disabled={linking}
                    className="h-6 text-[10px] gap-1"
                  >
                    <Link2 className="size-3" /> Link to customer
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Role badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {user.roles.length === 0 && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                no roles
              </Badge>
            )}
            {user.roles.map((r) => (
              <Badge
                key={r}
                variant="outline"
                className="text-[10px] flex items-center gap-1"
              >
                <span className="capitalize">{r}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeRole(r)}
                  className="ml-1 hover:text-destructive"
                  title={`Remove ${r} role`}
                >
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={newRole} onValueChange={(v) => setNewRole(v as StaffRole)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={addRole}
            disabled={busy || user.roles.includes(newRole)}
            className="h-8 gap-1 text-xs"
          >
            <Plus className="size-3" /> Add
          </Button>
        </div>
      </div>

      {/* Link-to-customer picker */}
      {showLinkPicker && (
        <div className="mt-3 p-3 rounded-lg border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Link to existing customer</div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowLinkPicker(false); setCustomerSearch(""); }}
              className="h-6 text-xs"
            >
              Close
            </Button>
          </div>
          <Input
            placeholder="Search by customer name..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {customers.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">No customers found</div>
            )}
            {customers.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={linking}
                onClick={() => linkToCustomer(c.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-background border border-transparent hover:border-border transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.shop_name ?? c.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{c.name}</div>
                </div>
                <Badge variant="outline" className="text-[9px] ml-2 shrink-0">{c.status}</Badge>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Tip: if the customer doesn't exist yet, create it first from the Customers page, then come back to link.
          </div>
        </div>
      )}
    </Card>
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
    login_failure: { label: "Login Failed", color: "text-destructive", icon: "" },
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
