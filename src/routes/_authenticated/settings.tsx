import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ShieldCheck, User as UserIcon, ChevronDown, Building2, Landmark, Pencil, X, Check, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import {
  getBusiness,
  saveBusiness,
  validateBusiness,
  maskMiddle,
  maskTail,
  maskVpa,
  type BusinessProfile,
  type BusinessValidationErrors,
} from "@/lib/business";
import { MaskedInput } from "@/components/masked-input";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

type Section = "business" | "payment";

// Friendly labels used in the error summary banner.
const FIELD_LABELS: Partial<Record<keyof BusinessProfile, string>> = {
  name: "Trade name",
  legal_name: "Legal name",
  gstin: "GSTIN",
  fssai: "FSSAI",
  pan: "PAN",
  state: "State (GST)",
  state_code: "State code",
  invoice_prefix: "Invoice prefix",
  mobile: "Mobile",
  email: "Email",
  address: "Address",
  upi_vpa: "UPI VPA",
  bank_name: "Bank name",
  bank_holder: "Account holder",
  bank_account: "Account number",
  bank_ifsc: "IFSC",
  bank_branch: "Branch",
  terms: "Invoice terms",
};

const SECTION_FIELDS: Record<Section, (keyof BusinessProfile)[]> = {
  business: [
    "name", "legal_name", "gstin", "fssai", "pan", "state", "state_code",
    "invoice_prefix", "mobile", "email", "address",
  ],
  payment: [
    "upi_vpa", "bank_name", "bank_holder", "bank_account", "bank_ifsc",
    "bank_branch", "terms",
  ],
};

type Role = "admin" | "manager" | "salesperson" | "driver" | "helper";
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Full access, manages team & finances" },
  { value: "manager", label: "Manager", hint: "Operations + financial reports" },
  { value: "salesperson", label: "Salesperson", hint: "Orders, invoices, customers" },
  { value: "driver", label: "Driver", hint: "Deliveries & daily demand" },
  { value: "helper", label: "Helper", hint: "Deliveries & stock assistance" },
];

const roleStyles: Record<Role, string> = {
  admin: "bg-primary/10 text-primary ring-primary/20",
  manager: "bg-blue-500/10 text-blue-700 ring-blue-500/20",
  salesperson: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
  driver: "bg-amber-500/10 text-amber-700 ring-amber-500/20",
  helper: "bg-violet-500/10 text-violet-700 ring-violet-500/20",
};

const BlurValidateContext = React.createContext<((field: string) => void) | null>(null);

