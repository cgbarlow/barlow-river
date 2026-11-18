// What is on the map in a given year. Pure: no DOM, no drawing.

import type { Person, RiverData } from '../model/types.ts';
import type { AtlasData, AtlasPerson, AtlasPlace } from '../model/atlas-types.ts';
import { legsOf, staysOf, whereAt, type Leg, type Stay } from '../model/journey.ts';
import { densify, route, type LonLat, type RouteKind } from '../model/geo.ts';

export interface RoutedLeg extends Leg { pts: LonLat[]; kind: RouteKind }
export interface Actor {
  id: string;
  p: Person;
  a: AtlasPerson;
  b: number;
  d: number;
  stays: Stay[];
  legs: RoutedLeg[];
  /** seat at each stay's site, so lights at a crowded place do not sit on each other */
  slots: number[];
  hollow: boolean;
  /** the last stay is a recorded death or burial */
  ember: boolean;
  /** first place is known only to a county or country */
  vague: boolean;
  disputed: boolean;
}

export interface Light { actor: Actor; ll: LonLat; slot: number; alpha: number; haze: boolean; site?: string; moving?: boolean }
export interface Trace { actor: Actor; leg: RoutedLeg; upto?: number; style: 'done' | 'sail' | 'fade' | 'doubt' | 'ahead'; alpha: number }
export interface Ember { actor: Actor; ll: LonLat; slot: number; alpha: number; site: string }
export interface Ripple { ll: LonLat; slot: number; age: number; kind: 'birth' | 'death'; actor: Actor }
export interface Scene { year: number; lights: Light[]; traces: Trace[]; embers: Ember[]; ripples: Ripple[]; alive: number; ship: LonLat | null }

export class World {
  places = new Map<string, AtlasPlace>();
  actors: Actor[] = [];
  byId = new Map<string, Actor>();
  /** site id -> actors who were ever there */
  atSite = new Map<string, Actor[]>();

  constructor(river: RiverData, atlas: AtlasData) {
    for (const p of atlas.places) this.places.set(p.id, p);
    const P = new Map(river.people.map((p) => [p.id, p]));
    const place = (id: string) => this.places.get(id)!;
    for (const a of atlas.people) {
      const p = P.get(a.id);
      if (!p || p.living || !p.b || !p.d) continue;
      const stays = staysOf(a, place);
      const legs = legsOf(stays, place).map((l) => {
        const A = place(l.a), B = place(l.b);
        const r = route([A.lon, A.lat], [B.lon, B.lat], l.y1);
        return { ...l, kind: r.kind, pts: densify(r.pts, 220).pts };
      });
      const last = stays[stays.length - 1].stops;
      const first = place(stays[0].p);
      const actor: Actor = { id: a.id, p, a, b: p.b.y, d: p.d.y, stays, legs, slots: [], hollow: Boolean(a.borrowed), ember: last.some((s) => s.kind === 'death' || s.kind === 'burial'), vague: first.prec === 'area' || first.prec === 'country', disputed: a.stops.some((s) => s.doubt) };
      this.actors.push(actor); this.byId.set(a.id, actor);
    }
    // seats: greedy interval colouring per site
    const items: { a: Actor; i: number; site: string; start: number; end: number }[] = [];
    for (const a of this.actors) a.stays.forEach((s, i) => {
      const site = this.siteId(s.p);
      items.push({ a, i, site, start: i ? a.stays[i - 1].to : a.b, end: i < a.stays.length - 1 ? a.stays[i + 1].from : a.d });
      const list = this.atSite.get(site) ?? []; if (!list.includes(a)) list.push(a); this.atSite.set(site, list);
    });
    items.sort((x, y) => x.start - y.start);
    const pools = new Map<string, number[]>();
    for (const it of items) { const pool = pools.get(it.site) ?? []; pools.set(it.site, pool); let k = pool.findIndex((e) => e <= it.start); if (k < 0) k = pool.length; pool[k] = it.end; it.a.slots[it.i] = k; }
  }

  siteId(placeId: string): string { return this.places.get(placeId)!.town ?? placeId; }
  site(placeId: string): AtlasPlace { return this.places.get(this.siteId(placeId))!; }
  ll(placeId: string): LonLat { const s = this.site(placeId); return [s.lon, s.lat]; }

  /** where one person's light is in a year, or null when they are not alive */
  lightOf(a: Actor, year: number): LonLat | null {
    if (year < a.b || year >= a.d) return null;
    const w = whereAt(a.stays, year)!;
    if (w.b && w.sail) return along(a.legs[w.leg!].pts, w.t!);
    return this.ll(w.b && (w.t ?? 0) > 0.5 ? w.b : w.a);
  }

