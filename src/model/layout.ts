// The river layout. The network is the pedigree of the youngest generation:
// every ancestral marriage is a confluence, placed at its year. Everyone else
// rides in the channel of the ancestors they descend from.

import type { Family, Person, RiverData, Tier } from './types.ts';

export const PXY = 4; // world pixels per year, after 1700
const WARP_YEAR = 1700; // before this the river is sparse, so time is drawn at half scale
const WARP = 0.5;
const DOT = 7.6; // minimum centre distance between two people
const GAP = 9; // clear water between neighbouring channels
const BEND_YEARS = 13;

export const LINES = ['Barlow', 'Finch', 'Carter', 'Watkins', 'Chmielewski', 'Czeladka', 'Klos'] as const;
export type LineName = (typeof LINES)[number];

export interface Segment { x0: number; x1: number; tier: Tier | 'known' }
export interface Stream {
  id: number;
  chain: string[];
  kind: 'trunk' | 'tributary' | 'side' | 'oxbow';
  name: string;
  line: LineName;
  /** true when the stream is a lesser tributary coloured by the line it feeds */
  minor: boolean;
  into?: Stream;
  tribs: Stream[];
  /** years */
  startX: number;
  joinX: number;
  /** the family whose marriage is the confluence */
  joinFam?: string;
  side: number;
  off: number;
  y: number;
  bend: number;
  /** cut off from the river entirely: an oxbow lake */
  cut: boolean;
  segments: Segment[];
  /** half-width in px, indexed by year - Y0 */
  hw: Float32Array;
  members: string[];
  region?: string;
}
export interface Spot { id: string; x: number; y: number; year: number; stream: Stream; anc: boolean; gen?: number; off: number }
export interface Layout {
  Y0: number;
  Y1: number;
  streams: Stream[];
  trunk: Stream;
  spots: Map<string, Spot>;
  mouthFamily: string;
  bounds: { x0: number; x1: number; y0: number; y1: number };
  /** year -> world x */
  X: (year: number) => number;
  invX: (x: number) => number;
  centre: (s: Stream, year: number) => number;
  halfWidth: (s: Stream, year: number) => number;
  /** downstream path from a person to the mouth, in world coordinates */
  route: (id: string) => [number, number][];
  /** unbroken evidence on the trunk reaches back to this person */
  proofHead?: string;
  breaks: { child: string; tier: Tier }[];
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase();
function lineOfSurname(s?: string): LineName | undefined {
  if (!s) return undefined;
  const f = fold(s);
  if (f.startsWith('chmielewsk')) return 'Chmielewski';
  return LINES.find((l) => fold(l) === f);
}
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function buildLayout(data: RiverData, softBreaks: Set<string> = new Set()): Layout {
  const P = new Map(data.people.map((p) => [p.id, p]));
  const F = new Map(data.families.map((f) => [f.id, f]));
  const thisYear = data.meta.thisYear;
  const yearOf = (id: string) => { const p = P.get(id)!; return p.living ? p.estY! : p.b!.y; };
  const endOf = (id: string) => { const p = P.get(id)!; return p.living ? thisYear + 1 : Math.max(p.d!.y, p.b!.y); };

  // ---- the mouth: the sibship with the most ancestors ----
  const ancCount = new Map<string, number>();
  const countAnc = (id: string, guard = 0): number => {
    if (ancCount.has(id)) return ancCount.get(id)!;
    const f = P.get(id)!.parents ? F.get(P.get(id)!.parents!) : undefined;
    let n = 0;
    if (f && guard < 60) for (const q of f.partners) n += 1 + countAnc(q, guard + 1);
    ancCount.set(id, n);
    return n;
  };
  let mouth = data.people[0];
  for (const p of data.people) {
    const a = countAnc(p.id), b = countAnc(mouth.id);
    if (a > b || (a === b && yearOf(p.id) < yearOf(mouth.id))) mouth = p;
  }
  const mouthFamily = mouth.parents!;
  const leaf = F.get(mouthFamily)?.children[0] ?? mouth.id;

  // ---- streams ----
  const streams: Stream[] = [];
  const owner = new Map<string, Stream>();
  const gen = new Map<string, number>();
  const pickPrimary = (f: Family): [string | undefined, string | undefined] => {
    const [a, b] = f.partners;
    if (!b) return [a, undefined];
    const pa = P.get(a)!, pb = P.get(b)!;
    // The GEDCOM sometimes files a wife in the husband slot. Trust sex where it is known.
    if (pa.sex === 'F' && pb.sex === 'M') return [b, a];
    return [a, b];
  };
  const grow = (leafId: string, kind: Stream['kind'], g: number): Stream => {
    const s: Stream = {
      id: streams.length, chain: [leafId], kind, name: '', line: 'Barlow', minor: false, tribs: [],
      startX: 0, joinX: thisYear, side: 1, off: 0, y: 0, bend: BEND_YEARS, cut: false, segments: [], hw: new Float32Array(0), members: [],
    };
    streams.push(s);
    let cur = leafId;
    for (;;) {
      owner.set(cur, s);
      gen.set(cur, g);
      const f = P.get(cur)!.parents ? F.get(P.get(cur)!.parents!) : undefined;
      if (!f || !f.partners.length) break;
      const [prim, other] = pickPrimary(f);
      if (other && !owner.has(other)) {
        const t = grow(other, kind === 'trunk' ? 'tributary' : kind, g + 1);
        t.into = s;
        t.joinFam = f.id;
        const floor = Math.max(yearOf(other), prim ? yearOf(prim) : -Infinity) + 15;
        t.joinX = Math.max(Math.min(f.estY, yearOf(cur) - 1), Math.min(floor, yearOf(cur) - 1));
        s.tribs.push(t);
      }
      if (!prim || owner.has(prim)) break;
      cur = prim;
      g += 1;
      s.chain.unshift(cur);
    }
    return s;
  };
  const trunk = grow(leaf, 'trunk', 0);
  const isAnc = new Set(owner.keys());

  // ---- everyone else: ride with the ancestors they descend from ----
  const home = new Map<string, Stream>(owner);
  const pref = new Map<string, string>(); // person -> relative to sit beside
  const downstream = (s: Stream, year: number) => { while (s.into && !s.cut && year > s.joinX) s = s.into; return s; };
  const sweep = () => {
    for (let changed = true; changed;) {
      changed = false;
      for (const p of data.people) {
        if (home.has(p.id)) continue;
        const pf = p.parents ? F.get(p.parents) : undefined;
        const parent = pf?.partners.find((q) => home.has(q));
        const sibling = !parent && pf ? pf.children.find((q) => q !== p.id && home.has(q)) : undefined;
        if (sibling) { home.set(p.id, home.get(sibling)!); pref.set(p.id, sibling); changed = true; continue; }
        if (parent) {
          const [prim] = pickPrimary(pf!);
          const host = prim && home.has(prim) ? prim : parent;
          // children arrive below the confluence, in the stream their parents made
          const base = owner.has(host) && owner.get(host)!.chain.includes(host) ? owner.get(host)! : home.get(host)!;
          home.set(p.id, base); pref.set(p.id, host); changed = true; continue;
        }
        for (const fid of p.fams) {
          const f = F.get(fid)!;
          const q = f.partners.find((x) => x !== p.id && home.has(x));
          if (!q) continue;
          if (p.parents && F.get(p.parents)!.partners.length) {
            // a partner who brings their own ancestry: a side stream joins here
            const t = grow(p.id, 'side', 0);
            const host = downstream(home.get(q)!, f.estY);
            t.into = host; t.joinFam = f.id;
            t.joinX = Math.max(f.estY, yearOf(p.id) + 15);
            host.tribs.push(t);
            for (const id of owner.keys()) if (!home.has(id)) home.set(id, owner.get(id)!);
          } else { home.set(p.id, home.get(q)!); pref.set(p.id, q); }
          changed = true; break;
        }
      }
    }
  };
  sweep();
  // what is left has no link to the river at all: cut-off water
  for (;;) {
    const rest = data.people.filter((p) => !home.has(p.id));
    if (!rest.length) break;
    const depth = (id: string, g = 0): number => { const f = P.get(id)!.parents ? F.get(P.get(id)!.parents!) : undefined; return f && g < 40 ? 1 + Math.max(0, ...f.partners.map((q) => depth(q, g + 1))) : 0; };
    rest.sort((a, b) => depth(b.id) - depth(a.id) || yearOf(b.id) - yearOf(a.id) || (a.id < b.id ? -1 : 1));
    const t = grow(rest[0].id, 'oxbow', 0);
    t.into = trunk;
    t.cut = true;
    trunk.tribs.push(t);
    for (const id of owner.keys()) if (!home.has(id)) home.set(id, owner.get(id)!);
    sweep();
  }

  // ---- years, members, spans ----
  let Y0 = Infinity;
  for (const p of data.people) Y0 = Math.min(Y0, yearOf(p.id));
  Y0 = Math.floor(Y0 / 10) * 10 - 20;
  const Y1 = thisYear;
  const N = Y1 - Y0 + 3;
  const count = new Map<Stream, Float32Array>(streams.map((s) => [s, new Float32Array(N)]));
  const X = (year: number) => (year <= WARP_YEAR ? (year - Y0) * PXY * WARP : (WARP_YEAR - Y0) * PXY * WARP + (year - WARP_YEAR) * PXY);

  const spotStream = new Map<string, Stream>();
  for (const p of data.people) {
    const base = home.get(p.id)!;
    const s = isAnc.has(p.id) && owner.get(p.id) === base ? base : downstream(base, yearOf(p.id));
    spotStream.set(p.id, s);
    s.members.push(p.id);
  }
  for (const s of streams) {
    const xs = s.members.map(yearOf);
    s.startX = Math.min(...xs) - 5;
    if (s.cut) s.joinX = Math.max(...s.members.map((id) => Math.min(endOf(id), yearOf(id) + 45))) + 4;
    if (s === trunk) s.joinX = Y1;
  }
  for (const p of data.people) {
    let s = spotStream.get(p.id)!;
    const b = yearOf(p.id), d = Math.min(endOf(p.id), Y1 + 1);
    for (let t = b; t <= d; t++) {
      while (s.into && !s.cut && t > s.joinX) s = s.into;
      count.get(s)![t - Y0] += 1;
    }
  }
  for (const s of streams) {
    const c = count.get(s)!;
    const hw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let sum = 0, w = 0;
      for (let k = -7; k <= 7; k++) { const j = i + k; if (j < 0 || j >= N) continue; const ww = 8 - Math.abs(k); sum += c[j] * ww; w += ww; }
      hw[i] = 2.4 + 2.5 * Math.sqrt(sum / w);
    }
    s.hw = hw;
  }
  const hwAt = (s: Stream, year: number) => {
    const i = Math.max(0, Math.min(N - 1, Math.round(year - Y0)));
    const lead = Math.max(0, Math.min(1, (year - s.startX) / 5));
    return s.hw[i] * (0.25 + 0.75 * lead);
  };

