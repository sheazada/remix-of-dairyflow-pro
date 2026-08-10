import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  paid: "bg-success/10 text-success ring-success/20",
  delivered: "bg-success/10 text-success ring-success/20",
  active: "bg-success/10 text-success ring-success/20",
  received: "bg-success/10 text-success ring-success/20",
  confirmed: "bg-primary-soft text-primary ring-primary/20",
  packed: "bg-primary-soft text-primary ring-primary/20",
  out_for_delivery: "bg-primary-soft text-primary ring-primary/20",
  en_route: "bg-primary-soft text-primary ring-primary/20",
  in_transit: "bg-primary-soft text-primary ring-primary/20",
  planned: "bg-muted text-muted-foreground ring-border",
  partially_delivered: "bg-warning/15 text-warning-foreground ring-warning/30",
  partial: "bg-warning/15 text-warning-foreground ring-warning/30",
  pending: "bg-muted text-muted-foreground ring-border",
  unpaid: "bg-destructive/10 text-destructive ring-destructive/20",
  cancelled: "bg-destructive/10 text-destructive ring-destructive/20",
  failed: "bg-destructive/10 text-destructive ring-destructive/20",
  inactive: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
        styles[status] ?? "bg-muted text-muted-foreground ring-border",
      )}
    >
      {label}
    </span>
  );
}
