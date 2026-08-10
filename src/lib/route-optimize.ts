// Travel-distance based stop-sequence optimizer.
// Uses Haversine distances + nearest-neighbor seed + 2-opt improvement.

export type OptStop = {
  id: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
};

const R = 6371; // km

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function tourLength(
  order: number[],
  pts: { lat: number; lng: number }[],
  start?: { lat: number; lng: number } | null,
): number {
  let total = 0;
  let prev = start ?? pts[order[0]];
  const from = start ? 0 : 1;
  if (!start) prev = pts[order[0]];
  for (let i = from; i < order.length; i++) {
    total += haversineKm(prev, pts[order[i]]);
    prev = pts[order[i]];
  }
  return total;
}

// Nearest-neighbor construction
function nearestNeighbor(
  pts: { lat: number; lng: number }[],
  start: { lat: number; lng: number } | null,
): number[] {
  const n = pts.length;
  if (n === 0) return [];
  const visited = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  let cur = start;
  if (!cur) {
    order.push(0);
    visited[0] = true;
    cur = pts[0];
  }
  while (order.length < n) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = haversineKm(cur!, pts[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) break;
    visited[best] = true;
    order.push(best);
    cur = pts[best];
  }
  return order;
}

// 2-opt improvement (open tour: no return to start)
function twoOpt(
  order: number[],
  pts: { lat: number; lng: number }[],
  start: { lat: number; lng: number } | null,
  maxPasses = 20,
): number[] {
  const n = order.length;
  if (n < 4) return order;
  let best = order.slice();
  let improved = true;
  let passes = 0;
  while (improved && passes < maxPasses) {
    improved = false;
    passes++;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        // reverse segment [i..k]
        const cand = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        if (tourLength(cand, pts, start) + 1e-9 < tourLength(best, pts, start)) {
          best = cand;
          improved = true;
        }
      }
    }
  }
  return best;
}

export type OptimizeResult<T extends OptStop> = {
  ordered: T[];
  optimizedCount: number;
  skippedCount: number;
  beforeKm: number;
  afterKm: number;
};

export function optimizeStops<T extends OptStop>(
  stops: T[],
  start: { lat: number | null | undefined; lng: number | null | undefined } | null,
): OptimizeResult<T> {
  const geo: (T & { lat: number; lng: number })[] = [];
  const skipped: T[] = [];
  for (const s of stops) {
    if (typeof s.lat === "number" && typeof s.lng === "number" && isFinite(s.lat) && isFinite(s.lng)) {
      geo.push(s as T & { lat: number; lng: number });
    } else {
      skipped.push(s);
    }
  }
  if (geo.length < 2) {
    return {
      ordered: [...geo, ...skipped],
      optimizedCount: geo.length,
      skippedCount: skipped.length,
      beforeKm: 0,
      afterKm: 0,
    };
  }
  const startPt =
    start && typeof start.lat === "number" && typeof start.lng === "number"
      ? { lat: start.lat, lng: start.lng }
      : null;
  const pts = geo.map((s) => ({ lat: s.lat, lng: s.lng }));
  const initial = geo.map((_, i) => i);
  const beforeKm = tourLength(initial, pts, startPt);
  const nn = nearestNeighbor(pts, startPt);
  const opt = twoOpt(nn, pts, startPt);
  const afterKm = tourLength(opt, pts, startPt);
  const ordered = opt.map((i) => geo[i]);
  return {
    ordered: [...ordered, ...skipped],
    optimizedCount: geo.length,
    skippedCount: skipped.length,
    beforeKm,
    afterKm,
  };
}
