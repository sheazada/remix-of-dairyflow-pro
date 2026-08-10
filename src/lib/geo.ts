import { supabase } from "@/integrations/supabase/client";

export type GeoFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

export type GpsEventType =
  | "run_start"
  | "run_end"
  | "pickup_confirm"
  | "delivery_pod"
  | "shop_geotag"
  | "route_start_point"
  | "other";

export type GpsAuditContext = {
  run_id?: string | null;
  delivery_id?: string | null;
  customer_id?: string | null;
  route_id?: string | null;
  invoice_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

function errorCodeName(code: number | undefined): string | null {
  switch (code) {
    case 1: return "PERMISSION_DENIED";
    case 2: return "POSITION_UNAVAILABLE";
    case 3: return "TIMEOUT";
    default: return code != null ? String(code) : null;
  }
}

export async function getCurrentPosition(options?: PositionOptions): Promise<GeoFix> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    const e = new Error("Geolocation not supported on this device") as Error & { code?: string };
    e.code = "UNSUPPORTED";
    throw e;
  }
  return new Promise<GeoFix>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
      }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Location unavailable. Check GPS/network signal."
            : err.code === err.TIMEOUT
            ? "Location request timed out. Try again."
            : err.message || "Failed to get location";
        const wrapped = new Error(msg) as Error & { code?: string };
        wrapped.code = errorCodeName(err.code) ?? undefined;
        reject(wrapped);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000, ...options },
    );
  });
}

/** Insert a row into gps_audit_logs. Never throws — audit failures must not block the caller. */
export async function logGpsAudit(
  eventType: GpsEventType,
  success: boolean,
  ctx: GpsAuditContext & {
    fix?: GeoFix | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    await supabase.from("gps_audit_logs" as any).insert({
      event_type: eventType,
      success,
      latitude: ctx.fix?.latitude ?? null,
      longitude: ctx.fix?.longitude ?? null,
      accuracy: ctx.fix?.accuracy ?? null,
      error_code: ctx.errorCode ?? null,
      error_message: ctx.errorMessage ?? null,
      run_id: ctx.run_id ?? null,
      delivery_id: ctx.delivery_id ?? null,
      customer_id: ctx.customer_id ?? null,
      route_id: ctx.route_id ?? null,
      invoice_id: ctx.invoice_id ?? null,
      user_id: userRes?.user?.id ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      metadata: ctx.metadata ?? null,
    });
  } catch (e) {
    console.warn("gps audit log failed", e);
  }
}

/**
 * Capture GPS and record the attempt (success or failure) in gps_audit_logs.
 * Returns the fix on success, or null on failure. Never throws.
 */
export async function captureGpsWithAudit(
  eventType: GpsEventType,
  ctx: GpsAuditContext = {},
  options?: PositionOptions,
): Promise<{ fix: GeoFix | null; error: (Error & { code?: string }) | null }> {
  try {
    const fix = await getCurrentPosition(options);
    await logGpsAudit(eventType, true, { ...ctx, fix });
    return { fix, error: null };
  } catch (err: any) {
    await logGpsAudit(eventType, false, {
      ...ctx,
      errorCode: err?.code ?? null,
      errorMessage: err?.message ?? String(err),
    });
    return { fix: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function fmtLatLng(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return null;
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function gmapsUrl(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Great-circle distance in kilometers between two lat/lng points. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
