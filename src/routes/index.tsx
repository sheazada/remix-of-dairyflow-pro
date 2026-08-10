import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth", search: { next: undefined } });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    if (list.includes("admin") || list.includes("manager")) throw redirect({ to: "/dashboard" });
    if (list.includes("salesperson")) throw redirect({ to: "/invoices" });
    if (list.includes("driver") || list.includes("helper")) throw redirect({ to: "/demand-consolidation" });
    throw redirect({ to: "/dashboard" });
  },
});
