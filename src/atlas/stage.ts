// One canvas, drawn as a globe, as the world laid flat, or as two shores.
// Owns its camera and its hit-testing. Knows nothing about the page.

import { geoDistance, geoGraticule10, geoRotation, geoMercator, geoOrthographic, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import type { LonLat } from '../model/geo.ts';
import type { Actor, Scene, World } from './scene.ts';

export type ViewKind = 'globe' | 'shores';
/** When the globe's camera leaves Europe for New Zealand. It goes once, and stays. */
export interface CameraPlan { turn: number; ride: [number, number] | null }
/** One outline of the world: coarse, with detail baked into the islands the family lives on (scripts/build-land.ts). */
export interface Lands { coarse: GeoPermissibleObjects }
export interface StageEvents {
  onPick: (person: string | null, site: string | null) => void;
  onHover: (person: string | null, site: string | null, x: number, y: number) => void;
  /** an off-screen country's pointer was tapped */
  onCountry: (name: string) => void;
  /** the user took the camera */
  onUser: () => void;
}
interface Panel { proj: GeoProjection; vis?: (ll: LonLat) => boolean; rect?: [number, number, number, number]; title?: string; small?: boolean; globe?: boolean }
interface Hit { x: number; y: number; id: string }
interface Goal { lon: number; lat: number; k: number }

const GB: [number, number, number, number] = [-8.6, 49.7, 2.4, 55.3];
const NZ: [number, number, number, number] = [166, -47.6, 179, -34];
const PL: [number, number, number, number] = [13.5, 48.8, 24.6, 55];
const US: [number, number, number, number] = [-81, 35.5, -66.5, 46];
/** a country to point at when it is out of view */
export interface Pointer { name: string; ll: LonLat; n: number; on?: boolean }
const inBox = (b: number[]) => (ll: LonLat) => ll[0] >= b[0] && ll[0] <= b[2] && ll[1] >= b[1] && ll[1] <= b[3];
const spiral = (slot: number, gap: number): [number, number] => { const r = gap * Math.sqrt(slot), t = slot * 2.39996; return [r * Math.cos(t), r * Math.sin(t)]; };
const sprites = new Map<string, HTMLCanvasElement>();
function glow(c: string, soft: boolean): HTMLCanvasElement {
  const key = c + soft; let s = sprites.get(key);
  if (!s) {
    s = document.createElement('canvas'); s.width = s.height = 64;
    const g = s.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, c + (soft ? '66' : 'cc')); gr.addColorStop(soft ? 0.6 : 0.25, c + (soft ? '33' : '44')); gr.addColorStop(1, c + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); sprites.set(key, s);
  }
  return s;
}

export class Stage {
  readonly ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  cam = { lon: 1, lat: 52.5, k: 6 };
  plan: CameraPlan = { turn: Infinity, ride: null };
  /** the camera follows the family until the user takes it */
  auto = true;
  goal: Goal | null = null;
  /** extra room to leave clear at the bottom (a phone's sheet) */
  inset = { bottom: 0 };
  private hits: Hit[] = [];
  private siteHits: Hit[] = [];
  private countryHits: { x0: number; y0: number; x1: number; y1: number; name: string }[] = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private moved = false;
  private pinch = 0;
  private back: HTMLCanvasElement | null = null;
  private backKey = '';
  private travelling = false;

