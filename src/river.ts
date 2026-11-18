// Draws the river in SVG and owns the camera.

import type { Person, RiverData, Tier } from './model/types.ts';
import { type Layout, type LineName, type Stream } from './model/layout.ts';
import { HEADWATERS } from './casefile.ts';

export type Lens = 'surname' | 'place' | 'certainty';

export const LINE_COLOUR: Record<LineName, string> = {
  Barlow: '#F2B544', Finch: '#6FD3C3', Carter: '#F08C6E', Watkins: '#C3A6F5',
  Chmielewski: '#7DBBFF', Czeladka: '#F29BC4', Klos: '#B5DE7A',
};
export const REGION_COLOUR: Record<string, string> = {
  Norfolk: '#F2B544', Suffolk: '#E9DC83', Kent: '#F08C6E', Cornwall: '#6FD3C3', Staffordshire: '#C3A6F5',
  London: '#F29BC4', 'Elsewhere in England': '#C9B28F', 'New Zealand': '#B5DE7A', Poland: '#7DBBFF', Elsewhere: '#A9B7CB',
};
export const TIER_COLOUR: Record<Tier | 'known', string> = {
  record: '#7BE0B5', compiled: '#8FB6E8', none: '#8492A8', doubt: '#F2C14E', disputed: '#FF8A7A', ruledout: '#FF6B6B', known: '#C5D1E0',
};
export const TIER_LABEL: Record<Tier | 'known', string> = {
  record: 'A record is cited', compiled: 'Compiled tree only', none: 'No source cited', doubt: 'In doubt', disputed: 'Disputed', ruledout: 'Ruled out', known: 'Living memory',
};
const UNKNOWN = '#5B6B83';
const LIVING = '#DCE6F2';
const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
}
const f1 = (n: number) => Math.round(n * 10) / 10;

interface Ribbon { stream: Stream; years: number[]; top: [number, number][]; bot: [number, number][]; mid: [number, number][] }
interface DotRef { p: Person; g: SVGGElement; dot: SVGElement; state: string; b: number; d: number; x: number; y: number; anc: boolean; label?: SVGTextElement }

export interface RiverEvents {
  onSelect: (id: string | null) => void;
  onYear: (year: number, final: boolean) => void;
  onHover: (id: string | null, x: number, y: number) => void;
  onStream: (s: Stream, frame?: boolean) => void;
  onHeadwater: () => void;
  onOxbow: (s: Stream) => void;
  onConfluence: (famId: string) => void;
  /** keyboard: step to the next or previous person */
  onStep: (dir: number) => void;
}

export class River {
  readonly svg: SVGSVGElement;
  private world: SVGGElement;
  private gridG: SVGGElement;
  private cursorG: SVGGElement;
  private clipRect: SVGRectElement;
  private dots = new Map<string, DotRef>();
  private segEls: { el: SVGPathElement; stream: Stream; tier: Tier | 'known'; region?: string; a?: string; b?: string }[] = [];
  private labelEls: { el: SVGGElement; year: number }[] = [];
  private confs: { x: number; y: number; fam: string; year: number }[] = [];
  private ribbons = new Map<Stream, Ribbon>();
  private routeEl: SVGPathElement;
  private pulseEl: SVGPathElement;
  private selRing: SVGGElement;
  private nameG!: SVGGElement;
  private lit: Set<string> | null = null;
  private selected: string | null = null;
  private labelTimer = 0;
  private streamLabels: { el: SVGGElement; x: number; y: number; w: number; minor: boolean; kind?: 'flag' | 'ox' }[] = [];
  private P: Map<string, Person>;
  k = 1; tx = 0; ty = 0;
  private fitK = 1;
  year: number;
  lens: Lens = 'surname';
  private w = 800; private h = 600;
  private anim = 0;
  /** screen px kept clear on the right and bottom (for panels) */
  inset = { right: 0, bottom: 0 };
  /** on narrow screens the camera shows a window of years and travels with the scrubber */
  follow = false;
  /** while playing on a wide screen the camera starts close and pulls back as the river grows */
  private autoCam = false;
  private extent: { year: number; y0: number; y1: number }[] = [];
  /** earliest year the scrubber may reach */
  minYear = 1500;
  /** screen px to keep clear at the bottom of the fit view (the legend) */
  padBottom = 104;

  private data: RiverData;
  readonly L: Layout;
  private ev: RiverEvents;

  constructor(svg: SVGSVGElement, data: RiverData, L: Layout, ev: RiverEvents) {
    this.svg = svg;
    this.data = data; this.L = L; this.ev = ev;
    this.P = new Map(data.people.map((p) => [p.id, p]));
    this.year = data.meta.thisYear;
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <pattern id="gap-doubt" patternUnits="userSpaceOnUse" width="11" height="8"><rect x="7" width="4" height="8" fill="var(--bg)"/></pattern>
      <pattern id="gap-soft" patternUnits="userSpaceOnUse" width="9" height="8"><rect x="7.4" width="1.6" height="8" fill="var(--bg)"/></pattern>
      <pattern id="gap-disputed" patternUnits="userSpaceOnUse" width="6" height="8"><rect x="1.8" width="4.2" height="8" fill="var(--bg)"/></pattern>
      <linearGradient id="delta-fade" x1="0" x2="1"><stop offset="0" stop-color="#F2B544" stop-opacity=".85"/><stop offset="1" stop-color="#F2B544" stop-opacity="0"/></linearGradient>
      <linearGradient id="head-fade" x1="1" x2="0"><stop offset="0" stop-color="#F2B544" stop-opacity=".7"/><stop offset="1" stop-color="#F2B544" stop-opacity="0"/></linearGradient>
      <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    const clip = el('clipPath', { id: 'reveal' }, defs);
    this.clipRect = el('rect', { x: -4000, y: -6000, width: 4000, height: 12000 }, clip);

    this.gridG = el('g', { class: 'grid' }, svg);
    this.world = el('g', { class: 'world' }, svg);
    this.cursorG = el('g', { class: 'cursor' });
    this.routeEl = el('path', { class: 'route', fill: 'none' });
    this.pulseEl = el('path', { class: 'pulse', fill: 'none', pathLength: 1 });
    this.selRing = el('g', { class: 'selring' });

    this.buildRibbons();
    this.draw();
    this.bind();
    new ResizeObserver(() => this.resize()).observe(svg);
    this.resize(true);
  }

