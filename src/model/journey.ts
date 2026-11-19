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
import { ageBetween } from './kin.ts';

/** A window of this many years or fewer is drawn as a voyage. */
export const SAIL_MAX = 3;

export interface Stay { p: string; from: number; to: number; stops: AtlasStop[]; /** the last year here rests only on a record naming the county or country, not this place */ toVague?: boolean; /** a closer place inside the vaguer one before it (New Zealand, then Carterton): the same stay known better, not a move */ within?: boolean }
export interface Leg { a: string; b: string; /** the places as the records at each end name them: a stay is kept at the closest place ever recorded, which a given year's record may not name */ ra: string; rb: string; /** the full dates of the records at each end, where the tree gives them */ d0?: string; d1?: string; /** a death in one place and the burial in another: the order is known */ burial?: boolean; y0: number; y1: number; km: number; sail: boolean; /** rests on a disputed identity: the words from the record */ doubt?: string; /** not a move: one end is the county or country that holds the other */ within?: boolean; /** starts from a borrowed place, so it is an inference and not a recorded move */ assumed?: boolean; /** both ends are borrowed: a child drawn with a parent, going where the parent is next recorded */ follows?: boolean; /** the year at that end is only approximate in the record */ approx0?: boolean; approx1?: boolean }

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
  // a county holds the places named as being in it: "Sproughton, Suffolk" is in Suffolk, and is not in Essex however near
  return outer.prec === 'area' && !vague(inner) && inner.name.endsWith(', ' + outer.name);
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
      { const vg = contains(place(s.p), place(last.p)); if (s.y > last.to) last.toVague = vg; else if (s.y === last.to && !vg) last.toVague = false; }
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
    // the window opens at the last record that names the place being left: one that names only its county or country does not
    const y0 = Math.max(-Infinity, ...stays[i - 1].stops.filter((x) => !contains(place(x.p), a)).map((x) => x.y)) > -Infinity ? Math.max(...stays[i - 1].stops.filter((x) => !contains(place(x.p), a)).map((x) => x.y)) : stays[i - 1].to, y1 = stays[i].from;
    const doubt = [...stays[i - 1].stops, ...stays[i].stops].find((s) => s.doubt)?.doubt;
    // a record that names only the county or country of the place before it (or the reverse) is the same place known better or worse, not a move
    const assumed = lent(stays[i - 1]), within = Boolean(stays[i].within) || contains(a, b) || contains(b, a), follows = assumed && lent(stays[i]);
    const ap0 = stays[i - 1].stops.some((x) => x.y === y0 && x.approx) && !stays[i - 1].stops.some((x) => x.y === y0 && !x.approx);
    const ap1 = stays[i].stops.some((x) => x.y === y1 && x.approx) && !stays[i].stops.some((x) => x.y === y1 && !x.approx);
    // a voyage is only drawn sailing when both ends are firm dates
    const s0 = [...stays[i - 1].stops].reverse().find((x) => x.y === y0 && !contains(place(x.p), a)) ?? [...stays[i - 1].stops].reverse().find((x) => x.y === y0) ?? stays[i - 1].stops[stays[i - 1].stops.length - 1], s1 = stays[i].stops.find((x) => x.y === y1) ?? stays[i].stops[0];
    const ra = s0.p, rb = s1.p;
    const burial = y0 === y1 && s0.kind === 'death' && stays[i].stops.every((x) => x.kind === 'burial');
    out.push({ a: a.id, b: b.id, ra, rb, ...(s0.date ? { d0: s0.date } : {}), ...(s1.date ? { d1: s1.date } : {}), ...(burial ? { burial } : {}), y0, y1, km: km(ll(a), ll(b)), sail: y1 - y0 <= SAIL_MAX && !assumed && !within && !ap0 && !ap1 && !burial && !stays[i - 1].toVague, ...(ap0 ? { approx0: true } : {}), ...(ap1 ? { approx1: true } : {}), ...(assumed ? { assumed } : {}), ...(follows ? { follows } : {}), ...(within ? { within } : {}), ...(doubt && stays[i - 1].stops.every((s) => s.doubt) !== stays[i].stops.every((s) => s.doubt) ? { doubt } : {}) });
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
    if (w === 0 && !(s.stops.some((x) => x.y === s.to && x.approx) && !s.stops.some((x) => x.y === s.to && !x.approx)) && !(next.stops.some((x) => x.y === next.from && x.approx) && !next.stops.some((x) => x.y === next.from && !x.approx)) && !s.toVague && year >= next.from && year < next.from + 1) return { i, a: s.p, b: next.p, t: year - next.from, sail: true, leg: i };
    if (year >= next.from) continue;
    const loose = s.stops.some((x) => x.y === s.to && x.approx) && !s.stops.some((x) => x.y === s.to && !x.approx) || next.stops.some((x) => x.y === next.from && x.approx) && !next.stops.some((x) => x.y === next.from && !x.approx);
    // a last record that names only the county or country does not date a departure from this town
    if (w <= SAIL_MAX && !loose && !s.toVague) {
      // a voyage is drawn over its window, never less than a year
      const span = Math.max(1, w), start = next.from - span;
      if (year <= start) return { i, a: s.p };
      return { i, a: s.p, b: next.p, t: (year - start) / span, sail: true, leg: i };
    }
    return { i, a: s.p, b: next.p, t: w > 0 ? (year - s.to) / w : 0, sail: false, leg: i };
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
  // each place as the record of that year names it
  const a = name(leg.ra), b = name(leg.rb);
  if (leg.burial) return `Died in ${a} and was buried in ${b}, in ${leg.y0}.`;
  if (leg.follows) return `No record of their own for either place. Drawn with a parent in ${a}, then in ${b} from ${leg.y1}, where that parent is next recorded.`;
  if (leg.assumed) return `No record gives a place before ${leg.y1}: ${a} is where a parent was. First recorded in ${b} in ${leg.y1}.`;
  const y0 = `${leg.approx0 ? 'about ' : ''}${leg.y0}`, y1 = `${leg.approx1 ? 'about ' : ''}${leg.y1}`;
  if (leg.y1 === leg.y0) return leg.km > 1500 ? `In ${a} and in ${b} in ${y0}.` : `In ${a} and in ${b} in ${y0}. The records do not say which came first.`;
  // counted from the full dates where the tree has both
  const n = leg.d0 && leg.d1 && !leg.approx0 && !leg.approx1 ? Number(ageBetween({ y: leg.y0, text: leg.d0 }, { y: leg.y1, text: leg.d1 })) || leg.y1 - leg.y0 : leg.y1 - leg.y0;
  return `Last known in ${a} in ${y0}. In ${b} by ${y1}. The move was some time in ${n <= 1 ? 'that year' : `those ${leg.approx0 || leg.approx1 ? 'roughly ' : ''}${n} years`}.`;
}