  readonly canvas: HTMLCanvasElement;
  kind: ViewKind;
  private world: World;
  private lands: Lands;
  private colourOf: (a: Actor) => string;
  private ev: StageEvents;
  constructor(canvas: HTMLCanvasElement, kind: ViewKind, world: World, lands: Lands, colourOf: (a: Actor) => string, ev: StageEvents) {
    this.canvas = canvas; this.kind = kind; this.world = world; this.lands = lands; this.colourOf = colourOf; this.ev = ev;
    this.ctx = canvas.getContext('2d')!;
    this.bind();
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = this.canvas.clientWidth; this.H = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.round(this.W * this.dpr)); this.canvas.height = Math.max(1, Math.round(this.H * this.dpr));
  }
  setKind(kind: ViewKind) { this.kind = kind; this.goal = null; this.auto = true; }

  // ---------- camera ----------
  private get R() { return Math.min(this.W, this.H - this.inset.bottom) * 0.44; }
  private panels(): Panel[] {
    const { W, H, cam } = this;
    // two shores is a fixed picture: a phone's sheet slides over it instead of squeezing it
    const hb = this.kind === 'shores' ? H : H - this.inset.bottom;
    if (this.kind === 'globe') {
      const proj = geoOrthographic().rotate([-cam.lon, -cam.lat]).scale(this.R * cam.k).translate([W / 2, hb / 2]).clipAngle(90);
      return [{ proj, vis: (ll) => geoDistance(ll, [cam.lon, cam.lat]) < 1.5, globe: true }];
    }
    const tall = hb > W * 1.05, g = tall ? 0 : Math.min(150, W * 0.11), top = 66, pad = 12;
    const rects: [number, number, number, number][] = tall
      ? [[pad, top, W - pad, top + (hb - top - 30) * 0.5 - 12], [pad, top + (hb - top - 30) * 0.5 + 12, W - pad, hb - 30]]
      : [[pad, top, (W - g) / 2, hb - 56], [(W + g) / 2, top, W - pad, hb - 56]];
    const fit = (r: number[], box: number[]) => geoMercator().fitExtent([[r[0] + 10, r[1] + 10], [r[2] - 10, r[3] - 10]], { type: 'MultiPoint', coordinates: [[box[0], box[1]], [box[2], box[3]]] }).clipExtent([[r[0], r[1]], [r[2], r[3]]]);
    const r0 = rects[0];
    const pr: [number, number, number, number] = [r0[0] + 8, r0[1] + 8, r0[0] + 8 + Math.min(170, (r0[2] - r0[0]) * 0.3), r0[1] + 8 + Math.min(130, (r0[3] - r0[1]) * 0.27)];
    const r1 = rects[1];
    const ur: [number, number, number, number] = [r1[0] + 8, r1[1] + 8, r1[0] + 8 + (pr[2] - pr[0]) * 0.8, r1[1] + 8 + (pr[3] - pr[1]) * 0.8];
    return [
      { proj: fit(rects[0], GB), vis: inBox(GB), rect: rects[0], title: 'Britain and Ireland' },
      { proj: fit(rects[1], NZ), vis: inBox(NZ), rect: rects[1], title: 'New Zealand' },
      { proj: fit(pr, PL), vis: inBox(PL), rect: pr, title: 'Poland', small: true },
      { proj: fit(ur, US), vis: inBox(US), rect: ur, title: 'United States', small: true },
    ];
  }

  /**
   * Where the camera would like to be. It stays with the family in Europe until the
   * planned year, crosses to New Zealand once (riding with a ship if one sails then),
   * and stays. It never goes back by itself: a camera that swings between two
   * hemispheres whenever the balance of lights shifts is unwatchable.
   */
  private autoGoal(sc: Scene, follow: LonLat | null): Goal | null {
    if (this.kind !== 'globe') return null;
    if (follow) return { lon: follow[0], lat: follow[1], k: sc.ship ? 1.7 : 4 };
    const ride = this.plan.ride;
    if (ride && sc.ship && sc.year >= ride[0] && sc.year < ride[1]) return { lon: sc.ship[0], lat: sc.ship[1], k: 1.7 };
    const nz = sc.year >= this.plan.turn;
    const mine = sc.lights.filter((l) => !l.moving && l.ll[0] > -30 && (l.ll[0] > 100) === nz);
    if (!mine.length) return nz ? { lon: 174.6, lat: -40.4, k: 4.5 } : { lon: 0.4, lat: 52.4, k: 6 };
    return this.around(mine.map((l) => l.ll), mine.map((l) => l.alpha), 9);
  }
  /** Centre on these points, and stand back far enough to see nearly all of them. */
  private around(lls: LonLat[], weights: number[] | null, maxK: number): Goal {
    let x = 0, y = 0, z = 0;
    lls.forEach((ll, i) => { const a = (ll[0] * Math.PI) / 180, b = (ll[1] * Math.PI) / 180, w = weights ? weights[i] : 1; x += w * Math.cos(b) * Math.cos(a); y += w * Math.cos(b) * Math.sin(a); z += w * Math.sin(b); });
    const c: LonLat = [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
    // the ninth-tenths farthest, so one distant light does not throw the zoom about
    const ds = lls.map((ll) => geoDistance(c, ll) * 57.3).sort((p, q) => p - q);
    const spread = Math.max(1, weights ? ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.9))] : ds[ds.length - 1]);
    return { lon: c[0], lat: c[1], k: Math.max(1, Math.min(maxK, 34 / (spread + 2))) };
  }
  /** Bring these points into view and hold there. */
  frame(lls: LonLat[]) {
    if (!lls.length || this.kind === 'shores') return;
    this.auto = false;
    this.goal = this.around(lls, null, 9);
  }
  resume() { this.auto = true; this.goal = null; }
  zoomBy(f: number) {
    this.takeOver();
    if (this.kind === 'globe') this.cam.k = Math.max(0.9, Math.min(60, this.cam.k * f));
  }
  private takeOver() { if (this.auto || this.goal) { this.auto = false; this.goal = null; this.ev.onUser(); } }
  private ease(sc: Scene, follow: LonLat | null, snap: boolean) {
    const g = this.auto ? this.autoGoal(sc, follow) : this.goal;
    if (!g) return;
    const c = this.cam, r = snap ? 1 : 0.045;
    // Hold still until the goal has moved a little, then travel all the way: a camera
    // that creeps every frame costs a full redraw of the land every frame.
    let dl = g.lon - c.lon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
    if (!snap) {
      const off = (Math.max(Math.abs(dl), Math.abs(g.lat - c.lat)) * c.k) / 1.2 + Math.abs(g.k - c.k) / c.k / 0.08;
      if (this.travelling ? off < 0.1 : off < 1) { this.travelling = false; return; }
      this.travelling = true;
    }
    const far = Math.abs(dl) > 40 && !snap;
    c.lon += dl * r; if (c.lon > 180) c.lon -= 360; if (c.lon < -180) c.lon += 360;
    c.lat += (g.lat - c.lat) * r;
    // pull back while crossing the world, so the turn reads as a turn
    c.k += ((far ? Math.min(g.k, 1.5) : g.k) - c.k) * (snap ? 1 : 0.035);
  }

  // ---------- drawing ----------
  draw(sc: Scene, selected: string | null, opts: { follow?: LonLat | null; snap?: boolean; pointers?: Pointer[] } = {}) {
    this.ease(sc, opts.follow ?? null, Boolean(opts.snap));
    const c = this.ctx, { W, H, cam } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, W, H);
    this.hits = []; this.siteHits = []; this.countryHits = [];
    const ps = this.panels();
    if (this.kind === 'shores') { this.drawShores(ps, sc, selected); return; }
    const p = ps[0], zoom = this.cam.k;
    this.cached(['globe', cam.lon.toFixed(2), cam.lat.toFixed(2), cam.k.toFixed(3)].join(), () => this.base(p, this.lands.coarse));
    this.traces(p, sc);
    this.marks(p, sc, selected, Math.min(9, 3 + zoom * 0.7), 12);
    this.drawPointers(p, opts.pointers ?? []);
  }
  /**
   * The globe shows one side of the world. Any other country with lights lit is
   * named at the rim, in the direction it lies, so nobody is out of sight and out of mind.
   */
  private drawPointers(p: Panel, list: Pointer[]) {
    const c = this.ctx, { W } = this, hb = this.H - this.inset.bottom, cx = W / 2, cy = hb / 2;
    const rot = geoRotation([-this.cam.lon, -this.cam.lat]);
    const boxes: number[][] = [];
    c.font = '500 12px Inter, system-ui, sans-serif'; c.textBaseline = 'middle';
    for (const it of list) {
      if (!it.n && !it.on) continue;
      const q = p.vis!(it.ll) ? p.proj(it.ll) : null;
      if (q && q[0] > 30 && q[0] < W - 30 && q[1] > 30 && q[1] < hb - 30) continue;
      const [l, f] = rot(it.ll), a = (l * Math.PI) / 180, b = (f * Math.PI) / 180;
      let dx = Math.cos(b) * Math.sin(a), dy = -Math.sin(b); const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const text = `${it.name}  ${it.n}`, tw = c.measureText(text).width + 30, th = 26;
      // walk out from the middle until the chip touches the edge
      const mx = W / 2 - tw / 2 - 14, my = hb / 2 - th / 2 - 14, t = Math.min(Math.abs(dx) > 1e-6 ? mx / Math.abs(dx) : 1e9, Math.abs(dy) > 1e-6 ? my / Math.abs(dy) : 1e9);
      const x = cx + dx * t; let y = Math.min(hb - 110, Math.max(62, cy + dy * t));
      let box = [x - tw / 2, y - th / 2, x + tw / 2, y + th / 2];
      for (let i = 0; i < 8 && boxes.some((o) => box[0] < o[2] + 6 && box[2] > o[0] - 6 && box[1] < o[3] + 4 && box[3] > o[1] - 4); i++) { y += th + 6; box = [x - tw / 2, y - th / 2, x + tw / 2, y + th / 2]; }
      boxes.push(box);
      c.fillStyle = it.on ? '#F2B544' : 'rgba(23,39,63,.94)'; c.strokeStyle = it.on ? '#F2B544' : '#3A506F'; c.lineWidth = 1;
      c.beginPath(); c.roundRect(box[0], box[1], tw, th, 13); c.fill(); c.stroke();
      // a small arrowhead on the side it lies
      const ax = dx >= 0 ? box[2] - 13 : box[0] + 13, ang = Math.atan2(dy, dx);
      c.save(); c.translate(ax, y); c.rotate(ang); c.fillStyle = it.on ? '#1B1405' : '#F2B544'; c.beginPath(); c.moveTo(5, 0); c.lineTo(-4, -4); c.lineTo(-4, 4); c.closePath(); c.fill(); c.restore();
      c.fillStyle = it.on ? '#1B1405' : '#EAF0F7'; c.fillText(text, dx >= 0 ? box[0] + 10 : box[0] + 24, y + 0.5);
      this.countryHits.push({ x0: box[0], y0: box[1], x1: box[2], y1: box[3], name: it.name });
    }
  }
  /**
   * The land is by far the dearest thing to draw, and it only changes when the
   * camera does. Paint it once to a spare canvas and reuse it until the camera moves.
   */
  private cached(key: string, paint: () => void) {
    key += `|${this.canvas.width}x${this.canvas.height}|${this.inset.bottom}`;
    const back = (this.back ??= document.createElement('canvas'));
    if (key !== this.backKey) {
      back.width = this.canvas.width; back.height = this.canvas.height;
      const real = this.ctx, b = back.getContext('2d')!;
      b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      (this as { ctx: CanvasRenderingContext2D }).ctx = b;
      try { paint(); } finally { (this as { ctx: CanvasRenderingContext2D }).ctx = real; }
      this.backKey = key;
    }
    this.ctx.save(); this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.drawImage(back, 0, 0); this.ctx.restore();
  }
  private base(p: Panel, land: GeoPermissibleObjects) {
    const c = this.ctx, path = geoPath(p.proj, c);
    {
      const [cx, cy] = p.proj.translate(), R = p.proj.scale();
      const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R); g.addColorStop(0, '#16304f'); g.addColorStop(1, '#0b1a2e');
      c.shadowColor = '#3d6ea8'; c.shadowBlur = 26; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.shadowBlur = 0;
    }
    c.strokeStyle = 'rgba(120,150,190,.12)'; c.lineWidth = 0.6; c.beginPath(); path(geoGraticule10()); c.stroke();
    c.fillStyle = '#24395a'; c.strokeStyle = '#3a5580'; c.lineWidth = 0.7; c.beginPath(); path(land); c.fill(); c.stroke();
  }
  private stroke(style: string, colour: string, alpha: number) {
    const c = this.ctx;
    c.globalAlpha = alpha; c.strokeStyle = style === 'doubt' ? '#FF8A7A' : colour; c.lineWidth = style === 'sail' ? 2.2 : 1.3; c.lineCap = 'round';
    c.setLineDash(style === 'fade' ? [5, 5] : style === 'doubt' ? [1.5, 5] : style === 'ahead' ? [1, 6] : []);
    c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
  }
  private traces(p: Panel, sc: Scene, only?: (t: Scene['traces'][number]) => boolean) {
    const c = this.ctx, path = geoPath(p.proj, c);
    for (const t of sc.traces) {
      if (only && !only(t)) continue;
      const pts = t.upto !== undefined ? t.leg.pts.slice(0, Math.max(2, Math.ceil(t.upto * (t.leg.pts.length - 1)) + 1)) : t.leg.pts;
      c.beginPath(); path({ type: 'LineString', coordinates: pts });
      this.stroke(t.style, this.colourOf(t.actor), t.alpha);
    }
  }
  private marks(p: Panel, sc: Scene, selected: string | null, gap: number, labels: number) {
    const c = this.ctx;
    const at = (ll: LonLat, slot: number): [number, number] | null => {
      if (p.vis && !p.vis(ll)) return null;
      const q = p.proj(ll); if (!q) return null;
      if (slot > 0) { const o = spiral(slot, gap); q[0] += o[0]; q[1] += o[1]; }
      return q;
    };
    for (const e of sc.embers) {
      const q = at(e.ll, e.slot); if (!q) continue;
      if (e.bright) { c.globalAlpha = 0.5 * e.alpha; c.drawImage(glow(this.colourOf(e.actor), true), q[0] - 9, q[1] - 9, 18, 18); }
      c.globalAlpha = (e.bright ? 0.95 : 0.5) * e.alpha; c.fillStyle = this.colourOf(e.actor); c.beginPath(); c.arc(q[0], q[1], e.bright ? 1.8 : 1.3, 0, 7); c.fill();
    }
    c.globalCompositeOperation = 'lighter';
    for (const l of sc.lights) {
      const q = at(l.ll, l.slot); if (!q) continue;
      c.globalAlpha = l.alpha * (l.haze ? 0.35 : l.hollow ? 0.45 : 1);
      const r = l.haze ? 26 : l.moving ? 15 : 11; c.drawImage(glow(this.colourOf(l.actor), l.haze), q[0] - r, q[1] - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
    let selAt: [number, number] | null = null;
    for (const l of sc.lights) {
      const q = at(l.ll, l.slot); if (!q) continue;
      const col = this.colourOf(l.actor);
      c.globalAlpha = l.alpha;
      if (l.haze) { c.strokeStyle = col; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath(); c.arc(q[0], q[1], 6, 0, 7); c.stroke(); c.setLineDash([]); }
      else if (l.hollow) { c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(q[0], q[1], 2.6, 0, 7); c.stroke(); }
      else { c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], l.moving ? 3.8 : 2.8, 0, 7); c.fill(); c.fillStyle = '#fff'; c.globalAlpha = l.alpha * 0.7; c.beginPath(); c.arc(q[0], q[1], 1, 0, 7); c.fill(); }
      if (l.actor.id === selected && (!selAt || l.alpha >= 0.5)) selAt = q;
      this.hits.push({ x: q[0], y: q[1], id: l.actor.id });
    }
    for (const r of sc.ripples) {
      const q = at(r.ll, r.slot); if (!q) continue;
      const u = r.kind === 'birth' ? r.age : 1 - r.age;
      c.globalAlpha = (1 - r.age) * 0.8; c.strokeStyle = this.colourOf(r.actor); c.lineWidth = 1; c.beginPath(); c.arc(q[0], q[1], 3 + u * (r.kind === 'birth' ? 11 : 6), 0, 7); c.stroke();
    }
    c.globalAlpha = 1;
    // place names, the busiest first; every place with a light or an ember can be tapped
    const count = new Map<string, number>();
    for (const l of sc.lights) if (l.site) count.set(l.site, (count.get(l.site) ?? 0) + l.alpha);
    for (const e of sc.embers) if (!count.has(e.site)) count.set(e.site, 0.01);
    const boxes: number[][] = [];
    if (selAt) {
      // the selected person's name goes on first; place names give way to it
      const a = this.world.byId.get(selected!)!;
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(selAt[0], selAt[1], 7.5, 0, 7); c.stroke();
      c.font = '600 12.5px Inter, system-ui, sans-serif'; c.textBaseline = 'middle';
      const tw = c.measureText(a.p.name!).width, lx = Math.max(6, Math.min(selAt[0] + 12, this.W - tw - 10));
      c.fillStyle = 'rgba(10,20,34,.9)'; c.fillRect(lx - 4, selAt[1] - 24, tw + 8, 17); c.fillStyle = '#fff'; c.fillText(a.p.name!, lx, selAt[1] - 15);
      boxes.push([lx - 4, selAt[1] - 24, lx + tw + 4, selAt[1] - 7]);
    }
    c.font = '500 11px Inter, system-ui, sans-serif'; c.textBaseline = 'middle';
    let drawn = 0;
    for (const [sid, n] of [...count].sort((a, b) => b[1] - a[1])) {
      const pl = this.world.places.get(sid)!, q = at([pl.lon, pl.lat], 0); if (!q) continue;
      this.siteHits.push({ x: q[0], y: q[1], id: sid });
      if (drawn >= labels || n < 0.5) continue;
      const text = pl.name.split(',')[0].replace(' (then Alexandra)', ''), tw = c.measureText(text).width, off = 8 + gap * Math.sqrt(Math.min(n, 30));
      const box = [q[0] + off, q[1] - 7, q[0] + off + tw, q[1] + 7];
      if (p.rect && box[2] > p.rect[2] - 2) continue;
      if (boxes.some((b) => box[0] < b[2] + 4 && box[2] > b[0] - 4 && box[1] < b[3] && box[3] > b[1])) continue;
      boxes.push(box); drawn++;
      c.fillStyle = 'rgba(10,20,34,.72)'; c.fillRect(box[0] - 3, box[1], tw + 6, 14); c.fillStyle = '#C5D1E0'; c.fillText(text, box[0], q[1]);
      this.siteHits.push({ x: box[0] + tw / 2, y: q[1], id: sid });
    }
  }
  private drawShores(ps: Panel[], sc: Scene, selected: string | null) {
    const c = this.ctx, tall = this.H > this.W * 1.05;
    this.cached('shores', () => { const c = this.ctx; for (const p of ps) {
      const r = p.rect!; c.save(); c.beginPath(); c.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); c.clip();
      c.fillStyle = '#0e1d33'; c.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      const path = geoPath(p.proj, c); c.fillStyle = '#24395a'; c.strokeStyle = '#3a5580'; c.lineWidth = 0.8; c.beginPath(); path(this.lands.coarse); c.fill(); c.stroke(); c.restore();
      c.strokeStyle = '#2A3F5F'; c.lineWidth = 1; c.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2] - r[0], r[3] - r[1]);
      c.fillStyle = '#9FB0C6'; c.font = '500 11px "IBM Plex Mono", ui-monospace, Menlo, monospace'; c.textBaseline = 'alphabetic'; c.fillText(p.title!.toUpperCase(), r[0] + 8, p.small ? r[1] + 16 : r[1] - 7);
    } });
    const panelOf = (ll: LonLat) => ps.find((p) => p.vis!(ll));
    const pos = (ll: LonLat) => { const p = panelOf(ll); return p ? p.proj(ll) : null; };
    const crossing = (t: Scene['traces'][number]) => { const a = t.leg.pts[0], b = t.leg.pts[t.leg.pts.length - 1]; const pa = panelOf(a); return !(pa && pa === panelOf(b)); };
    // a move between panels arcs across the gap: the ocean is folded away
    for (const t of sc.traces) {
      if (!crossing(t)) continue;
      const p = pos(t.leg.pts[0]), q = pos(t.leg.pts[t.leg.pts.length - 1]); if (!p || !q) continue;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, cpx = mx + (tall ? 70 : 0), cpy = my + (tall ? 0 : -Math.min(120, Math.abs(q[0] - p[0]) * 0.18));
      c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(cpx, cpy, q[0], q[1]);
      this.stroke(t.style === 'sail' ? 'done' : t.style, this.colourOf(t.actor), t.alpha * (t.style === 'sail' ? 0.6 : 1));
      if (t.style === 'sail') {
        const u = t.upto!, x = (1 - u) * (1 - u) * p[0] + 2 * (1 - u) * u * cpx + u * u * q[0], y = (1 - u) * (1 - u) * p[1] + 2 * (1 - u) * u * cpy + u * u * q[1];
        c.drawImage(glow(this.colourOf(t.actor), false), x - 15, y - 15, 30, 30); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill();
        this.hits.push({ x, y, id: t.actor.id });
      }
    }
    const local: Scene = { ...sc, lights: sc.lights.filter((l) => !l.moving || !sc.traces.some((t) => t.actor === l.actor && t.style === 'sail' && crossing(t))) };
    for (const p of ps) { this.traces(p, sc, (t) => !crossing(t)); this.marks(p, local, selected, p.small ? 5 : 7, p.small ? 3 : 14); }
    if (!tall) { c.save(); c.translate(this.W / 2, this.H / 2); c.rotate(-Math.PI / 2); c.fillStyle = '#6E8099'; c.font = 'italic 13px Newsreader, Georgia, serif'; c.textAlign = 'center'; c.fillText('about 19,000 km of sea, folded away', 0, 4); c.restore(); }
  }

  // ---------- pointer ----------
  nearest(x: number, y: number, r = 16): { person: string | null; site: string | null } {
    let best = r, person: string | null = null;
    for (const h of this.hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < best) { best = d; person = h.id; } }
    if (person) return { person, site: null };
    let site: string | null = null; best = r + 6;
    for (const h of this.siteHits) { const d = Math.hypot(h.x - x, h.y - y); if (d < best) { best = d; site = h.id; } }
    return { person: null, site };
  }
  countryAt(x: number, y: number): string | null { return this.countryHits.find((h) => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1)?.name ?? null; }
  pointerScreen(name: string): [number, number] | null { const h = this.countryHits.find((x) => x.name === name); return h ? [(h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2] : null; }
  /** where a person's light was last drawn, for tests and keyboard focus */
  screenOf(id: string): [number, number] | null { const h = this.hits.find((x) => x.id === id); return h ? [h.x, h.y] : null; }
  siteScreen(id: string): [number, number] | null { const h = this.siteHits.find((x) => x.id === id); return h ? [h.x, h.y] : null; }

  private bind() {
    const cv = this.canvas;
    const local = (e: PointerEvent | WheelEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.moved = false; this.pinch = 0; try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
    cv.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) { const [x, y] = local(e); if (this.countryAt(x, y)) { cv.style.cursor = 'pointer'; this.ev.onHover(null, null, 0, 0); return; } const n = this.nearest(x, y); cv.style.cursor = n.person || n.site ? 'pointer' : this.kind === 'shores' ? 'default' : 'grab'; this.ev.onHover(n.person, n.site, e.clientX, e.clientY); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (this.pointers.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) this.zoomBy(d / this.pinch);
        this.pinch = d; this.moved = true; return;
      }
      if (!this.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      this.moved = true; p.x = e.clientX; p.y = e.clientY;
      if (this.kind === 'shores') return;
      this.takeOver(); cv.style.cursor = 'grabbing';
      const s = 57.3 / (this.R * this.cam.k); this.cam.lon -= dx * s; this.cam.lat = Math.max(-85, Math.min(85, this.cam.lat + dy * s));
    });
    const up = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      const single = this.pointers.size === 1;
      this.pointers.delete(e.pointerId); this.pinch = 0;
      if (single && !this.moved && e.type === 'pointerup') { const [x, y] = local(e); const ch = this.countryAt(x, y); if (ch) { this.ev.onCountry(ch); return; } const n = this.nearest(x, y, e.pointerType === 'touch' ? 24 : 16); this.ev.onPick(n.person, n.site); }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => this.ev.onHover(null, null, 0, 0));
    cv.addEventListener('wheel', (e) => { if (this.kind === 'shores') return; e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }
}
