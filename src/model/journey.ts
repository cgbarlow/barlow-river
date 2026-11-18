// Where a person was, year by year, from the stops the records give.
//
// The records say "here in this year". They almost never say when a move
// happened. So between the last year a person is known in one place and the
// first year they are known in the next there is a window. When the window is
// short the light sails. When it is long nobody knows: the light stays where it
// was last recorded, dimming, and appears at the new place only in the year the
// records find it there. Nobody is drawn anywhere before a record puts them there.

import type { AtlasPerson, AtlasPlace, AtlasStop } from './atlas-types.ts';
import { km, type LonLat } from './geo.ts';

/** A window of this many years or fewer is drawn as a voyage. */
export const SAIL_MAX = 3;

export interface Stay { p: string; from: number; to: number; stops: AtlasStop[]; /** a closer place inside the vaguer one before it (New Zealand, then Carterton): the same stay known better, not a move */ within?: boolean }
export interface Leg { a: string; b: string; y0: number; y1: number; km: number; sail: boolean; /** rests on a disputed identity: the words from the record */ doubt?: string; /** not a move: a closer place inside the vaguer one before it */ within?: boolean; /** starts from a borrowed place, so it is an inference and not a recorded move */ assumed?: boolean }

const ORDER: Record<string, number> = { borrowed: 0, birth: 1, baptism: 1, census: 2, event: 2, marriage: 2, child: 2, death: 8, burial: 9 };

export function sortStops(stops: AtlasStop[]): AtlasStop[] {
  return [...stops].sort((a, b) => {
    // a borrowed place first, then birth and baptism in the order they happened, deaths last
    const grp = (k: string) => (ORDER[k] === 0 ? -2 : ORDER[k] === 1 ? -1 : ORDER[k] >= 8 ? 1 : 0);
    const ea = grp(a.kind), eb = grp(b.kind);
    return ea - eb || a.y - b.y || ORDER[a.kind] - ORDER[b.kind];
  });
}

const vague = (pl: AtlasPlace) => pl.prec === 'area' || pl.prec === 'country';
/** is `inner` somewhere inside the vaguer place `outer`? */
function contains(outer: AtlasPlace, inner: AtlasPlace): boolean {
  if (outer.id === inner.id || outer.country !== inner.country) return false;
  if (outer.prec === 'country') return inner.prec !== 'country';
  return outer.prec === 'area' && !vague(inner) && km(ll(outer), ll(inner)) < 120;
}
const lent = (st: Stay) => st.stops.every((x) => x.kind === 'borrowed');

/**
 * Consecutive stops in one place become one stay.
 * - "Norwich" and a Norwich parish are one stay, kept at the parish: a record that
 *   names only the town does not say the person left the parish.
 * - A record that names only the country or county the person is already in changes nothing.
 * - A record that names only a country or county they were NOT in is still a record:
 *   it starts a stay there, drawn as a haze. A later, closer place inside it is the
 *   same stay known better, marked `within`, and is not a move.
 * - A borrowed place never merges with a recorded one, even the same town: the light
 *   must be able to change from hollow to solid when the first record arrives.
 */
export function staysOf(person: AtlasPerson, place: (id: string) => AtlasPlace): Stay[] {
  const out: Stay[] = [];
  const town = (id: string) => place(id).town;
  for (const s of sortStops(person.stops)) {
    const last = out[out.length - 1];
    const same = last && lent(last) === (s.kind === 'borrowed');
    if (last && same && (last.p === s.p || town(last.p) === s.p || town(s.p) === last.p || contains(place(s.p), place(last.p)))) {
      if (town(s.p) === last.p) last.p = s.p;
      last.to = Math.max(last.to, s.y); last.stops.push(s);
    }
    else out.push({ p: s.p, from: last ? Math.max(s.y, last.to) : s.y, to: last ? Math.max(s.y, last.to) : s.y, stops: [s], ...(last && same && contains(place(last.p), place(s.p)) ? { within: true } : {}) });
  }
  return out;
}

export function legsOf(stays: Stay[], place: (id: string) => AtlasPlace): Leg[] {
  const out: Leg[] = [];
  for (let i = 1; i < stays.length; i++) {
    const a = place(stays[i - 1].p), b = place(stays[i].p);
    const y0 = stays[i - 1].to, y1 = stays[i].from;
    const doubt = [...stays[i - 1].stops, ...stays[i].stops].find((s) => s.doubt)?.doubt;
    const assumed = lent(stays[i - 1]), within = Boolean(stays[i].within);
    out.push({ a: a.id, b: b.id, y0, y1, km: km(ll(a), ll(b)), sail: y1 - y0 <= SAIL_MAX && !assumed && !within, ...(assumed ? { assumed } : {}), ...(within ? { within } : {}), ...(doubt && stays[i - 1].stops.every((s) => s.doubt) !== stays[i].stops.every((s) => s.doubt) ? { doubt } : {}) });
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
    // from a borrowed place there is no recorded departure: hold there until the first record
    // nor from a vague place to a closer one inside it: that is not a journey
    if (lent(s) || next.within) { if (year >= next.from) continue; return { i, a: s.p, b: next.p, t: w > 0 ? (year - s.to) / w : 0, sail: false, leg: i }; }
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

/** Where the records last put someone, as of a year: used to lend a place to a relative. */
export function lastKnown(stays: Stay[], year: number): string | null {
  const w = whereAt(stays, year);
  if (!w) return null;
  return w.b && w.sail && (w.t ?? 0) >= 0.5 ? w.b : w.a;
}

/** "in Norwich 1851, in Howick by 1855" */
export function windowText(leg: Leg, name: (id: string) => string): string {
  const a = name(leg.a), b = name(leg.b);
  if (leg.assumed) return `No record gives a place before ${leg.y1}: ${a} is where a parent was. First recorded in ${b} in ${leg.y1}.`;
  if (leg.y1 === leg.y0) return `In ${a} and in ${b} in ${leg.y0}.`;
  const n = leg.y1 - leg.y0;
  return `Last known in ${a} in ${leg.y0}. In ${b} by ${leg.y1}. The move was some time in ${n === 1 ? 'that year' : `those ${n} years`}.`;
}