  // ---------- geometry ----------
  private buildRibbons() {
    const L = this.L;
    for (const s of L.streams) {
      const years: number[] = [];
      const end = s.joinX;
      for (let t = s.startX; t < end; t += 0.5) years.push(t);
      years.push(end);
      const mid = years.map((t) => [L.X(t), L.centre(s, t)] as [number, number]);
      const top: [number, number][] = [], bot: [number, number][] = [];
      for (let i = 0; i < years.length; i++) {
        const a = mid[Math.max(0, i - 1)], b = mid[Math.min(years.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        let hw = L.halfWidth(s, years[i]);
        if (s.cut) { const u = (years[i] - s.startX) / (end - s.startX); hw *= Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 2.4 + 0.12); }
        top.push([mid[i][0] + dy * hw, mid[i][1] - dx * hw]);
        bot.push([mid[i][0] - dy * hw, mid[i][1] + dx * hw]);
      }
      this.ribbons.set(s, { stream: s, years, top, bot, mid });
    }
  }
  private slice(r: Ribbon, y0: number, y1: number): string {
    const i0 = Math.max(0, r.years.findIndex((t) => t >= y0));
    let i1 = r.years.findIndex((t) => t >= y1);
    if (i1 < 0) i1 = r.years.length - 1;
    if (i1 <= i0) return '';
    let d = '';
    for (let i = i0; i <= i1; i++) d += (i === i0 ? 'M' : 'L') + f1(r.top[i][0]) + ' ' + f1(r.top[i][1]);
    for (let i = i1; i >= i0; i--) d += 'L' + f1(r.bot[i][0]) + ' ' + f1(r.bot[i][1]);
    return d + 'Z';
  }
  private line(pts: [number, number][]): string {
    let d = '';
    for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
    return d;
  }

  // ---------- drawing ----------
  private draw() {
    const L = this.L, W = this.world;
    const thisYear = this.data.meta.thisYear;
    const order = [...L.streams].sort((a, b) => Number(a === L.trunk) - Number(b === L.trunk) || b.id - a.id);

    // headwaters: the three guesses about where the water rises
    const head = el('g', { class: 'headwaters' }, W);
    const hx = L.X(L.trunk.startX), hy = L.trunk.y;
    HEADWATERS.forEach((h, i) => {
      const dy = (i - 1) * 46, x2 = hx - 150;
      el('path', { d: `M${hx} ${hy} C${hx - 60} ${hy} ${hx - 80} ${hy + dy} ${x2} ${hy + dy}`, class: 'headwater' }, head);
      const lab = el('g', { class: 'lab', transform: `translate(${x2 - 6} ${hy + dy})` }, head);
      const t = el('text', { class: 'hw-label', 'text-anchor': 'end', dy: '0.32em' }, el('g', { class: 'ls' }, lab));
      t.textContent = h.name;
      const title = el('title', {}, t); title.textContent = h.note;
    });
    head.addEventListener('click', () => this.ev.onHeadwater());

    const ghost = el('g', { class: 'ghost' }, W);
    const live = el('g', { class: 'live', 'clip-path': 'url(#reveal)' }, W);

    for (const s of order) {
      const r = this.ribbons.get(s)!;
      const whole = this.slice(r, s.startX, s.joinX);
      el('path', { d: whole, class: 'ghost-ribbon' + (s.cut || s.kind === 'oxbow' ? ' oxbow' : '') }, ghost);
      const g = el('g', { class: `stream ${s.kind}${s.minor ? ' minor' : ''}`, 'data-stream': s.id }, live);
      for (const seg of s.segments) {
        const d = this.slice(r, seg.x0, seg.x1);
        if (!d) continue;
        const chainP = s.chain.map((id) => this.P.get(id)!).filter((p) => !p.living && p.region);
        const region = [...chainP].reverse().find((p) => p.b!.y <= seg.x1 + 1)?.region ?? chainP[0]?.region ?? s.region;
        const path = el('path', { d, class: 'seg' }, g);
        this.segEls.push({ el: path, stream: s, tier: seg.tier, region, a: seg.a, b: seg.b });
        if (seg.tier === 'doubt' || seg.tier === 'disputed') el('path', { d, class: 'gap', fill: `url(#gap-${seg.soft ? 'soft' : seg.tier})` }, g);
      }
      if (!s.minor && s.kind !== 'oxbow') el('path', { d: this.line(r.mid), class: 'current' }, g);
      g.addEventListener('click', (e) => { e.stopPropagation(); if (s.kind === 'oxbow') this.ev.onOxbow(s); else this.ev.onStream(s); });
    }

    // the mouth: where the living are
    const mx = L.X(thisYear), my = L.trunk.y, mh = L.halfWidth(L.trunk, thisYear);
    const delta = el('g', { class: 'delta' }, W);
    for (let i = -3; i <= 3; i++) {
      const y1 = my + (i / 3) * mh * 0.8, y2 = my + i * (mh * 0.55 + 6);
      el('path', { d: `M${mx - 1} ${y1} C${mx + 22} ${y1} ${mx + 26} ${y2} ${mx + 54} ${y2}`, class: 'delta-arm', 'stroke-width': f1(Math.max(1.6, (mh * 2) / 7)) }, delta);
    }
    const dl = el('g', { transform: `translate(${mx + 8} ${my + mh * 2.2 + 26})` }, delta);
    const dt = el('text', { class: 'delta-label' }, el('g', { class: 'ls' }, dl));
    dt.innerHTML = `<tspan x="0">Today. ${this.data.meta.counts.living} living,</tspan><tspan x="0" dy="1.25em">kept private.</tspan>`;

    // cut-off water: labels and the severed link are added by the app (it knows the case)
    this.world.appendChild(this.routeEl);

    // confluences
    const conf = el('g', { class: 'confluences' }, W);
    for (const s of L.streams) {
      if (!s.into || s.cut || !s.joinFam) continue;
      const cy = s.joinX - Math.max(1.5, s.bend * 0.45);
      const g = el('g', { class: 'conf', transform: `translate(${f1(L.X(cy))} ${f1(L.centre(s, cy))})`, 'data-year': s.joinX }, conf);
      const inner = el('g', { class: 'pi' }, g);
      el('circle', { r: 9, class: 'hit' }, inner);
      el('circle', { r: 2.6, class: 'conf-dot' }, inner);
      g.addEventListener('click', (e) => { e.stopPropagation(); this.ev.onConfluence(s.joinFam!); });
      this.confs.push({ x: L.X(cy), y: L.centre(s, cy), fam: s.joinFam, year: s.joinX });
      this.labelEls.push({ el: g, year: s.joinX });
    }

    // people
    const dotsG = el('g', { class: 'people' }, W);
    const sorted = [...this.data.people].sort((a, b) => Number(b.living) - Number(a.living) || Number(L.spots.get(a.id)!.anc) - Number(L.spots.get(b.id)!.anc));
    for (const p of sorted) {
      const sp = L.spots.get(p.id)!;
      const g = el('g', { class: 'p' + (sp.anc ? ' anc' : '') + (p.living ? ' living' : '') + (!p.living && p.b?.est ? ' est' : ''), transform: `translate(${f1(sp.x)} ${f1(sp.y)})`, 'data-id': p.id }, dotsG);
      const inner = el('g', { class: 'pi' }, g);
      el('circle', { r: 8, class: 'hit' }, inner);
      const dot = p.living
        ? el('path', { d: 'M0 -3.1L3.1 0L0 3.1L-3.1 0Z', class: 'dot' }, inner)
        : el('circle', { r: sp.anc ? 4 : 3, class: 'dot' }, inner);
      if (!p.living) {
      }
      this.dots.set(p.id, { p, g, dot, state: '', b: sp.year, d: p.living ? Infinity : Math.max(p.d!.y, sp.year), x: sp.x, y: sp.y, anc: sp.anc });
    }
    W.appendChild(this.pulseEl);
    W.appendChild(this.selRing);
    this.selRing.innerHTML = '<g class="pi"><circle r="8" class="sel-a"/><circle r="12" class="sel-b"/></g>';
    this.selRing.style.display = 'none';
    this.nameG = el('g', { class: 'names' }, this.svg);
    this.svg.appendChild(this.cursorG);

    // labels
    const labels = el('g', { class: 'labels' }, W);
    for (const s of L.streams) {
      if (s.kind === 'oxbow' || !s.name) continue;
      const r = this.ribbons.get(s)!;
      const at = Math.min(s.startX + 6, s.joinX - 2);
      const hw = L.halfWidth(s, at + 6);
      const g = el('g', { class: 'slabel' + (s.minor ? ' minor' : ''), transform: `translate(${f1(L.X(s.startX) + 2)} ${f1(L.centre(s, at) - hw - 5)})` }, labels);
      const inner = el('g', { class: 'ls' }, g);
      const t = el('text', { fill: LINE_COLOUR[s.line] }, inner);
      t.textContent = s.name;
      if (!s.minor && s.region) { const sub = el('text', { class: 'sub', dy: '-1.5em' }, inner); sub.textContent = s.region.replace('Elsewhere in ', ''); t.setAttribute('dy', '0'); }
      g.addEventListener('click', (e) => { e.stopPropagation(); this.ev.onStream(s, true); });
      this.labelEls.push({ el: g, year: s.startX });
      this.streamLabels.push({ el: g, x: L.X(s.startX) + 2, y: L.centre(s, at) - hw - 5, w: s.name.length * (s.minor ? 6.2 : 9.5), minor: s.minor });
      void r;
    }
    this.recolour();
  }

  /** Mark a cut-off stream with what cut it, and draw the severed link to the person it was once tied to. */
  markOxbow(s: Stream, label: string, towards?: string) {
    const L = this.L;
    const g = el('g', { class: 'oxbow-mark' });
    this.world.insertBefore(g, this.world.querySelector('.people'));
    const midYear = (s.startX + s.joinX) / 2;
    const cx = L.X(midYear), cy = s.y;
    const sp = towards ? L.spots.get(towards) : undefined;
    const hw = L.halfWidth(s, midYear);
    if (sp) {
      const from = L.spots.get(s.chain[s.chain.length - 1])!;
      const x1 = from.x, y1 = from.y, x2 = sp.x, y2 = sp.y;
      el('path', { d: `M${f1(x1)} ${f1(y1)} Q${f1((x1 + x2) / 2 + 14)} ${f1((y1 + y2) / 2)} ${f1(x2)} ${f1(y2)}`, class: 'severed' }, g);
      const mx = (x1 + x2) / 2 + 7, my = (y1 + y2) / 2;
      const x = el('g', { transform: `translate(${f1(mx)} ${f1(my)})` }, g);
      el('path', { d: 'M-4 -4L4 4M-4 4L4 -4', class: 'severed-x' }, el('g', { class: 'pi' }, x));
    }
    const above = !sp || sp.y > cy;
    const lg = el('g', { class: 'slabel oxlabel', transform: `translate(${f1(cx)} ${f1(cy + (above ? -hw - 8 : hw + 16))})` }, g);
    const t = el('text', { 'text-anchor': 'middle' }, el('g', { class: 'ls' }, lg));
    t.textContent = label;
    g.addEventListener('click', (e) => { e.stopPropagation(); this.ev.onOxbow(s); });
    this.labelEls.push({ el: lg, year: s.startX });
    this.streamLabels.push({ el: lg, x: cx, y: cy + (above ? -hw - 8 : hw + 16), w: label.length * 6.4, minor: true, kind: 'ox' });
  }

  /** A flag on the trunk where unbroken evidence ends. */
  markProofHead(id: string, text: string) {
    const sp = this.L.spots.get(id);
    if (!sp) return;
    const g = el('g', { class: 'proofhead', transform: `translate(${f1(sp.x)} ${f1(sp.y)})` });
    this.world.insertBefore(g, this.world.querySelector('.people'));
    const inner = el('g', { class: 'ls' }, g);
    el('path', { d: 'M0 -8V-44', class: 'flagpole' }, inner);
    const t = el('text', { class: 'flagtext', x: 5, y: -36 }, inner);
    const [a, b] = text.split('\n');
    t.innerHTML = `<tspan x="5">${a}</tspan>` + (b ? `<tspan x="5" dy="1.2em" class="b">${b}</tspan>` : '');
    this.labelEls.push({ el: g, year: sp.year });
    this.streamLabels.push({ el: g, x: sp.x, y: sp.y, w: Math.max(a.length, (b ?? '').length) * 6.2 + 8, minor: false, kind: 'flag' });
  }

  colourOf(p: Person): string {
    if (p.living) return LIVING;
    if (this.lens === 'place') return p.region ? REGION_COLOUR[p.region] ?? UNKNOWN : UNKNOWN;
    if (this.lens === 'certainty') return TIER_COLOUR[p.tier ?? p.sourced ?? 'none'];
    return LINE_COLOUR[this.L.spots.get(p.id)!.stream.line];
  }
  private recolour() {
    for (const s of this.segEls) {
      let c: string;
      if (this.lens === 'place') c = s.region ? REGION_COLOUR[s.region] ?? UNKNOWN : UNKNOWN;
      else if (this.lens === 'certainty') c = TIER_COLOUR[s.tier];
      else c = LINE_COLOUR[s.stream.line];
      s.el.setAttribute('fill', s.stream.kind === 'oxbow' ? '#3A4A63' : c);
    }
    for (const d of this.dots.values()) {
      const c = this.colourOf(d.p);
      d.g.style.setProperty('--c', c);
      d.g.classList.toggle('hollow', this.lens === 'place' && !d.p.living && (Boolean(d.p.regionInferred) || !d.p.region));
    }
  }
  setLens(lens: Lens) { this.lens = lens; this.svg.dataset.lens = lens; this.recolour(); }

  // ---------- time ----------
  setYear(year: number, ripple = false) {
    const prev = this.year;
    this.year = year;
    const X = this.L.X(Math.min(year, this.data.meta.thisYear) + 0.5);
    this.clipRect.setAttribute('width', String(4000 + X + (year >= this.data.meta.thisYear ? 400 : 0)));
    for (const d of this.dots.values()) {
      const state = year < d.b ? 'unborn' : year > d.d ? 'dead' : 'alive';
      if (state !== d.state) {
        if (d.state) d.g.classList.remove(d.state);
        d.g.classList.add(state);
        if (ripple && state === 'alive' && d.state === 'unborn' && year - prev < 4) this.ripple(d);
        d.state = state;
      }
    }
    for (const l of this.labelEls) l.el.classList.toggle('future', l.year > year);
    if (this.autoCam) {
      const t = this.autoTarget(), a = ripple ? 0.085 : Math.abs(year - prev) > 3 ? 1 : 0.4;
      this.k += (t.k - this.k) * a; this.tx += (t.tx - this.tx) * a; this.ty += (t.ty - this.ty) * a;
      if (year >= this.data.meta.thisYear) { this.autoCam = false; this.fit(); } else this.apply();
    }
    if (this.follow && this.narrow) {
      const tx = this.followTx(this.k);
      if (Math.abs(tx - this.tx) > 0.5) { this.tx = Math.abs(year - prev) > 30 ? tx : this.tx + (tx - this.tx) * 0.35; this.apply(); }
    }
    this.svg.classList.toggle('at-present', year >= this.data.meta.thisYear);
    // wherever the camera is, a change of year keeps the year line in view
    if (!this.autoCam && !(this.follow && this.narrow) && year !== prev && !this.svg.classList.contains('scrubbing')) {
      const w = this.w - this.inset.right, sx = this.L.X(year) * this.k + this.tx;
      if (sx < 24 || sx > w - 24) {
        const want = (sx < 24 ? w * 0.3 : w * 0.7) - this.L.X(year) * this.k;
        this.tx = Math.abs(year - prev) > 3 ? want : this.tx + (want - this.tx) * 0.5;
        this.clampPan();
        this.apply();
      }
    }
    this.placeCursor();
  }
  private ripple(d: DotRef) {
    const c = el('circle', { r: 3, class: 'ripple' }, d.g.firstElementChild!);
    c.addEventListener('animationend', () => c.remove());
  }
  aliveCount(year: number): number { let n = 0; for (const d of this.dots.values()) if (year >= d.b && year <= d.d) n++; return n; }

  // ---------- focus ----------
  setFocus(ids: Iterable<string> | null) {
    const set = ids ? new Set(ids) : null;
    this.lit = set;
    this.world.classList.toggle('focus', Boolean(set));
    for (const [id, d] of this.dots) d.g.classList.toggle('lit', Boolean(set?.has(id)));
    // the water between two lit people on the same stream is lit too
    for (const s of this.segEls) s.el.classList.toggle('lit', Boolean(set && s.a && s.b && set.has(s.a) && set.has(s.b)));
    this.queueLabels();
  }
  setSelected(id: string | null) {
    for (const d of this.dots.values()) d.g.classList.remove('sel');
    const sp = id ? this.L.spots.get(id) : undefined;
    this.selected = id;
    this.queueLabels();
    if (!sp || !id) { this.selRing.style.display = 'none'; this.routeEl.setAttribute('d', ''); return; }
    this.dots.get(id)!.g.classList.add('sel');
    this.selRing.style.display = '';
    this.selRing.setAttribute('transform', `translate(${f1(sp.x)} ${f1(sp.y)})`);
    const pts = this.L.route(id);
    this.routeEl.setAttribute('d', pts.length > 1 ? this.line(pts) : '');
  }
  /** Send a pulse of light downstream from a person to the mouth. */
  followWater(id: string) {
    const pts = this.L.route(id);
    if (pts.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.pulseEl.setAttribute('d', this.line(pts));
    const len = pts[pts.length - 1][0] - pts[0][0];
    const dur = Math.max(1400, Math.min(5200, len * 3.2));
    this.pulseEl.style.display = 'block';
    const a = this.pulseEl.animate(
      [{ strokeDasharray: '0.07 1', strokeDashoffset: '0.07', opacity: 1 }, { strokeDasharray: '0.07 1', strokeDashoffset: '-1', opacity: 1 }],
      { duration: dur, easing: 'cubic-bezier(.4,.1,.6,1)' });
    a.onfinish = () => { this.pulseEl.style.display = 'none'; };
  }

  // ---------- camera ----------
  private resize(first = false) {
    const r = this.svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const wasFit = first || Math.abs(this.k - this.fitK) < 0.001;
    this.w = r.width; this.h = r.height;
    this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    if (wasFit) this.fit(false); else this.apply();
  }
  startAutoCamera() {
    if (this.narrow || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!this.isFit && !this.autoCam) return; // the viewer has moved the camera: leave it alone
    if (!this.extent.length) {
      const pts = [...this.L.spots.values()].sort((a, b) => a.year - b.year);
      let y0 = this.L.trunk.y - 70, y1 = this.L.trunk.y + 70;
      for (const p of pts) { y0 = Math.min(y0, p.y - 26); y1 = Math.max(y1, p.y + 26); this.extent.push({ year: p.year, y0, y1 }); }
    }
    this.autoCam = true;
  }
  private autoTarget() {
    const b = this.L.bounds, year = this.year;
    let e = this.extent[0];
    for (const x of this.extent) { if (x.year > year + 12) break; e = x; }
    const fit = this.fitView();
    const w = this.w - this.inset.right, h = this.h;
    const padT = 78, padB = this.padBottom, padX = 24;
    const x0 = b.x0, x1 = Math.min(b.x1, this.L.X(year) + 190);
    const k = Math.max(fit.k, Math.min(1.75, (w - padX * 2) / (x1 - x0), (h - padT - padB) / (e.y1 - e.y0)));
    if (k <= fit.k * 1.02) return fit;
    return { k, tx: padX - x0 * k, ty: padT + (h - padT - padB) / 2 - ((e.y0 + e.y1) / 2) * k };
  }
  private get narrow() { return this.w < 700 || this.h < 330; }
  /** Let the camera travel with the year again (narrow screens). */
  resumeFollow() { if (this.narrow) { this.follow = true; this.tx = this.followTx(this.k); this.clampPan(); this.apply(); } }
  private clampPan() {
    const b = this.L.bounds, m = 90;
    this.tx = Math.max(m - b.x1 * this.k, Math.min(this.w - m - b.x0 * this.k, this.tx));
    this.ty = Math.max(m - b.y1 * this.k, Math.min(this.h - m - b.y0 * this.k, this.ty));
  }
  private followTx(k: number) {
    const b = this.L.bounds, w = this.w;
    const want = w * 0.72 - this.L.X(this.year) * k;
    return Math.max(w - 12 - b.x1 * k, Math.min(12 - b.x0 * k, want));
  }
  private fitView() {
    const b = this.L.bounds;
    const w = this.w - this.inset.right, h = this.h - this.inset.bottom;
    if (this.narrow) {
      const padT = 30, padB = Math.max(40, this.padBottom - 24);
      const fitH = (this.h - padT - padB) / (b.y1 - b.y0);
      const k = Math.max(0.3, Math.min(0.62, fitH));
      // when the stage is too short for the whole river, keep the trunk in the middle
      const ty = fitH >= 0.3 ? padT + (this.h - padT - padB - (b.y1 - b.y0) * k) / 2 - b.y0 * k : this.h / 2 - this.L.trunk.y * k;
      return { k, tx: this.followTx(k), ty };
    }
    const padX = Math.min(20, w * 0.03), padT = 22, padB = this.padBottom;
    const k = Math.min((w - padX * 2) / (b.x1 - b.x0), (h - padT - padB) / (b.y1 - b.y0));
    return { k, tx: (w - (b.x1 - b.x0) * k) / 2 - b.x0 * k, ty: padT + (h - padT - padB - (b.y1 - b.y0) * k) / 2 - b.y0 * k };
  }
  fit(animate = true) {
    const v = this.fitView();
    this.fitK = v.k;
    this.follow = this.narrow;
    if (animate) this.flyTo(v.k, v.tx, v.ty); else { this.k = v.k; this.tx = v.tx; this.ty = v.ty; this.apply(); }
  }
  get isFit() { return Math.abs(this.k - this.fitK) < 0.002 || this.autoCam; }
  zoomBy(f: number, cx = (this.w - this.inset.right) / 2, cy = (this.h - this.inset.bottom) / 2) {
    const k = Math.max(this.fitK * 0.7, Math.min(9, this.k * f));
    const r = k / this.k;
    this.flyTo(k, cx - (cx - this.tx) * r, cy - (cy - this.ty) * r, 180);
  }
  /** Bring a set of world points into view. */
  frame(points: { x: number; y: number }[], maxK = 2.4) {
    if (!points.length) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const w = this.w - this.inset.right, h = this.h - this.inset.bottom;
    const pad = Math.min(110, w * 0.18);
    const k = Math.max(this.fitK, Math.min(maxK, (w - pad * 2) / Math.max(40, x1 - x0), (h - pad * 1.6) / Math.max(40, y1 - y0)));
    this.flyTo(k, w / 2 - ((x0 + x1) / 2) * k, h / 2 - ((y0 + y1) / 2) * k);
  }
  frameIds(ids: string[], maxK?: number) { this.frame(ids.map((id) => this.L.spots.get(id)).filter(Boolean) as { x: number; y: number }[], maxK); }
  /** Pan just enough to keep a person visible. Zooms in a little if the view is wide. */
  reveal(id: string) {
    const sp = this.L.spots.get(id);
    if (!sp) return;
    const w = this.w - this.inset.right, h = this.h - this.inset.bottom;
    const k = Math.max(this.k, Math.min(1.5, this.fitK * 1.9));
    const sx = sp.x * this.k + this.tx, sy = sp.y * this.k + this.ty;
    if (k === this.k && sx > 60 && sx < w - 60 && sy > 60 && sy < h - 60) return;
    this.flyTo(k, w / 2 - sp.x * k, h / 2 - sp.y * k);
  }
  private flyTo(k: number, tx: number, ty: number, ms = 620) {
    cancelAnimationFrame(this.anim);
    this.autoCam = false;
    if (Math.abs(k - this.fitK) > 0.002) this.follow = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const k0 = this.k, x0 = this.tx, y0 = this.ty, t0 = performance.now();
    if (reduce || ms <= 0) { this.k = k; this.tx = tx; this.ty = ty; this.apply(); return; }
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3);
      this.k = k0 + (k - k0) * e; this.tx = x0 + (tx - x0) * e; this.ty = y0 + (ty - y0) * e;
      this.apply();
      if (u < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }
  private apply() {
    this.world.setAttribute('transform', `translate(${f1(this.tx)} ${f1(this.ty)}) scale(${this.k.toFixed(4)})`);
    const k = this.k;
    const ds = Math.pow(Math.max(0.4, Math.min(4, k)), 0.42) / k;
    const ls = Math.pow(Math.max(0.3, Math.min(2.2, k)), 0.45) / k;
    this.svg.style.setProperty('--ds', ds.toFixed(4));
    this.svg.style.setProperty('--ls', ls.toFixed(4));
    this.svg.classList.toggle('zoom-mid', k >= 0.95);
    this.svg.classList.toggle('zoom-near', k >= 1.7);
    this.svg.classList.toggle('zoom-far', k < 0.42);
    this.svg.classList.toggle('zoom-close', k >= 3.2);
    this.drawGrid();
    this.placeCursor();
    if (!this.autoCam) this.nameG.style.opacity = '0';
    this.queueLabels();
  }
  private queueLabels() {
    // while the camera is travelling by itself, refresh names steadily instead of waiting for it to stop
    if (this.autoCam) { if (!this.labelTimer) this.labelTimer = window.setTimeout(() => { this.labelTimer = 0; this.layoutNames(); }, 260); return; }
    clearTimeout(this.labelTimer);
    this.labelTimer = window.setTimeout(() => { this.labelTimer = 0; this.layoutNames(); }, 140);
  }
  /**
   * Name labels are placed in screen space, most important first, and a name
   * that would sit on top of another is left out until you zoom in.
   */
  private layoutNames() {
    const k = this.k, W = this.w, H = this.h;
    const near = k >= 1.5, close = k >= 2.6, few = this.lit !== null && this.lit.size <= 16;
    type Box = [number, number, number, number];
    const boxes: Box[] = [];
    const hits = (b: Box) => boxes.some((o) => b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3]);
    const midZoom = this.svg.classList.contains('zoom-mid');
    const ls = Math.pow(Math.max(0.3, Math.min(2.2, k)), 0.45);
    const far = this.svg.classList.contains('zoom-far');
    const fixed = [...this.streamLabels].sort((a, b) => Number(a.minor) - Number(b.minor) || Number(b.kind === 'flag') - Number(a.kind === 'flag'));
    for (const s of fixed) {
      if ((s.minor && !s.kind && !midZoom) || (s.kind && far)) { s.el.style.visibility = ''; continue; }
      const x = s.x * k + this.tx, y = s.y * k + this.ty;
      const b: Box = s.kind === 'flag' ? [x, y - 46 * ls, x + s.w * ls, y - 16 * ls]
        : s.kind === 'ox' ? [x - (s.w * ls) / 2, y - 12 * ls, x + (s.w * ls) / 2, y + 4]
        : [x - 2, y - (s.minor ? 12 : 30) * ls, x + s.w * ls, y + 4];
      const clash = (s.minor || s.kind === 'ox') && hits(b);
      s.el.style.visibility = clash ? 'hidden' : '';
      if (!clash) boxes.push(b);
    }
    const cands: { d: DotRef; pr: number }[] = [];
    for (const [id, d] of this.dots) {
      if (d.p.living || d.state === 'unborn') continue;
      const sx = d.x * k + this.tx, sy = d.y * k + this.ty;
      if (sx < -20 || sx > W + 20 || sy < -10 || sy > H) continue;
      const lit = this.lit?.has(id);
      let pr = -1;
      if (id === this.selected) pr = 100;
      else if (few && lit) pr = 80 + (d.anc ? 5 : 0);
      else if (this.lit && !lit) pr = close ? 5 : -1;
      else if (near && d.anc) pr = 50;
      else if (close) pr = 20;
      if (this.lit && lit && !few && (near || close)) pr = Math.max(pr, 60);
      if (pr >= 0) cands.push({ d, pr });
    }
    cands.sort((a, b) => b.pr - a.pr || a.d.b - b.d.b);
    const dotR = 6;
    for (const [, d] of this.dots) {
      if (d.state === 'unborn') continue;
      const sx = d.x * k + this.tx, sy = d.y * k + this.ty;
      if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
      boxes.push([sx - 3, sy - 3, sx + 3, sy + 3]);
    }
    let html = '';
    for (const { d, pr } of cands.slice(0, 160)) {
      const name = d.p.name ?? '';
      const w = name.length * 6.1 + 4, h = 14;
      const sx = d.x * k + this.tx, sy = d.y * k + this.ty;
      const opts: [number, number, string][] = [[dotR + 2, 4, 'start'], [-dotR - 2, 4, 'end'], [0, -dotR - 4, 'middle'], [0, dotR + 13, 'middle'], [dotR, -8, 'start'], [dotR, 15, 'start'], [-dotR, -8, 'end'], [-dotR, 15, 'end']];
      for (const [dx, dy, anchor] of opts) {
        const x0 = anchor === 'start' ? sx + dx : anchor === 'end' ? sx + dx - w : sx - w / 2;
        const b: Box = [x0, sy + dy - h + 3, x0 + w, sy + dy + 3];
        if (hits(b) && pr < 100) continue;
        boxes.push(b);
        html += `<text x="${f1(sx + dx)}" y="${f1(sy + dy)}" text-anchor="${anchor}" class="${pr >= 80 ? 'hi' : ''}">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
        break;
      }
    }
    this.nameG.innerHTML = html;
    this.nameG.style.opacity = '1';
  }
  private drawGrid() {
    const L = this.L;
    const pxPerYear = 4 * this.k;
    const step = pxPerYear > 9 ? 10 : pxPerYear > 3.2 ? 50 : 100;
    let html = '';
    for (let y = Math.ceil(L.Y0 / step) * step; y <= L.Y1; y += step) {
      const x = L.X(y) * this.k + this.tx;
      if (x < -20 || x > this.w + 20) continue;
      const major = y % 100 === 0;
      html += `<line x1="${f1(x)}" x2="${f1(x)}" y1="0" y2="${this.h - 22}" class="${major ? 'major' : ''}"/><text x="${f1(x)}" y="${this.h - 7}" text-anchor="middle" class="${major ? 'major' : ''}">${y}</text>`;
    }
    this.gridG.innerHTML = html;
  }
  private placeCursor() {
    const x = this.L.X(this.year) * this.k + this.tx;
    if (!this.cursorG.firstChild) {
      this.cursorG.innerHTML = `<line y1="0" class="cur-line"/><g class="cur-handle"><rect x="-27" y="58" width="54" height="24" rx="12"/><text y="75" text-anchor="middle"></text></g><rect class="cur-hit" x="-10" y="0" width="20" fill="transparent"/>`;
    }
    this.cursorG.setAttribute('transform', `translate(${f1(x)} 0)`);
    (this.cursorG.querySelector('.cur-line') as SVGLineElement).setAttribute('y2', String(this.h - 22));
    (this.cursorG.querySelector('.cur-hit') as SVGRectElement).setAttribute('height', String(this.h));
    this.cursorG.querySelector('text')!.textContent = String(Math.round(this.year));
  }

  // ---------- input ----------
  private bind() {
    const svg = this.svg;
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); this.ev.onStep(e.key === 'ArrowDown' ? 1 : -1); }
    });
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: 'none' | 'pan' | 'scrub' | 'pinch' = 'none';
    let moved = 0, start = { x: 0, y: 0 }, pinch0 = 0, target: Element | null = null;
    const local = (e: MouseEvent) => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    /** the nearest visible light to a screen point, the named before the unnamed */
    const nearDot = (p: { x: number; y: number }, max: number) => {
      let near: string | null = null, best = max;
      for (const [id, d] of this.dots) {
        if (d.state === 'unborn') continue;
        const dist = Math.hypot(d.x * this.k + this.tx - p.x, d.y * this.k + this.ty - p.y) + (d.p.living ? 3 : 0);
        if (dist < best) { best = dist; near = id; }
      }
      return { id: near, dist: best };
    };
    const nearConf = (p: { x: number; y: number }, max: number) => {
      let fam: string | null = null, best = max;
      for (const c of this.confs) {
        if (c.year > this.year) continue;
        const dist = Math.hypot(c.x * this.k + this.tx - p.x, c.y * this.k + this.ty - p.y);
        if (dist < best) { best = dist; fam = c.fam; }
      }
      return { fam, dist: best };
    };
    const scrubTo = (x: number, final: boolean) => {
      const y = Math.round(Math.max(this.minYear, Math.min(this.data.meta.thisYear, this.L.invX((x - this.tx) / this.k))));
      this.ev.onYear(y, final);
    };
    svg.addEventListener('pointerdown', (e) => {
      const p = local(e);
      pointers.set(e.pointerId, p);
      target = e.target as Element;
      svg.setPointerCapture(e.pointerId);
      cancelAnimationFrame(this.anim);
      moved = 0; start = p;
      if (!(e.target as Element).closest('.cursor')) this.autoCam = false;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); mode = 'pinch'; return; }
      // the year line is a handle, but a light sitting on it is still a light
      mode = target.closest('.cur-handle') || (target.closest('.cursor') && !nearDot(p, 12).id) ? 'scrub' : 'pan';
      if (mode === 'scrub') svg.classList.add('scrubbing');
    });
    svg.addEventListener('pointermove', (e) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        const g = (e.target as Element).closest?.('.p') as SVGGElement | null;
        this.ev.onHover(g?.dataset.id ?? null, e.clientX, e.clientY);
        return;
      }
      pointers.set(e.pointerId, p);
      moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
      if (mode === 'pinch' && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const k = Math.max(this.fitK * 0.7, Math.min(9, this.k * (dist / (pinch0 || dist))));
        const r = k / this.k;
        this.tx = cx - (cx - this.tx) * r; this.ty = cy - (cy - this.ty) * r; this.k = k; pinch0 = dist;
        this.apply();
      } else if (mode === 'scrub') scrubTo(p.x, false);
      else if (mode === 'pan' && moved > 4) { this.follow = false; this.tx += p.x - prev.x; this.ty += p.y - prev.y; this.clampPan(); svg.classList.add('panning'); this.ev.onHover(null, 0, 0); this.apply(); }
    });
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const p = local(e);
      pointers.delete(e.pointerId);
      svg.classList.remove('panning', 'scrubbing');
      if (mode === 'scrub') scrubTo(p.x, true);
      else if (mode === 'pan' && moved <= 6 && e.type === 'pointerup') {
        // a tap. Pointer capture swallows click, so dispatch by hand.
        const hit = document.elementFromPoint(e.clientX, e.clientY) ?? target;
        const g = hit?.closest?.('.p') as SVGGElement | null;
        // small lights are hard to hit: a near miss still counts
        const dot = nearDot(p, e.pointerType === 'mouse' ? 14 : 20);
        const conf = nearConf(p, 8);
        this.ev.onHover(null, 0, 0);
        if (conf.fam && conf.dist < dot.dist) this.ev.onConfluence(conf.fam);
        else if (g && dot.dist > 9) this.ev.onSelect(g.dataset.id!);
        else if (dot.id) this.ev.onSelect(dot.id);
        else if (g) this.ev.onSelect(g.dataset.id!);
        else {
          const other = hit?.closest?.('.conf') ?? hit?.closest?.('.oxbow-mark') ?? hit?.closest?.('.slabel') ?? hit?.closest?.('.headwaters') ?? hit?.closest?.('.stream');
          this.ev.onHover(null, 0, 0);
          if (other) other.dispatchEvent(new MouseEvent('click', { bubbles: false }));
          else this.ev.onSelect(null);
        }
      }
      if (pointers.size < 2 && mode === 'pinch') mode = 'none';
      if (!pointers.size) mode = 'none';
      void start;
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', () => this.ev.onHover(null, 0, 0));
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      if (e.shiftKey || (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey)) { this.tx -= e.deltaX || e.deltaY; this.apply(); return; }
      this.autoCam = false;
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022));
      const k = Math.max(this.fitK * 0.7, Math.min(9, this.k * f));
      const r = k / this.k;
      cancelAnimationFrame(this.anim);
      this.tx = p.x - (p.x - this.tx) * r; this.ty = p.y - (p.y - this.ty) * r; this.k = k;
      this.apply();
    }, { passive: false });
    svg.addEventListener('dblclick', (e) => { if ((e.target as Element).closest('.p, .conf, .cursor')) return; const p = local(e); this.zoomBy(1.8, p.x, p.y); });
  }
}
