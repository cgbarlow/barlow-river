// Where a person was, year by year, from the stops the records give.
//
// The records say "here in this year". They almost never say when a move
// happened. So between the last year a person is known in one place and the
// first year they are known in the next there is a window. When the window is
// short the light sails. When it is long nobody knows, and the light is drawn
// fading out of one place and into the other across the years it could have been.

import type { AtlasPerson, AtlasPlace, AtlasStop } from './atlas-types.ts';
import { km, type LonLat } from './geo.ts';

/** A window of this many years or fewer is drawn as a voyage. */
export const SAIL_MAX = 3;

export interface Stay { p: string; from: number; to: number; stops: AtlasStop[] }
export interface Leg { a: string; b: string; y0: number; y1: number; km: number; sail: boolean; /** rests on a disputed identity: the words from the record */ doubt?: string }

const ORDER: Record<string, number> = { borrowed: 0, birth: 0, baptism: 1, census: 2, event: 2, marriage: 2, child: 2, death: 8, burial: 9 };

export function sortStops(stops: AtlasStop[]): AtlasStop[] {
  return [...stops].sort((a, b) => {
    const ea = ORDER[a.kind] === 0 ? -1 : ORDER[a.kind] >= 8 ? 1 : 0, eb = ORDER[b.kind] === 0 ? -1 : ORDER[b.kind] >= 8 ? 1 : 0;
    return ea - eb || a.y - b.y || ORDER[a.kind] - ORDER[b.kind];
  });
}

/**
 * Consecutive stops in one place become one stay. Coarse stops are left out.
 * "Norwich" and a Norwich parish are one stay, kept at the parish: a record that
 * names only the town does not say the person left the parish.
 */
export function staysOf(person: AtlasPerson, place: (id: string) => AtlasPlace): Stay[] {
  const out: Stay[] = [];
  const town = (id: string) => place(id).town;
  for (const s of sortStops(person.stops)) {
    if (s.coarse) continue;
    const last = out[out.length - 1];
    if (last && (last.p === s.p || town(last.p) === s.p || town(s.p) === last.p)) {
      if (town(s.p) === last.p) last.p = s.p;
      last.to = Math.max(last.to, s.y); last.stops.push(s);
    }
    else out.push({ p: s.p, from: last ? Math.max(s.y, last.to) : s.y, to: last ? Math.max(s.y, last.to) : s.y, stops: [s] });
  }
  return out;
}

export function legsOf(stays: Stay[], place: (id: string) => AtlasPlace): Leg[] {
  const out: Leg[] = [];
  for (let i = 1; i < stays.length; i++) {
    const a = place(stays[i - 1].p), b = place(stays[i].p);
    const y0 = stays[i - 1].to, y1 = stays[i].from;
    const doubt = [...stays[i - 1].stops, ...stays[i].stops].find((s) => s.doubt)?.doubt;
    out.push({ a: a.id, b: b.id, y0, y1, km: km(ll(a), ll(b)), sail: y1 - y0 <= SAIL_MAX, ...(doubt && stays[i - 1].stops.every((s) => s.doubt) !== stays[i].stops.every((s) => s.doubt) ? { doubt } : {}) });
  }
  return out;
}

export const ll = (p: AtlasPlace): LonLat => [p.lon, p.lat];

export interface Where {
  /** index of the stay they are at, or are leaving */
  i: number;
  /** the place they are at, or are leaving */
  a: string;
  /** the place they are going to, when between two */
  b?: string;
  /** how far along, 0 to 1 */
  t?: number;
  /** true when the window is short enough to draw as a voyage */
  sail?: boolean;
  /** index of the leg in legsOf() */
  leg?: number;
}

export function whereAt(stays: Stay[], year: number): Where | null {
  if (!stays.length) return null;
  for (let i = 0; i < stays.length; i++) {
    const s = stays[i], next = stays[i + 1];
    if (!next || year <= s.to) return { i, a: s.p };
    const w = next.from - s.to;
    // both ends recorded in the same year: the voyage is drawn across that year
    if (w === 0 && year >= next.from && year < next.from + 1) return { i, a: s.p, b: next.p, t: year - next.from, sail: true, leg: i };
    if (year >= next.from) continue;
    if (w <= SAIL_MAX) {
      // a voyage is drawn over its window, never less than a year
      const span = Math.max(1, w), start = next.from - span;
      if (year <= start) return { i, a: s.p };
      return { i, a: s.p, b: next.p, t: (year - start) / span, sail: true, leg: i };
    }
    return { i, a: s.p, b: next.p, t: (year - s.to) / w, sail: false, leg: i };
  }
  return { i: stays.length - 1, a: stays[stays.length - 1].p };
}

/** The single likeliest place in a year: used to lend a place to a relative. */
export function mostLikely(stays: Stay[], year: number): string | null {
  const w = whereAt(stays, year);
  if (!w) return null;
  return w.b && (w.t ?? 0) >= 0.5 ? w.b : w.a;
}

/** "in Norwich 1851, in Howick by 1855" */
export function windowText(leg: Leg, name: (id: string) => string): string {
  const a = name(leg.a), b = name(leg.b);
  if (leg.y1 === leg.y0) return `In ${a} and in ${b} in ${leg.y0}.`;
  return `Last known in ${a} in ${leg.y0}. In ${b} by ${leg.y1}. The move was some time in those ${leg.y1 - leg.y0} years.`;
}
