import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { makeRetailerCustomerQueryFn } from "@/lib/retailer-customer";
import { toast } from "sonner";
import { User, Mail, Phone, MapPin, Save, Building, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/profile")({
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["retailer-me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const fn = makeRetailerCustomerQueryFn(userRes.user.id, userRes.user.email ?? null);
      return fn();
    },
    retry: 1,
  });

  const { data: profile } = useQuery({
    queryKey: ["retailer-profile", me?.user_id],
    enabled: !!me?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", me!.user_id!)
        .maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    name: profile?.full_name ?? "",
    mobile: profile?.phone ?? me?.mobile ?? "",
    email: profile?.email ?? me?.email ?? "",
    shop_name: me?.shop_name ?? "",
    address: me?.address ?? "",
    gstin: me?.gstin ?? "",
  });

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    if (!me || !profile) return;
    setSaving(true);

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: form.name,
        phone: form.mobile,
        email: form.email,
      })
      .eq("id", profile.id);

    // Update retailer
    const { error: retailerError } = await supabase
      .from("customers")
      .update({
        name: form.name,
        shop_name: form.shop_name,
        mobile: form.mobile,
        email: form.email,
        address: form.address,
        gstin: form.gstin,
      })
      .eq("id", me.id);

    setSaving(false);

    if (profileError || retailerError) {
      toast.error("Failed to update profile");
      return;
    }

    toast.success("Profile updated successfully!");
    qc.invalidateQueries({ queryKey: ["retailer-me"] });
    qc.invalidateQueries({ queryKey: ["retailer-profile"] });
  };

  const retailer = me;
  const outstanding = Number(retailer?.outstanding ?? 0);
  const creditLimit = Number(retailer?.credit_limit ?? 0);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your shop and account details</p>
      </div>

      {/* Account Info */}
      <Card className="p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <User className="size-4" /> Account Information
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-24">Status</span>
            <Badge variant="outline" className="text-success border-success/30">
              <CheckCircle2 className="size-3 mr-1" /> Active
            </Badge>
          </div>
          {retailer?.retailer_code && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Code</span>
              <span className="font-mono font-semibold">{retailer.retailer_code}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-24">Outstanding</span>
            <span className={cn("font-mono font-semibold", outstanding > 0 ? "text-destructive" : "text-success")}>
              {inr(outstanding)}
            </span>
          </div>
          {creditLimit > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Credit Limit</span>
              <span className="font-mono">{inr(creditLimit)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Edit Form */}
      <Card className="p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Building className="size-4" /> Shop Details
        </h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Owner Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="shop_name">Shop Name</Label>
            <Input
              id="shop_name"
              value={form.shop_name}
              onChange={(e) => updateForm("shop_name", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="mobile">Mobile *</Label>
            <Input
              id="mobile"
              value={form.mobile}
              onChange={(e) => updateForm("mobile", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => updateForm("address", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              value={form.gstin}
              onChange={(e) => updateForm("gstin", e.target.value.toUpperCase())}
              className="mt-1"
              placeholder="e.g. 22AAAAA0000A1Z5"
            />
          </div>
        </div>
        <Button onClick={saveProfile} disabled={saving} className="w-full mt-4 gap-2">
          {saving ? (
            <>
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4" /> Save Changes
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}