  // ---- place people across the width of their channel ----
  const offs = new Map<string, number>();
  const invX = (x: number) => { const w = (WARP_YEAR - Y0) * PXY * WARP; return x <= w ? Y0 + x / (PXY * WARP) : WARP_YEAR + (x - w) / PXY; };
  const hash = (id: string) => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; };
  for (const s of streams) {
    const placed: { x: number; o: number }[] = [];
    const order = [...s.members].sort((a, b) => Number(s.chain.includes(b)) - Number(s.chain.includes(a)) || yearOf(a) - yearOf(b) || (a < b ? -1 : 1));
    for (const id of order) {
      const x = X(yearOf(id));
      let o = 0;
      if (!s.chain.includes(id)) {
        const near = pref.get(id);
        const start = near && offs.has(near) && spotStream.get(near) === s ? offs.get(near)! : 0;
        const sign = hash(id) & 1 ? 1 : -1;
        let best = 0, bestCost = Infinity;
        for (let k = 0; k < 60; k++) {
          const cand = start + (k === 0 ? 0 : Math.ceil(k / 2) * DOT * (k % 2 ? sign : -sign));
          const clash = placed.some((q) => Math.abs(q.x - x) < DOT && Math.abs(q.o - cand) < DOT && Math.hypot(q.x - x, q.o - cand) < DOT);
          if (clash) continue;
          const over = Math.max(0, Math.abs(cand) + 4 - hwAt(s, yearOf(id)));
          const cost = over * 3 + Math.abs(cand - start) * 0.15 + Math.abs(cand) * 0.05;
          if (cost < bestCost) { bestCost = cost; best = cand; }
          if (over === 0) break;
        }
        o = best;
      }
      offs.set(id, o);
      placed.push({ x, o });
      // the water widens to hold whoever is in it
      const need = Math.abs(o) + 5.5;
      const yi = yearOf(id) - Y0;
      for (let k = -6; k <= 6; k++) {
        const j = yi + k;
        if (j < 0 || j >= N) continue;
        const want = need * (1 - Math.abs(k) / 9);
        if (s.hw[j] < want) s.hw[j] = want;
      }
    }
  }

  // ---- pack the channels so none cross ----
  interface Box { x0: number; x1: number; up: number; down: number }
  interface Rect { x0: number; x1: number; y0: number; y1: number }
  const maxHw = (s: Stream, a: number, b: number) => { let m = 0; for (let t = Math.max(a, s.startX); t <= Math.min(b, s.joinX); t++) m = Math.max(m, hwAt(s, t)); return m; };
  const pack = (s: Stream): Box => {
    const placed: Record<number, Rect[]> = { [-1]: [], 1: [] };
    const tribs = [...s.tribs].sort((a, b) => a.joinX - b.joinX || a.id - b.id);
    const own = maxHw(s, s.startX, s.joinX);
    let x0 = s.startX;
    let flip = s.id % 2 ? 1 : -1;
    for (const t of tribs) {
      const box = pack(t);
      x0 = Math.min(x0, box.x0);
      const pad = 5;
      let bestSide = 1, bestD = Infinity;
      for (const side of [flip, -flip]) {
        const inner = side === -1 ? box.down : box.up;
        const outer = side === -1 ? box.up : box.down;
        const base = maxHw(s, box.x0 - pad, box.x1 + 2) + GAP + inner + (t.cut ? 16 : 0);
        const cands = [base, ...placed[side].map((r) => r.y1 + GAP + inner)].filter((d) => d >= base).sort((a, b) => a - b);
        for (const d of cands) {
          const R: Rect = { x0: box.x0 - pad, x1: box.x1 + 1, y0: d - inner, y1: d + outer };
          const C: Rect = { x0: box.x1 - BEND_YEARS - 2, x1: box.x1 + 1, y0: 0, y1: d - inner };
          const hit = placed[side].some((r) => overlap(r, R) || (!t.cut && overlap(r, C)));
          if (!hit) { if (d < bestD - 0.01) { bestD = d; bestSide = side; } break; }
        }
      }
      const inner = bestSide === -1 ? box.down : box.up;
      const outer = bestSide === -1 ? box.up : box.down;
      placed[bestSide].push({ x0: box.x0 - pad, x1: box.x1 + 1, y0: bestD - inner, y1: bestD + outer });
      t.side = bestSide; t.off = bestD;
      flip = -bestSide;
    }
    const ext = (side: number) => Math.max(own, ...placed[side].map((r) => r.y1));
    return { x0, x1: s.joinX, up: ext(-1), down: ext(1) };
  };
  const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;
  const rootBox = pack(trunk);
  const setY = (s: Stream, y: number) => { s.y = y; for (const t of s.tribs) setY(t, y + t.side * t.off); };
  setY(trunk, 0);

  for (const s of streams) {
    if (!s.into || s.cut) { s.bend = 0; continue; }
    const last = Math.max(...s.members.filter((id) => s.chain.includes(id)).map(yearOf));
    const drop = Math.abs(s.y - s.into.y);
    s.bend = Math.max(4, Math.min(Math.max(8, Math.min(22, (drop * 0.55) / PXY)), s.joinX - s.startX - 2, Math.max(6, s.joinX - last + 6)));
  }
  const centre = (s: Stream, year: number): number => {
    if (!s.into || s.cut || year <= s.joinX - s.bend) return s.y;
    const target = centre(s.into, s.joinX);
    const t = Math.min(1, (year - (s.joinX - s.bend)) / s.bend);
    return s.y + (target - s.y) * smooth(t);
  };

  // ---- names, colours, certainty ----
  const nameStream = (s: Stream) => {
    const dead = s.chain.map((id) => P.get(id)!).filter((p) => !p.living);
    const tally = new Map<string, number>();
    for (const p of dead) if (p.surname) tally.set(p.surname, (tally.get(p.surname) ?? 0) + 1);
    const top = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
    const line = lineOfSurname(top) ?? dead.map((p) => lineOfSurname(p.surname)).find(Boolean);
    const youngest = dead[dead.length - 1];
    s.name = line ?? top ?? youngest?.given?.split(' ')[0] ?? youngest?.name ?? '';
    if (line && (s.chain.length > 1 || s.members.length > 3)) { s.line = line; s.minor = false; }
    else if (line) { s.line = line; s.minor = true; s.name = youngest?.given?.split(' ')[0] ?? s.name; } else { s.line = s.into ? s.into.line : 'Barlow'; s.minor = true; }
    const regs = new Map<string, number>();
    for (const id of s.members) { const r = P.get(id)!.region; if (r) regs.set(r, (regs.get(r) ?? 0) + (P.get(id)!.regionInferred ? 0.3 : 1)); }
    s.region = [...regs].sort((a, b) => b[1] - a[1])[0]?.[0];
    for (const t of s.tribs) nameStream(t);
  };
  nameStream(trunk);
  // only one stream carries each family name on the page: the longest
  for (const l of LINES) {
    const same = streams.filter((s) => !s.minor && s.line === l && s.kind !== 'oxbow');
    if (!same.length) {
      const hit = streams.filter((s) => s.kind !== 'oxbow' && s.members.some((id) => lineOfSurname(P.get(id)!.surname) === l)).sort((a, b) => b.members.length - a.members.length)[0];
      if (hit && hit.minor) { hit.line = l; hit.minor = false; hit.name = l; }
    }
  }
  for (const s of streams) if (s.kind === 'oxbow') { s.minor = true; s.line = 'Barlow'; }

  const breaks: Layout['breaks'] = [];
  for (const s of streams) {
    const segs: Segment[] = [];
    const first = P.get(s.chain[0])!;
    segs.push({ x0: s.startX, x1: yearOf(s.chain[0]), tier: first.living ? 'known' : first.sourced ?? 'none' });
    for (let i = 1; i < s.chain.length; i++) {
      const c = P.get(s.chain[i])!;
      const tier: Segment['tier'] = c.living ? 'known' : c.tier ?? 'none';
      segs.push({ x0: yearOf(s.chain[i - 1]), x1: yearOf(s.chain[i]), tier });
    }
    const lastP = P.get(s.chain[s.chain.length - 1])!;
    const tailTier: Segment['tier'] = lastP.living ? 'known' : s.chain.length > 1 ? segs[segs.length - 1].tier : segs[0].tier;
    segs.push({ x0: yearOf(s.chain[s.chain.length - 1]), x1: s.joinX, tier: tailTier === 'doubt' || tailTier === 'disputed' ? (lastP.sourced ?? 'none') : tailTier });
    s.segments = segs.filter((g) => g.x1 > g.x0);
  }
  let proofHead: string | undefined;
  for (let i = trunk.chain.length - 1; i >= 0; i--) {
    const p = P.get(trunk.chain[i])!;
    if (!p.living && (p.tier === 'doubt' || p.tier === 'disputed')) { breaks.push({ child: p.id, tier: p.tier }); if (!proofHead && !softBreaks.has(p.id)) proofHead = p.id; }
  }
  if (!proofHead) proofHead = trunk.chain[0];

  // ---- spots ----
  const spots = new Map<string, Spot>();
  let y0 = Infinity, y1 = -Infinity;
  for (const p of data.people) {
    const s = spotStream.get(p.id)!;
    const year = yearOf(p.id);
    const off = offs.get(p.id) ?? 0;
    const spot: Spot = { id: p.id, x: X(year), y: centre(s, year) + off, year, stream: s, anc: isAnc.has(p.id) && s.kind !== 'side' && s.kind !== 'oxbow', off };
    if (spot.anc) spot.gen = gen.get(p.id);
    spots.set(p.id, spot);
  }
  for (const s of streams) for (let t = s.startX; t <= s.joinX; t += 2) { const c = centre(s, t), h = hwAt(s, t); y0 = Math.min(y0, c - h); y1 = Math.max(y1, c + h); }
  void rootBox;

  const route = (id: string): [number, number][] => {
    const sp = spots.get(id);
    if (!sp) return [];
    const pts: [number, number][] = [[sp.x, sp.y]];
    let s = sp.stream;
    if (s.kind === 'oxbow') return pts;
    let t = sp.year;
    let off = sp.off;
    for (;;) {
      for (t = Math.floor(t) + 1; t <= s.joinX; t++) { off *= 0.9; pts.push([X(t), centre(s, t) + off]); }
      if (!s.into) break;
      t = s.joinX; s = s.into;
    }
    return pts;
  };

  return {
    Y0, Y1, streams, trunk, spots, mouthFamily,
    bounds: { x0: Math.min(X(Y0), X(trunk.startX) - 290), x1: X(Y1) + 150, y0: y0 - 34, y1: y1 + 30 },
    X, invX, centre, halfWidth: hwAt, route, proofHead, breaks,
  };
}

/** "5× great-grandfather" from a generation count (1 = parent). */
export function ancestorLabel(gen: number, sex?: string): string {
  const base = sex === 'M' ? 'father' : sex === 'F' ? 'mother' : 'parent';
  if (gen <= 0) return 'the youngest generation';
  if (gen === 1) return base;
  if (gen === 2) return 'grand' + base;
  if (gen === 3) return 'great-grand' + base;
  return `${gen - 2}× great-grand${base}`;
}

export type { Person, Family };
