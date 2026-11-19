// Small spherical geometry, shared by the pipeline and the page.

export type LonLat = [number, number];
const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function km(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A point t of the way along the great circle from a to b. */
export function slerp(a: LonLat, b: LonLat, t: number): LonLat {
  const d = km(a, b) / R;
  if (d < 1e-9) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(rad(a[1])) * Math.cos(rad(a[0])) + B * Math.cos(rad(b[1])) * Math.cos(rad(b[0]));
  const y = A * Math.cos(rad(a[1])) * Math.sin(rad(a[0])) + B * Math.cos(rad(b[1])) * Math.sin(rad(b[0]));
  const z = A * Math.sin(rad(a[1])) + B * Math.sin(rad(b[1]));
  return [deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))];
}

const inEurope = (p: LonLat) => p[0] > -12 && p[0] < 32 && p[1] > 35 && p[1] < 62;
const inAustralasia = (p: LonLat) => p[0] > 110 && p[1] < -10 && p[1] > -50;

export type RouteKind = 'direct' | 'cape' | 'horn' | 'panama';
/**
 * How a voyage between Europe and New Zealand is drawn. A convention, not a record:
 * until the Panama Canal opened in 1914 ships for New Zealand, sail and steam alike,
 * went out round the Cape of Good Hope and came home round Cape Horn.
 */
export const ROUTE_LABEL: Record<RouteKind, string> = {
  direct: '',
  cape: 'Drawn along the usual route out at the time, round the Cape of Good Hope. The line follows that custom, not the course of one ship.',
  horn: 'Drawn along the usual route home at the time, round Cape Horn. The line follows that custom, not the course of one ship.',
  panama: 'Drawn through the Panama Canal, the usual route once it had opened. The line follows that custom, not the course of one ship.',
};

const CHANNEL: LonLat[] = [[1.5, 51.05], [-5.5, 49.3]];
const CAPE_OUT: LonLat[] = [[-13, 38], [-19, 27], [-26, 5], [-29, -24], [8, -40], [60, -45], [112, -47], [148, -46.5]];
const HORN_HOME: LonLat[] = [[-150, -51], [-110, -55], [-68, -57.5], [-45, -45], [-30, -20], [-28, 2], [-34, 30], [-18, 44]];
const PANAMA_OUT: LonLat[] = [[-30, 40], [-62, 20], [-79.9, 9.4], [-79.5, 8.9], [-95, -3], [-130, -22], [-160, -34]];

function nzApproach(p: LonLat, fromEast = false): LonLat[] {
  // east coast ports are reached round the bottom of the South Island, Wellington
  // through Cook Strait, northern ports round North Cape
  if (fromEast) return [];
  if (p[1] < -42.5) return [[166, -47.6], [171.5, -46.2]];
  if (p[1] < -39) return p[0] > 176 ? [[172.5, -34.2], [178.9, -37.5]] : [[172, -40.3]];
  return p[0] > 174.6 ? [[172.5, -34.1], [175.2, -35.8]] : [[173.5, -38.5]];
}

/**
 * The way a journey is drawn. Short moves are a great circle. A voyage between
 * Europe and New Zealand follows the customary route of its era, because the
 * great circle between near-antipodes is meaningless. That is a convention, not a record.
 */
export function route(a: LonLat, b: LonLat, year: number): { kind: RouteKind; pts: LonLat[] } {
  const out = inEurope(a) && inAustralasia(b), home = inAustralasia(a) && inEurope(b);
  if (!out && !home) return { kind: 'direct', pts: [a, b] };
  const eu = out ? a : b, nz = out ? b : a;
  // from the east of England and the Continent, down the Channel; from the west, straight to sea
  const lead: LonLat[] = eu[0] > -1.2 ? CHANNEL : [[-6.5, 50.5]];
  if (year >= 1915) {
    const pts = [eu, ...lead, ...PANAMA_OUT, ...nzApproach(nz, true), nz];
    return { kind: 'panama', pts: out ? pts : pts.reverse() };
  }
  if (out) return { kind: 'cape', pts: [eu, ...lead, ...CAPE_OUT, ...nzApproach(nz), nz] };
  return { kind: 'horn', pts: [nz, ...nzApproach(nz, true), ...HORN_HOME, ...[...lead].reverse(), eu] };
}

/** Densify a route into points no more than stepKm apart, with the running distance. */
export function densify(pts: LonLat[], stepKm = 150): { pts: LonLat[]; dist: number[]; total: number } {
  const out: LonLat[] = [pts[0]], dist = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = km(pts[i - 1], pts[i]);
    const n = Math.max(1, Math.ceil(d / stepKm));
    for (let j = 1; j <= n; j++) { out.push(slerp(pts[i - 1], pts[i], j / n)); dist.push(total + (d * j) / n); }
    total += d;
  }
  return { pts: out, dist, total };
}

export function routeKm(pts: LonLat[]): number { let t = 0; for (let i = 1; i < pts.length; i++) t += km(pts[i - 1], pts[i]); return t; }