function Settings() {
  const qc = useQueryClient();
  const [biz, setBiz] = useState<BusinessProfile>(() => getBusiness());
  const [errors, setErrorsInner] = useState<BusinessValidationErrors>({});
  const setErrors = setErrorsInner;
  const setField = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => {
    setBiz((b) => ({ ...b, [k]: v }));
    // Clear a previously announced error for this field as soon as the user
    // starts fixing it, so screen readers stop reading a stale message.
    setErrorsInner((prev) => {
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const validateFieldOnBlur = React.useCallback(
    (field: string) => {
      const key = field as keyof BusinessProfile;
      // Re-run the full validator (cross-field rules like GSTIN⇄PAN⇄state code).
      setBiz((current) => {
        const { errors: e } = validateBusiness(current);
        setErrorsInner((prev) => {
          const next = { ...prev };
          if (e[key]) next[key] = e[key]!;
          else delete next[key];
          return next;
        });
        return current;
      });
    },
    [],
  );


  const { data: me } = useQuery({
    queryKey: ["me-settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      return { userId: u.user.id, roles: (roles ?? []).map((r) => r.role as Role) };
    },
  });

  const isAdmin = me?.roles.includes("admin") ?? false;

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");
      const rMap = new Map<string, Role[]>();
      for (const r of roles ?? []) {
        const cur = rMap.get(r.user_id) ?? [];
        cur.push(r.role as Role);
        rMap.set(r.user_id, cur);
      }
      return (profiles ?? []).map((p) => ({ ...p, roles: rMap.get(p.id) ?? [] }));
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const err = (k: keyof BusinessProfile) => errors[k];


  // Edit / Save / Cancel state per section (only one section editable at a time)
  const [editing, setEditing] = useState<Section | null>(null);
  const [snapshot, setSnapshot] = useState<BusinessProfile | null>(null);
  const dirty = useMemo(
    () => editing !== null && snapshot !== null && JSON.stringify(snapshot) !== JSON.stringify(biz),
    [editing, snapshot, biz],
  );

  // Confirm dialog for discarding unsaved changes (close section / cancel / navigate)
  const [confirm, setConfirm] = useState<null | { onConfirm: () => void; message?: string }>(null);
  const askDiscard = (onConfirm: () => void, message?: string) => {
    if (!dirty) { onConfirm(); return; }
    setConfirm({ onConfirm, message });
  };

  const startEdit = (section: Section) => {
    if (editing && editing !== section && dirty) {
      askDiscard(() => {
        if (snapshot) setBiz(snapshot);
        setErrors({});
        setSnapshot(biz);
        setEditing(section);
      });
      return;
    }
    setSnapshot(biz);
    setErrors({});
    setEditing(section);
  };

  const cancelEdit = () => {
    askDiscard(() => {
      if (snapshot) setBiz(snapshot);
      setEditing(null);
      setSnapshot(null);
      setErrors({});
    });
  };

  const [savedFlash, setSavedFlash] = useState<Section | null>(null);
  const [savingSection, setSavingSection] = useState<Section | null>(null);
  const [reloadingSection, setReloadingSection] = useState<Section | null>(null);
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const businessHeaderRef = useRef<HTMLButtonElement | null>(null);
  const paymentHeaderRef = useRef<HTMLButtonElement | null>(null);
  const sectionHeaderRef = (section: Section): React.RefObject<HTMLButtonElement | null> =>
    section === "business" ? businessHeaderRef : paymentHeaderRef;

  const sectionForField = (k: keyof BusinessProfile): Section | null => {
    if ((SECTION_FIELDS.business as (keyof BusinessProfile)[]).includes(k)) return "business";
    if ((SECTION_FIELDS.payment as (keyof BusinessProfile)[]).includes(k)) return "payment";
    return null;
  };

  const focusField = (k: keyof BusinessProfile) => {
    const section = sectionForField(k);
    if (section && editing !== section) startEdit(section);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${k}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el.querySelector<HTMLElement>(
        "input, textarea, select, [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    if (showErrorSummary && Object.keys(errors).length === 0) setShowErrorSummary(false);
  }, [errors, showErrorSummary]);

  // Screen-reader status line for save progress, reload and completion. We keep a single
  // polite live region and rewrite its text so AT users hear "Saving…", "Reloading…",
  // and "…saved" in sequence.
  const [saveStatus, setSaveStatus] = useState("");
  // Assertive live region text used only for save failures — screen readers interrupt
  // and immediately announce the reason so users can react without waiting.
  const [saveError, setSaveError] = useState("");
  const clearSaveStatus = (delay = 4000) => {
    const t = window.setTimeout(() => setSaveStatus(""), delay);
    return () => window.clearTimeout(t);
  };
  const clearSaveError = (delay = 6000) => {
    const t = window.setTimeout(() => setSaveError(""), delay);
    return () => window.clearTimeout(t);
  };



  const saveBiz = async () => {
    // Guard against double-submit (Enter key, banner + card, rapid clicks).
    // Reloading is also a busy state; ignore submissions until the UI finishes.
    if (savingSection || reloadingSection) return;
    const section = editing;
    const { ok, errors: e } = validateBusiness(biz);
    setErrors(e);
    if (!ok) {
      const count = Object.keys(e).length;
      const reason = count === 1 ? "1 field needs attention" : `${count} fields need attention`;
      toast.error(reason);
      setSaveError(`Save failed: ${reason}. Review highlighted fields below.`);
      clearSaveError(6000);
      setShowErrorSummary(true);
      // Scroll the page-level summary into view for sighted + AT users, then jump to first field.
      requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        errorSummaryRef.current?.focus({ preventScroll: true });
      });
      // Scroll to first invalid field in the currently editing section (fallback: any section).
      const order = editing
        ? [...SECTION_FIELDS[editing], ...SECTION_FIELDS[editing === "business" ? "payment" : "business"]]
        : [...SECTION_FIELDS.business, ...SECTION_FIELDS.payment];
      const firstKey = order.find((k) => !!e[k]);
      if (firstKey) {
        window.setTimeout(() => {
          const el = document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
          if (!el) return;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const focusable = el.querySelector<HTMLElement>(
            "input, textarea, select, [tabindex]:not([tabindex='-1'])",
          );
          focusable?.focus({ preventScroll: true });
        }, 350);
      }
      return;
    }

    if (section) setSavingSection(section);
    const label = section === "payment" ? "Payment & bank" : "Business identity";
    setSaveStatus(`Saving ${label}…`);
    try {
      // Small awaited tick so the loading state renders even for synchronous
      // local persistence — and gives room for a real network call later.
      await new Promise((r) => setTimeout(r, 250));
      saveBusiness(biz);
      setEditing(null);
      setSnapshot(null);
      setErrors({});
      setShowErrorSummary(false);
      if (section) {
        // After persistence, briefly "reload" the section so screen readers and users
        // know the UI is refreshing the data before declaring success.
        setSavedFlash(section);
        setReloadingSection(section);
        setSaveStatus(`Reloading ${label} data to confirm changes…`);
        await new Promise((r) => setTimeout(r, 400));
        setReloadingSection(null);
        setSaveStatus(`${label} saved and data refreshed.`);
        // Return keyboard focus to the saved section header so screen reader
        // and keyboard users land on a predictable, labelled control.
        requestAnimationFrame(() => {
          sectionHeaderRef(section).current?.focus({ preventScroll: true });
        });
        window.setTimeout(() => {
          setSavedFlash((cur) => (cur === section ? null : cur));
        }, 4000);
        toast.success(
          section === "payment"
            ? "Payment & bank details saved — new invoices will use them"
            : "Business identity saved — new invoices will use it",
        );
      }
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : "Please try again.";
      const label2 = section === "payment" ? "Payment & bank" : "Business identity";
      setSaveStatus("");
      setSaveError(`${label2} save failed: ${reason}`);
      clearSaveError(6000);
      toast.error(reason);
    } finally {
      setSavingSection(null);
      setReloadingSection(null);
      clearSaveStatus(4000);
    }
  };




  // Warn on browser unload while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Block in-app navigation while dirty.
  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm("You have unsaved changes. Leave without saving?");
    },
    enableBeforeUnload: false,
  });

  const sectionErrorItems = (section: Section) =>
    SECTION_FIELDS[section]
      .filter((k) => !!errors[k])
      .map((k) => ({ field: k, label: FIELD_LABELS[k] ?? String(k), message: errors[k]! }));

  const renderSectionBanner = (section: Section) => {
    const items = sectionErrorItems(section);
    if (reloadingSection === section) {
      return (
        <div
          className="mb-3 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <Loader2 className="size-4 shrink-0 mt-0.5 animate-spin" aria-label="Reloading section data" />
          <div className="flex-1">
            <div className="font-semibold">Reloading {section === "payment" ? "Payment & bank" : "Business identity"} data…</div>
            <div className="text-primary/80">Confirming your saved changes.</div>
          </div>
        </div>
      );
    }
    if (savedFlash === section) {
      return (
        <div
          className="mb-3 flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <div className="font-semibold">
              {section === "payment" ? "Payment & bank saved" : "Business identity saved"}
            </div>
            <div className="text-emerald-700/90">
              Changes are live and will appear on every new invoice.
            </div>
          </div>
        </div>
      );
    }
    if (items.length === 0) return null;
    return (
      <div
        className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <div className="font-semibold">
            {items.length === 1 ? "1 field needs attention" : `${items.length} fields need attention`}
          </div>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            {items.map((it) => (
              <li key={String(it.field)}>
                <span className="font-medium">{it.label}:</span> {it.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );

  };


  return (

    <PageContainer>
      {/* Polite SR-only live region: announces save start and completion. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {saveStatus}
      </div>
      {/* Assertive SR-only live region: announces save failures with a short reason. */}
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {saveError}
      </div>
      <PageHeader title="Settings" description="Business details, invoice branding and team roles." />
      {showErrorSummary && Object.keys(errors).length > 0 && (() => {
        const items = [...SECTION_FIELDS.business, ...SECTION_FIELDS.payment]
          .filter((k) => !!errors[k])
          .map((k) => ({
            field: k,
            label: FIELD_LABELS[k] ?? String(k),
            message: errors[k]!,
            section: sectionForField(k),
          }));
        return (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            aria-labelledby="settings-error-summary-title"
            className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <h2 id="settings-error-summary-title" className="font-semibold">
                  {items.length === 1
                    ? "Please fix 1 field before saving"
                    : `Please fix ${items.length} fields before saving`}
                </h2>
                <p className="text-xs text-destructive/80 mt-0.5">
                  Select a link to jump straight to the field.
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {items.map((it) => (
                    <li key={String(it.field)}>
                      <a
                        href={`#field-${String(it.field)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusField(it.field);
                        }}
                        className="font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 rounded-sm"
                      >
                        {it.label}
                      </a>
                      <span className="text-destructive/90">
                        {" "}— {it.message}
                        {it.section && (
                          <span className="text-destructive/60">
                            {" "}({it.section === "payment" ? "Payment & bank" : "Business identity"})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setShowErrorSummary(false)}
                className="text-destructive/70 hover:text-destructive text-xs px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                aria-label="Dismiss error summary"
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })()}
      {dirty && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          <span>You have unsaved changes in <b>{editing === "business" ? "Business identity" : "Payment & bank"}</b>.</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7" onClick={cancelEdit} disabled={!!savingSection}>Discard</Button>
            <Button size="sm" className="h-7" onClick={() => {
                if (savingSection || reloadingSection) return;
                saveBiz();
              }} disabled={!!savingSection || !!reloadingSection} aria-busy={!!savingSection || !!reloadingSection}>
              {savingSection ? (<><Loader2 className="size-3.5 mr-1 animate-spin" aria-label="Saving in progress" /> Saving…</>) : "Save"}
            </Button>

          </div>
        </div>

      )}

      <BlurValidateContext.Provider value={editing ? validateFieldOnBlur : null}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <CollapsibleCard
          icon={Building2}
          title="Business identity"
          description="Shown on every invoice header, print copy and PDF."
          summary={biz.name ? `${biz.name}${biz.gstin ? " · GSTIN " + maskMiddle(biz.gstin, 2, 4) : ""}` : "Not set — tap to add"}
          storageKey={me?.userId ? `settings:section:${me.userId}:business` : undefined}
          readOnly={!isAdmin}
          editing={editing === "business"}
          dirty={editing === "business" && dirty}
          onEdit={() => startEdit("business")}
          onCancel={cancelEdit}
          onSave={saveBiz}
          saving={savingSection === "business"}
          reloading={reloadingSection === "business"}
          headerRef={businessHeaderRef}
        >

          <div className="space-y-3">
            {renderSectionBanner("business")}
            <div className="grid grid-cols-2 gap-3">
              <FieldRow field="name" label="Trade name" error={err("name")} colSpan={2}>

                <Input
                  value={biz.name}
                  onChange={(e) => setField("name", e.target.value)}
                  aria-invalid={!!err("name")}
                />
              </FieldRow>
              <FieldRow field="legal_name" label="Legal name (optional)" error={err("legal_name")} colSpan={2}>
                <Input
                  value={biz.legal_name ?? ""}
                  onChange={(e) => setField("legal_name", e.target.value)}
                />
              </FieldRow>
              <FieldRow field="gstin" label="GSTIN" error={err("gstin")} hint="15 chars • state+PAN+entity+Z+checksum">
                <MaskedInput
                  value={biz.gstin}
                  onChange={(e) => setField("gstin", e.target.value)}
                  mask={(v) => maskMiddle(v, 2, 4)}
                  uppercase
                  maxLength={15}
                  invalid={!!err("gstin")}
                  placeholder="07AAAAA0000A1Z5"
                />
              </FieldRow>
              <FieldRow field="fssai" label="FSSAI" error={err("fssai")}>
                <MaskedInput
                  value={biz.fssai ?? ""}
                  onChange={(e) => setField("fssai", e.target.value)}
                  mask={(v) => maskTail(v, 4)}
                  maxLength={14}
                  inputMode="numeric"
                  invalid={!!err("fssai")}
                />
              </FieldRow>
              <FieldRow field="pan" label="PAN" error={err("pan")}>
                <MaskedInput
                  value={biz.pan ?? ""}
                  onChange={(e) => setField("pan", e.target.value)}
                  mask={(v) => maskMiddle(v, 2, 3)}
                  uppercase
                  maxLength={10}
                  invalid={!!err("pan")}
                  placeholder="AAAAA1234A"
                />
              </FieldRow>
              <FieldRow field="state" label="State (GST)" error={err("state")}>
                <Input
                  value={biz.state ?? ""}
                  onChange={(e) => setField("state", e.target.value)}
                  placeholder="Delhi"
                />
              </FieldRow>
              <FieldRow field="state_code" label="State code" error={err("state_code")}>
                <Input
                  value={biz.state_code ?? ""}
                  onChange={(e) => setField("state_code", e.target.value.replace(/\D/g, ""))}
                  placeholder="07"
                  maxLength={2}
                  inputMode="numeric"
                  aria-invalid={!!err("state_code")}
                />
              </FieldRow>
              <FieldRow field="invoice_prefix" label="Invoice prefix" error={err("invoice_prefix")}>
                <Input
                  value={biz.invoice_prefix ?? ""}
                  onChange={(e) => setField("invoice_prefix", e.target.value)}
                  placeholder="INV"
                  maxLength={8}
                  aria-invalid={!!err("invoice_prefix")}
                />
              </FieldRow>
              <FieldRow field="mobile" label="Mobile" error={err("mobile")}>
                <Input
                  value={biz.mobile}
                  onChange={(e) => setField("mobile", e.target.value)}
                  aria-invalid={!!err("mobile")}
                  inputMode="tel"
                />
              </FieldRow>
              <FieldRow field="email" label="Email" error={err("email")}>
                <Input
                  value={biz.email}
                  onChange={(e) => setField("email", e.target.value)}
                  aria-invalid={!!err("email")}
                  inputMode="email"
                />
              </FieldRow>
              <FieldRow field="address" label="Address" error={err("address")} colSpan={2}>
                <Textarea
                  rows={2}
                  value={biz.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </FieldRow>
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          icon={Landmark}
          title="Payment & bank"
          description="Printed on invoices. UPI VPA also powers the QR code retailers can scan to pay."
          summary={
            biz.upi_vpa || biz.bank_account
              ? [
                  biz.upi_vpa && maskVpa(biz.upi_vpa),
                  biz.bank_name,
                  biz.bank_account && `A/C ••${String(biz.bank_account).slice(-4)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Not set — tap to add"
          }
          storageKey={me?.userId ? `settings:section:${me.userId}:payment` : undefined}
          readOnly={!isAdmin}
          editing={editing === "payment"}
          dirty={editing === "payment" && dirty}
          onEdit={() => startEdit("payment")}
          onCancel={cancelEdit}
          onSave={saveBiz}
          saving={savingSection === "payment"}
          reloading={reloadingSection === "payment"}
          headerRef={paymentHeaderRef}
        >

          {renderSectionBanner("payment")}
          <div className="grid grid-cols-2 gap-3">
            <FieldRow field="upi_vpa" label="UPI VPA" error={err("upi_vpa")} colSpan={2} hint="Powers the QR retailers scan to pay">
              <MaskedInput
                value={biz.upi_vpa ?? ""}
                onChange={(e) => setField("upi_vpa", e.target.value)}
                mask={maskVpa}
                placeholder="dairyflow@okhdfcbank"
                invalid={!!err("upi_vpa")}
              />
            </FieldRow>
            <FieldRow field="bank_name" label="Bank name" error={err("bank_name")}>
              <Input
                value={biz.bank_name ?? ""}
                onChange={(e) => setField("bank_name", e.target.value)}
              />
            </FieldRow>
            <FieldRow field="bank_holder" label="Account holder" error={err("bank_holder")}>
              <Input
                value={biz.bank_holder ?? ""}
                onChange={(e) => setField("bank_holder", e.target.value)}
              />
            </FieldRow>
            <FieldRow field="bank_account" label="Account no." error={err("bank_account")}>
              <MaskedInput
                value={biz.bank_account ?? ""}
                onChange={(e) => setField("bank_account", e.target.value.replace(/\D/g, ""))}
                mask={(v) => maskTail(v, 4)}
                inputMode="numeric"
                maxLength={18}
                invalid={!!err("bank_account")}
              />
            </FieldRow>
            <FieldRow field="bank_ifsc" label="IFSC" error={err("bank_ifsc")}>
              <MaskedInput
                value={biz.bank_ifsc ?? ""}
                onChange={(e) => setField("bank_ifsc", e.target.value)}
                mask={(v) => maskMiddle(v, 4, 3)}
                uppercase
                maxLength={11}
                invalid={!!err("bank_ifsc")}
                placeholder="HDFC0000000"
              />
            </FieldRow>
            <FieldRow field="bank_branch" label="Branch" error={err("bank_branch")} colSpan={2}>
              <Input
                value={biz.bank_branch ?? ""}
                onChange={(e) => setField("bank_branch", e.target.value)}
              />
            </FieldRow>
            <FieldRow field="terms" label="Invoice terms & conditions" error={err("terms")} colSpan={2}>
              <Textarea
                rows={3}
                value={biz.terms ?? ""}
                onChange={(e) => setField("terms", e.target.value)}
              />
            </FieldRow>
          </div>
        </CollapsibleCard>


        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Team members</h3>
            {isAdmin ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-primary/10 text-primary flex items-center gap-1">
                <ShieldCheck className="size-3" /> Admin controls
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Read-only</span>
            )}
          </div>

          <div className="divide-y">
            {isLoading && (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading team…</div>
            )}
            {(users ?? []).map((u) => {
              const currentRole = (u.roles[0] ?? "salesperson") as Role;
              const isSelf = u.id === me?.userId;
              return (
                <div
                  key={u.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-muted grid place-items-center shrink-0">
                      <UserIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {u.full_name ?? u.email}
                        {isSelf && (
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin ? (
                      <Select
                        value={currentRole}
                        onValueChange={(v) => changeRole.mutate({ userId: u.id, role: v as Role })}
                        disabled={isSelf && currentRole === "admin"}
                      >
                        <SelectTrigger className="h-8 w-[150px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{r.label}</span>
                                <span className="text-[10px] text-muted-foreground">{r.hint}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ring-1 ${roleStyles[currentRole]}`}
                      >
                        {currentRole}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {!isLoading && (users ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No team members yet.
              </div>
            )}
          </div>
        </Card>
      </div>
      </BlurValidateContext.Provider>


      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.message ??
                "You have edits that haven't been saved yet. Discarding will revert them to the last saved values."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const fn = confirm?.onConfirm;
                setConfirm(null);
                fn?.();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}


function CollapsibleCard({
  icon: Icon,
  title,
  description,
  summary,
  defaultOpen = false,
  storageKey,
  readOnly = false,
  editing = false,
  dirty = false,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  reloading = false,
  headerRef,
  children,
}: {
  icon: any;
  title: string;
  description: string;
  summary: string;
  defaultOpen?: boolean;
  storageKey?: string;
  readOnly?: boolean;
  editing?: boolean;
  dirty?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  reloading?: boolean;
  headerRef?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {

  const [open, setOpen] = useState(defaultOpen);
  // Hydrate from localStorage once the per-user storageKey is known.
  useEffect(() => {
    if (readOnly) return;
    if (!storageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "1" || stored === "0") setOpen(stored === "1");
    } catch {}
  }, [storageKey, readOnly]);
  useEffect(() => {
    if (readOnly) return;
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {}
  }, [open, storageKey, readOnly]);
  // Auto-open the section while it's being edited or refreshed so the status banner is visible.
  useEffect(() => { if (editing || reloading) setOpen(true); }, [editing, reloading]);
  const effectiveOpen = readOnly ? false : open;


  const requestToggle = () => {
    if (readOnly) return;
    if (open && editing && dirty) {
      // Route close-with-unsaved-changes through Cancel (which prompts).
      onCancel?.();
      return;
    }
    if (open && editing) {
      // Close cleanly and exit edit mode.
      onCancel?.();
      setOpen(false);
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="w-full flex items-center gap-3 p-4">
        <button
          type="button"
          ref={headerRef}
          onClick={requestToggle}
          disabled={readOnly}
          className={`flex items-center gap-3 flex-1 min-w-0 text-left transition-colors -m-2 p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${readOnly ? "cursor-default" : "hover:bg-muted/40"}`}
          aria-expanded={effectiveOpen}
          title={readOnly ? "Admin-only — view only for your role" : undefined}
        >
          <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm flex items-center gap-2">
              {title}
              {editing && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20">
                  {dirty ? "Editing • unsaved" : "Editing"}
                </span>
              )}
            </div>
            {effectiveOpen ? (
              <div className="text-xs text-muted-foreground truncate">{description}</div>
            ) : (
              <div className="text-xs text-muted-foreground truncate">{summary}</div>
            )}
          </div>
          <ChevronDown
            className={`size-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {readOnly ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hidden sm:inline">
              Admin only
            </span>
          ) : editing ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onCancel?.()}
                disabled={saving || reloading}
              >
                <X className="size-3.5 mr-1" /> Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  // Extra defense in depth: ignore clicks while the section is
                  // already busy, even if a non-disabled ancestor somehow re-fired.
                  if (saving || reloading) return;
                  onSave?.();
                }}
                disabled={!dirty || saving || reloading}
                aria-disabled={!dirty || saving || reloading}
                aria-busy={saving || reloading}
              >
                {saving ? (
                  <><Loader2 className="size-3.5 mr-1 animate-spin" aria-label="Saving in progress" /> Saving…</>
                ) : reloading ? (
                  <><Loader2 className="size-3.5 mr-1 animate-spin" aria-label="Reloading section data" /> Reloading…</>
                ) : (
                  <><Check className="size-3.5 mr-1" /> Save</>
                )}
              </Button>
            </>

          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onEdit?.()}
            >
              <Pencil className="size-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>
      {effectiveOpen && (
        <div className="p-6 pt-2 border-t">
          <fieldset disabled={!editing} className={editing ? "" : "opacity-90"}>
            {children}
          </fieldset>
        </div>
      )}
    </Card>
  );
}



function FieldRow({
  field,
  label,
  error,
  hint,
  colSpan = 1,
  children,
}: {
  field?: string;
  label: string;
  error?: string;
  hint?: string;
  colSpan?: 1 | 2;
  children: React.ReactNode;
}) {
  const reactId = React.useId();
  const baseId = field ? `field-${field}` : reactId;
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  const onBlurValidate = React.useContext(BlurValidateContext);

  // Inject aria-describedby / aria-invalid / onBlur into the input child so
  // screen readers announce the specific inline message tied to this field —
  // and so validation runs as soon as focus leaves the field.
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, {
        "aria-describedby": [
          (children as React.ReactElement<any>).props["aria-describedby"],
          describedBy,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
        "aria-invalid":
          (children as React.ReactElement<any>).props["aria-invalid"] ?? (error ? true : undefined),
        onBlur: (e: React.FocusEvent<HTMLElement>) => {
          (children as React.ReactElement<any>).props.onBlur?.(e);
          if (field && onBlurValidate) onBlurValidate(field);
        },
      })
    : children;


  return (
    <div
      id={field ? `field-${field}` : undefined}
      data-field={field}
      className={`space-y-1.5 scroll-mt-24 ${colSpan === 2 ? "col-span-2" : ""}`}
    >
      <Label>{label}</Label>
      {child}
      {error ? (
        <p id={errorId} className="text-[11px] font-medium text-destructive" aria-live="polite">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}


