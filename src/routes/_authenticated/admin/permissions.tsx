import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  getAllPermissions, 
  getRolePermissions, 
  updateRolePermissions 
} from "@/lib/permissions.functions";
import { useServerFn } from "@tanstack/react-start";
import { PERMISSION_CATEGORIES, type Permission, type RolePermission } from "@/lib/permissions";
import { toast } from "sonner";
import { 
  ShoppingCart, 
  ReceiptText, 
  Users, 
  Package, 
  Wallet, 
  Truck, 
  BarChart3, 
  Shield, 
  Settings,
  Save,
  Loader2
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  component: PermissionsManager,
});

const CATEGORY_ICONS: Record<string, any> = {
  orders: ShoppingCart,
  invoices: ReceiptText,
  customers: Users,
  inventory: Package,
  payments: Wallet,
  deliveries: Truck,
  reports: BarChart3,
  admin: Shield,
  general: Settings,
};

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "salesperson", label: "Salesperson" },
  { value: "driver", label: "Driver" },
  { value: "helper", label: "Helper" },
  { value: "retailer", label: "Retailer" },
];

function PermissionsManager() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState("admin");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const getAllPermsFn = useServerFn(getAllPermissions);
  const getRolePermsFn = useServerFn(getRolePermissions);
  const updateRolePermsFn = useServerFn(updateRolePermissions);

  // Fetch all available permissions
  const { data: allPermissions, isLoading: isLoadingAll } = useQuery({
    queryKey: ["all-permissions"],
    queryFn: async () => {
      const result = await getAllPermsFn({ data: undefined });
      return result.permissions;
    },
  });

  // Fetch permissions for selected role
  const { data: rolePermissions, isLoading: isLoadingRole } = useQuery({
    queryKey: ["role-permissions", selectedRole],
    queryFn: async () => {
      const result = await getRolePermsFn({ data: { role: selectedRole } });
      return result.permissions;
    },
  });

  // Update selected permissions when role changes
  useEffect(() => {
    if (rolePermissions) {
      const permIds = new Set(rolePermissions.map((rp) => rp.permission_id));
      setSelectedPermissions(permIds);
    }
  }, [rolePermissions]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateRolePermsFn({
        data: {
          role: selectedRole,
          permissionIds: Array.from(selectedPermissions),
        },
      });
      toast.success(`Permissions updated for ${selectedRole}`);
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    } catch (error) {
      toast.error("Failed to update permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const selectAll = (category: string) => {
    const categoryPerms = (allPermissions ?? []).filter((p) => p.category === category);
    const newPerms = new Set(selectedPermissions);
    categoryPerms.forEach((p) => newPerms.add(p.id));
    setSelectedPermissions(newPerms);
  };

  const deselectAll = (category: string) => {
    const categoryPerms = (allPermissions ?? []).filter((p) => p.category === category);
    const newPerms = new Set(selectedPermissions);
    categoryPerms.forEach((p) => newPerms.delete(p.id));
    setSelectedPermissions(newPerms);
  };

  const isLoading = isLoadingAll || isLoadingRole;

  return (
    <PageContainer>
      <PageHeader
        title="Permission Manager"
        description="Control what each role can access. Changes take effect immediately."
      />

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Role:</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              {selectedPermissions.size} permissions enabled
            </Badge>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>

        <Separator className="my-6" />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {PERMISSION_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.name] ?? Settings;
              const categoryPerms = (allPermissions ?? []).filter(
                (p) => p.category === category.name
              );
              
              if (categoryPerms.length === 0) return null;

              const allSelected = categoryPerms.every((p) =>
                selectedPermissions.has(p.id)
              );
              const someSelected = categoryPerms.some((p) =>
                selectedPermissions.has(p.id)
              );

              return (
                <div key={category.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">{category.label}</h3>
                      <Badge variant="outline" className="text-xs">
                        {categoryPerms.filter((p) => selectedPermissions.has(p.id)).length} / {categoryPerms.length}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectAll(category.name)}
                        disabled={allSelected}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deselectAll(category.name)}
                        disabled={!someSelected}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categoryPerms.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedPermissions.has(permission.id)}
                          onCheckedChange={() => togglePermission(permission.id)}
                        />
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {permission.label}
                          </div>
                          {permission.description && (
                            <div className="text-xs text-muted-foreground">
                              {permission.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
