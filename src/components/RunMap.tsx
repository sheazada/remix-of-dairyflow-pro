import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, LayersControl, LayerGroup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  kind: "pickup_start" | "run_start" | "run_end" | "pod" | "shop" | "gps_ok" | "gps_failed";
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  accuracy?: number | null;
  when?: string | null;
  order?: number | null;
};

const COLORS: Record<MapPoint["kind"], string> = {
  pickup_start: "#f59e0b",
  run_start: "#10b981",
  run_end: "#ef4444",
  pod: "#2563eb",
  shop: "#64748b",
  gps_ok: "#0ea5e9",
  gps_failed: "#dc2626",
};

function pinIcon(color: string, label = "") {
  const html = `<div style="position:relative;transform:translate(-50%,-100%)">
    <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;font-family:system-ui">${label}</span>
    </div>
  </div>`;
  return L.divIcon({ html, className: "", iconSize: [28, 28], iconAnchor: [0, 0] });
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else {
      const b = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}


export default function RunMap({ points, height = 480 }: { points: MapPoint[]; height?: number }) {
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [20.5937, 78.9629];
    const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
    const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;
    return [lat, lng];
  }, [points]);

  const path = useMemo(() => {
    const seq = points
      .filter(p => p.kind === "pod" && p.order != null)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const head = points.find(p => p.kind === "run_start") ?? points.find(p => p.kind === "pickup_start");
    const tail = points.find(p => p.kind === "run_end");
    const arr: [number, number][] = [];
    if (head) arr.push([head.lat, head.lng]);
    seq.forEach(p => arr.push([p.lat, p.lng]));
    if (tail) arr.push([tail.lat, tail.lng]);
    return arr;
  }, [points]);

  const containerRef = useRef<HTMLDivElement>(null);

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground" style={{ height }}>
        No GPS points captured for this run yet.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-md border" style={{ height }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Streets">
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="Route path">
            <LayerGroup>
              {path.length >= 2 && (
                <Polyline positions={path} pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.7, dashArray: "6 6" }} />
              )}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
        {points.map((p, i) => (
          <Marker key={p.id + i} position={[p.lat, p.lng]} icon={pinIcon(COLORS[p.kind], p.order != null ? String(p.order) : labelFor(p.kind))}>
            <Popup>
              <div className="space-y-1 text-xs">
                <div className="font-semibold">{p.title}</div>
                {p.subtitle && <div className="text-muted-foreground">{p.subtitle}</div>}
                {p.when && <div className="text-muted-foreground">{new Date(p.when).toLocaleString()}</div>}
                <div className="font-mono">{p.lat.toFixed(6)}, {p.lng.toFixed(6)}{p.accuracy != null ? ` · ±${Math.round(p.accuracy)}m` : ""}</div>
                <a className="text-blue-600 underline" href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

function labelFor(k: MapPoint["kind"]) {
  switch (k) {
    case "pickup_start": return "P";
    case "run_start": return "S";
    case "run_end": return "E";
    case "pod": return "•";
    case "shop": return "•";
    case "gps_ok": return "✓";
    case "gps_failed": return "!";
  }
}