  /** the country a person is in that year, 'sea' on a dated voyage, null when not alive */
  countryOf(a: Actor, year: number): string | null {
    if (year < a.b || year >= a.d) return null;
    const w = whereAt(a.stays, year)!;
    if (w.b && w.sail) return a.legs[w.leg!].km > 1500 ? 'sea' : this.places.get(w.b)!.country;
    return this.places.get(w.b && (w.t ?? 0) > 0.5 ? w.b : w.a)!.country;
  }
  /** every country the records name, with the middle of its places and everyone ever recorded there */
  countries(): { name: string; ll: LonLat; people: Actor[]; sites: string[]; first: number }[] {
    const m = new Map<string, { name: string; ll: LonLat; people: Actor[]; sites: string[]; first: number }>();
    for (const [site, people] of this.atSite) {
      const pl = this.places.get(site)!;
      const c = m.get(pl.country) ?? { name: pl.country, ll: [0, 0] as LonLat, people: [], sites: [], first: Infinity };
      c.sites.push(site); for (const a of people) if (!c.people.includes(a)) c.people.push(a);
      m.set(pl.country, c);
    }
    for (const c of m.values()) {
      c.ll = [c.sites.reduce((t, s) => t + this.places.get(s)!.lon, 0) / c.sites.length, c.sites.reduce((t, s) => t + this.places.get(s)!.lat, 0) / c.sites.length];
      for (const a of c.people) for (const st of a.stays) if (this.places.get(st.p)!.country === c.name) c.first = Math.min(c.first, st.from);
    }
    return [...m.values()].sort((a, b) => b.people.length - a.people.length);
  }

  scene(year: number, focus: Set<string> | null, selected: string | null): Scene {
    const lights: Light[] = [], traces: Trace[] = [], embers: Ember[] = [], ripples: Ripple[] = [];
    let alive = 0, ship: LonLat | null = null;
    for (const a of this.actors) {
      const sel = a.id === selected;
      const dim = focus ? (focus.has(a.id) ? 1 : 0.16) : selected && !sel ? 0.4 : 1;
      if (year < a.b) {
        // the whole of a selected life is laid out, the part still to come faintly
        if (sel) for (const l of a.legs) if (l.km > 3) traces.push({ actor: a, leg: l, style: 'ahead', alpha: 0.35 });
        continue;
      }
      const dead = year >= a.d;
      const idx = dead ? a.stays.length - 1 : whereAt(a.stays, year)!.i;
      for (let j = 0; j < a.legs.length; j++) {
        const l = a.legs[j];
        if (l.km <= 3) continue;
        if (j < idx) traces.push({ actor: a, leg: l, style: l.doubt ? 'doubt' : 'done', alpha: (sel ? 0.95 : dead ? 0.2 : 0.42) * dim });
        else if (sel && (dead || j > idx || !whereAt(a.stays, year)!.b)) traces.push({ actor: a, leg: l, style: 'ahead', alpha: 0.35 });
      }
      const s = a.stays[idx], here = this.ll(s.p), site = this.siteId(s.p);
      if (dead) {
        if (a.ember) embers.push({ actor: a, ll: here, slot: a.slots[idx], alpha: dim, site });
        if (year < a.d + 3) ripples.push({ ll: here, slot: a.slots[idx], age: (year - a.d) / 3, kind: 'death', actor: a });
        continue;
      }
      alive++;
      const prec = this.places.get(s.p)!.prec, haze = prec === 'area' || prec === 'country';
      if (year < a.b + 2) ripples.push({ ll: here, slot: a.slots[idx], age: (year - a.b) / 2, kind: 'birth', actor: a });
      const w = whereAt(a.stays, year)!;
      if (!w.b) { lights.push({ actor: a, ll: here, slot: a.slots[idx], alpha: dim, haze, site }); continue; }
      const l = a.legs[w.leg!], next = a.stays[w.leg! + 1];
      if (w.sail) {
        const p = along(l.pts, w.t!);
        lights.push({ actor: a, ll: p, slot: -1, alpha: dim, haze: false, moving: true });
        if (l.km > 3) traces.push({ actor: a, leg: l, upto: w.t, style: 'sail', alpha: 0.95 * dim });
        if (l.km > 9000) ship = p;
      } else {
        const np = this.places.get(next.p)!.prec;
        lights.push({ actor: a, ll: here, slot: a.slots[idx], alpha: Math.max(0.18, 1 - w.t!) * dim, haze, site });
        lights.push({ actor: a, ll: this.ll(next.p), slot: a.slots[w.leg! + 1], alpha: Math.max(0.18, w.t!) * dim, haze: np === 'area' || np === 'country', site: this.siteId(next.p) });
        if (l.km > 3) traces.push({ actor: a, leg: l, style: l.doubt ? 'doubt' : 'fade', alpha: (sel ? 0.9 : 0.5) * dim });
      }
    }
    return { year, lights, traces, embers, ripples, alive, ship };
  }
}

export function along(pts: LonLat[], t: number): LonLat {
  const f = Math.max(0, Math.min(1, t)) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
  let dl = pts[i + 1][0] - pts[i][0]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
  return [pts[i][0] + dl * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
}
