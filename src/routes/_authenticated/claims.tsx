import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, num, isoDate, shortDate, genDocNo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Plus,
  Search,
  Send,
  ShieldCheck,
  XCircle,
  Ban,
  Archive,
  Package,
  TrendingDown,
  TrendingUp,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/claims")({
  component: ClaimsToSudha,
});

type Claim = {
  id: string;
  claim_no: string;
  purchase_id: string | null;
  purchase_item_id: string | null;
  claim_date: string;
  claim_type: "short_supply" | "damaged" | "quality" | "packaging" | "expired_early";
  product_id: string | null;
  product_name: string;
  quantity: number;
  claim_amount: number;
  reason: string;
  evidence_url: string | null;
  status: "pending" | "submitted" | "approved" | "rejected" | "credited";
  submitted_to_sudha_at: string | null;
  sudha_response: string | null;
  credited_at: string | null;
  created_by: string | null;
  created_at: string;
};

const STATUS_META: Record<Claim["status"], { label: string; color: string; icon: any; bg: string }> = {
  pending: { label: "Pending", color: "text-warning", icon: Clock, bg: "bg-warning/10 border-warning/30" },
  submitted: { label: "Submitted", color: "text-primary", icon: Send, bg: "bg-primary/10 border-primary/30" },
  approved: { label: "Approved", color: "text-success", icon: CheckCircle2, bg: "bg-success/10 border-success/30" },
  rejected: { label: "Rejected", color: "text-destructive", icon: XCircle, bg: "bg-destructive/10 border-destructive/30" },
  credited: { label: "Credited", color: "text-success", icon: DollarSign, bg: "bg-emerald-100 border-emerald-400" },
};

const TYPE_META: Record<Claim["claim_type"], { label: string; icon: any }> = {
  short_supply: { label: "Short Supply", icon: TrendingDown },
  damaged: { label: "Damaged", icon: AlertTriangle },
  quality: { label: "Quality Issue", icon: AlertTriangle },
  packaging: { label: "Packaging Torn", icon: Package },
  expired_early: { label: "Expired Early", icon: Clock },
};

function ClaimsToSudha() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState<Claim | null>(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["sudha-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sudha_claims")
        .select("*")
        .order("claim_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Claim[];
    },
  });

  const stats = useMemo(() => {
    const total = claims.length;
    const pending = claims.filter((c) => c.status === "pending").length;
    const submitted = claims.filter((c) => c.status === "submitted").length;
    const approved = claims.filter((c) => c.status === "approved").length;
    const rejected = claims.filter((c) => c.status === "rejected").length;
    const credited = claims.filter((c) => c.status === "credited").length;
    const totalClaimed = claims.reduce((s, c) => s + Number(c.claim_amount), 0);
    const totalCredited = claims.filter((c) => c.status === "credited").reduce((s, c) => s + Number(c.claim_amount), 0);
    const pendingAmount = claims.filter((c) => c.status !== "credited" && c.status !== "rejected").reduce((s, c) => s + Number(c.claim_amount), 0);
    return { total, pending, submitted, approved, rejected, credited, totalClaimed, totalCredited, pendingAmount };
  }, [claims]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return claims.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.claim_no.toLowerCase().includes(q) ||
        c.product_name.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q) ||
        c.claim_type.toLowerCase().includes(q)
      );
    });
  }, [claims, statusFilter, search]);

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["sudha-claims"] });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Claims to Sudha"
        description="Track short supply, damage, quality, and packaging claims against Sudha Dairy."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" /> New Claim
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Claims" value={String(stats.total)} icon={FileText} />
        <StatCard label="Pending" value={String(stats.pending)} icon={Clock} tone="warning" />
        <StatCard label="Submitted" value={String(stats.submitted)} icon={Send} tone="primary" />
        <StatCard label="Credited" value={String(stats.credited)} icon={CheckCircle2} tone="success" />
        <StatCard label="Amount Claimed" value={inr(stats.totalClaimed)} icon={TrendingUp} tone="primary" />
        <StatCard label="Pending Amount" value={inr(stats.pendingAmount)} icon={TrendingDown} tone="warning" />
      </div>

      {/* Filter */}
      <Card className="p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all", "pending", "submitted", "approved", "rejected", "credited"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== "all" && claims.filter((c) => c.status === s).length > 0 && (
                <span className="ml-1.5 opacity-70">({claims.filter((c) => c.status === s).length})</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search claim, product, reason…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </Card>

      {/* Claims List */}
      {isLoading ? (
        <Card className="p-12 text-center text-muted-foreground">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="size-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-sm font-semibold mb-1">No claims found</div>
          <div className="text-xs text-muted-foreground">
            {claims.length === 0 ? "Create your first claim to track issues with Sudha deliveries." : "Try changing the filter."}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              onView={() => setViewOpen(claim)}
              onStatusChange={onSaved}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {createOpen && <CreateClaimDialog onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); onSaved(); }} />}

      {/* View dialog */}
      {viewOpen && <ViewClaimDialog claim={viewOpen} onClose={() => setViewOpen(null)} onStatusChange={() => { setViewOpen(null); onSaved(); }} />}
    </PageContainer>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "warning" | "primary" | "success" | "default" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={cn("size-4", tone === "warning" ? "text-warning" : tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : "text-muted-foreground")} />
      </div>
      <div className={cn("text-2xl font-bold font-mono", tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "")}>
        {value}
      </div>
    </Card>
  );
}

function ClaimCard({ claim, onView, onStatusChange }: { claim: Claim; onView: () => void; onStatusChange: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const meta = STATUS_META[claim.status];
  const typeMeta = TYPE_META[claim.claim_type];
  const Icon = meta.icon;

  const updateStatus = async (status: Claim["status"], extra?: Partial<Claim>) => {
    setBusy(status);
    const update: any = { status };
    if (status === "submitted") update.submitted_to_sudha_at = new Date().toISOString();
    if (status === "credited") update.credited_at = new Date().toISOString();
    if (extra) Object.assign(update, extra);
    const { error } = await supabase.from("sudha_claims").update(update).eq("id", claim.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Claim ${meta.label.toLowerCase()} → ${status}`);
      qc.invalidateQueries({ queryKey: ["sudha-claims"] });
      onStatusChange();
    }
    setBusy(null);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={cn("size-10 rounded-lg border flex items-center justify-center shrink-0", meta.bg)}>
          <Icon className={cn("size-5", meta.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold">{claim.claim_no}</span>
                <Badge variant="outline" className={cn("text-[10px]", meta.color)}>
                  {meta.label}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{shortDate(claim.claim_date)}</span>
              </div>
              <div className="text-sm font-medium mt-0.5">{claim.product_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{claim.reason}</div>
            </div>

            <div className="text-right shrink-0">
              <div className="font-mono text-lg font-bold">{inr(claim.claim_amount)}</div>
              <div className="text-[11px] text-muted-foreground">
                {num(claim.quantity, 1)} units · <span className="inline-flex items-center gap-1">{typeMeta.label}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button size="sm" variant="ghost" onClick={onView} className="gap-1.5">
              <Eye className="size-3.5" /> View
            </Button>

            {claim.status === "pending" && (
              <Button size="sm" onClick={() => updateStatus("submitted")} disabled={busy !== null} className="gap-1.5 bg-primary hover:bg-primary/90">
                {busy === "submitted" ? <><div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : <><Send className="size-3.5" /> Submit to Sudha</>}
              </Button>
            )}

            {claim.status === "submitted" && (
              <>
                <Button size="sm" onClick={() => updateStatus("approved")} disabled={busy !== null} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  {busy === "approved" ? <><div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Approving…</> : <><ShieldCheck className="size-3.5" /> Mark Approved</>}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => updateStatus("rejected")} disabled={busy !== null} className="gap-1.5">
                  {busy === "rejected" ? <><div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Rejecting…</> : <><Ban className="size-3.5" /> Reject</>}
                </Button>
              </>
            )}

            {claim.status === "approved" && (
              <Button size="sm" onClick={() => updateStatus("credited")} disabled={busy !== null} className="gap-1.5 bg-emerald-700 hover:bg-emerald-800">
                {busy === "credited" ? <><div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Crediting…</> : <><DollarSign className="size-3.5" /> Mark Credited</>}
              </Button>
            )}

            {(claim.status === "credited" || claim.status === "rejected") && (
              <Badge variant="outline" className="text-[10px]">
                {claim.status === "credited" && claim.credited_at ? `Credited ${shortDate(claim.credited_at)}` : claim.sudha_response ? `Sudha: ${claim.sudha_response}` : "Closed"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CreateClaimDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [claimType, setClaimType] = useState<Claim["claim_type"]>("short_supply");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!productName.trim()) return toast.error("Product name required");
    const qty = Number(quantity);
    if (!qty || qty <= 0) return toast.error("Quantity must be > 0");
    const amt = Number(claimAmount || 0);
    if (!amt) return toast.error("Claim amount required");
    if (!reason.trim()) return toast.error("Reason required");

    setSaving(true);
    const { data: claimNo } = await supabase.rpc("generate_claim_no");
    const { error } = await supabase.from("sudha_claims").insert({
      claim_no: claimNo ?? genDocNo("CLM"),
      claim_type: claimType,
      product_name: productName.trim(),
      quantity: qty,
      claim_amount: amt,
      reason: reason.trim(),
      status: "pending",
      claim_date: isoDate(),
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Claim ${claimNo} created`);
      qc.invalidateQueries({ queryKey: ["sudha-claims"] });
      onSaved();
    }
  };

  const typeMeta = TYPE_META[claimType];
  const TypeIcon = typeMeta.icon;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" /> New Claim to Sudha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Claim Type *</Label>
            <Select value={claimType} onValueChange={(v) => setClaimType(v as Claim["claim_type"])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_META).map(([key, m]) => (
                  <SelectItem key={key} value={key}>
                    <span className="inline-flex items-center gap-2"><m.icon className="size-4" /> {m.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Product Name *</Label>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Sudha Toned Milk 500ml" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity *</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="mt-1 text-lg font-mono" />
            </div>
            <div>
              <Label>Claim Amount (₹) *</Label>
              <Input type="number" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="0.00" className="mt-1 text-lg font-mono" />
            </div>
          </div>

          <div>
            <Label>Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Describe the issue: packaging torn, leakage, short supply vs ordered, etc." className="mt-1" />
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <TypeIcon className="size-4" /> {typeMeta.label}
            </div>
            {productName && <div><span className="text-muted-foreground">Product: </span><span className="font-medium">{productName}</span></div>}
            {quantity && <div><span className="text-muted-foreground">Quantity: </span><span className="font-mono font-semibold">{num(Number(quantity), 1)} units</span></div>}
            {claimAmount && <div><span className="text-muted-foreground">Claim Amount: </span><span className="font-mono font-semibold">{inr(Number(claimAmount))}</span></div>}
            <div className="text-[10px] text-muted-foreground pt-1">Claim will start in "Pending" status. Submit to Sudha when ready.</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : <><Plus className="size-4" /> Create Claim</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewClaimDialog({ claim, onClose, onStatusChange }: { claim: Claim; onClose: () => void; onStatusChange: () => void }) {
  const qc = useQueryClient();
  const [sudhaResponse, setSudhaResponse] = useState(claim.sudha_response ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  const meta = STATUS_META[claim.status];
  const typeMeta = TYPE_META[claim.claim_type];
  const Icon = meta.icon;

  const updateStatus = async (status: Claim["status"]) => {
    setBusy(status);
    const update: any = { status };
    if (status === "submitted") update.submitted_to_sudha_at = new Date().toISOString();
    if (status === "credited") update.credited_at = new Date().toISOString();
    if (sudhaResponse.trim()) update.sudha_response = sudhaResponse.trim();
    const { error } = await supabase.from("sudha_claims").update(update).eq("id", claim.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Claim updated to ${status}`);
      qc.invalidateQueries({ queryKey: ["sudha-claims"] });
      onStatusChange();
    }
    setBusy(null);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn("size-8 rounded-lg border flex items-center justify-center", meta.bg)}>
              <Icon className={cn("size-4", meta.color)} />
            </div>
            <div>
              <div className="font-mono text-sm">{claim.claim_no}</div>
              <div className="text-[11px] text-muted-foreground font-normal">{shortDate(claim.claim_date)} · {typeMeta.label}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product & amount */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/40">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Product</div>
              <div className="font-medium text-sm">{claim.product_name}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Quantity</div>
              <div className="font-mono text-sm">{num(claim.quantity, 1)} units</div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Claim Amount</div>
              <div className="font-mono text-xl font-bold">{inr(claim.claim_amount)}</div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label className="text-xs">Reason</Label>
            <div className="mt-1 p-3 rounded-md bg-muted/30 text-sm whitespace-pre-wrap">{claim.reason}</div>
          </div>

          {/* Timeline */}
          <div className="p-3 rounded-md bg-muted/30 space-y-2 text-xs">
            <div className="font-semibold text-xs uppercase tracking-wider">Timeline</div>
            <TimelineItem label="Created" value={shortDate(claim.created_at)} />
            {claim.submitted_to_sudha_at && <TimelineItem label="Submitted to Sudha" value={shortDate(claim.submitted_to_sudha_at)} />}
            {claim.credited_at && <TimelineItem label="Credited" value={shortDate(claim.credited_at)} />}
            {claim.sudha_response && (
              <div>
                <div className="text-muted-foreground">Sudha Response</div>
                <div className="font-medium">{claim.sudha_response}</div>
              </div>
            )}
          </div>

          {/* Sudha response (editable when submitted) */}
          {claim.status === "submitted" && (
            <div>
              <Label>Sudha Response / Notes</Label>
              <Textarea value={sudhaResponse} onChange={(e) => setSudhaResponse(e.target.value)} rows={2} placeholder="Enter Sudha's response when received…" className="mt-1" />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
            {claim.status === "pending" && (
              <Button onClick={() => updateStatus("submitted")} disabled={busy !== null} className="gap-1.5">
                {busy === "submitted" ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : <><Send className="size-4" /> Submit to Sudha</>}
              </Button>
            )}
            {claim.status === "submitted" && (
              <>
                <Button onClick={() => updateStatus("approved")} disabled={busy !== null} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  {busy === "approved" ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Approving…</> : <><ShieldCheck className="size-4" /> Mark Approved</>}
                </Button>
                <Button variant="destructive" onClick={() => updateStatus("rejected")} disabled={busy !== null} className="gap-1.5">
                  {busy === "rejected" ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Rejecting…</> : <><Ban className="size-4" /> Reject</>}
                </Button>
              </>
            )}
            {claim.status === "approved" && (
              <Button onClick={() => updateStatus("credited")} disabled={busy !== null} className="gap-1.5 bg-emerald-700 hover:bg-emerald-800">
                {busy === "credited" ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Crediting…</> : <><DollarSign className="size-4" /> Mark Credited</>}
              </Button>
            )}
            {(claim.status === "credited" || claim.status === "rejected") && (
              <Badge variant="outline" className="text-xs">
                {claim.status === "credited" ? "Fully Credited" : "Rejected by Sudha"}
              </Badge>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-2 rounded-full bg-primary" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
