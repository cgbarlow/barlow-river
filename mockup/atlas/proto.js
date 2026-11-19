// Mockup prototype for The Atlas. One script, three directions, chosen by <body data-mode>.
// Rough on purpose: it is here to choose a direction, not to be the build.
import { geoOrthographic, geoEqualEarth, geoMercator, geoPath, geoGraticule10, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';

const D = window.DATA, MODE = document.body.dataset.mode;
const land110 = feature(window.LAND110, window.LAND110.objects.land);
const land50 = window.LAND50 ? feature(window.LAND50, window.LAND50.objects.land) : land110;
const $ = (s) => document.querySelector(s);
const canvas = $('#c'), ctx = canvas.getContext('2d'), inset = $('#inset'), ictx = inset.getContext('2d');
const A = D.actors, siteOf = (pid) => D.places[D.places[pid].site];
const Y0 = 1590, Y1 = 2026;
let Y = 1600, playing = false, auto = true, selected = null, W = 0, H = 0, dpr = 1;

// ---- a stable seat for each light at a crowded place ----
{
  const items = [], pools = {};
  for (const a of A) { a.slots = []; a.st.forEach((s, i) => items.push({ a, i, site: D.places[s[0]].site, start: i ? a.st[i - 1][2] : a.b, end: i < a.st.length - 1 ? a.st[i + 1][1] : a.d })); }
  items.sort((x, y) => x.start - y.start);
  for (const it of items) { const pool = (pools[it.site] ??= []); let k = pool.findIndex((e) => e <= it.start); if (k < 0) k = pool.length; pool[k] = it.end; it.a.slots[it.i] = k; }
}
const spiral = (slot, gap) => { const r = gap * Math.sqrt(slot), t = slot * 2.39996; return [r * Math.cos(t), r * Math.sin(t)]; };

function where(a, y) {
  const st = a.st;
  for (let i = 0; i < st.length; i++) {
    const s = st[i], n = st[i + 1];
    if (!n || y <= s[2]) return { i };
    const w = n[1] - s[2];
    // both ends recorded in the same year: the voyage is drawn across that year
    if (w === 0 && y >= n[1] && y < n[1] + 1 && y < n[2] + 1) return { i, t: y - n[1], sail: true };
    if (y >= n[1]) continue;
    if (w <= 3) { const span = Math.max(1, w), start = n[1] - span; if (y <= start) return { i }; return { i, t: (y - start) / span, sail: true }; }
    return { i, t: (y - s[2]) / w, sail: false };
  }
}
function along(pts, t) {
  const f = Math.max(0, Math.min(1, t)) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
  let dl = pts[i + 1][0] - pts[i][0]; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
  return [pts[i][0] + dl * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
}

// ---- what is on the map in a given year ----
function scene(y) {
  const lights = [], traces = [], embers = [], ripples = [];
  let alive = 0, ship = null;
  for (const a of A) {
    if (y < a.b) continue;
    const dead = y >= a.d, w = dead ? { i: a.st.length - 1 } : where(a, y);
    const dim = selected && selected !== a ? 0.3 : 1;
    for (let j = 0; j < w.i; j++) { const l = a.legs[j]; if (l.km > 3) traces.push({ a, l, pts: l.pts, style: l.doubt ? 'doubt' : 'done', alpha: (dead ? 0.2 : 0.42) * dim }); }
    const s = a.st[w.i], here = siteOf(s[0]).ll;
    if (dead) {
      if (a.e) embers.push({ a, ll: here, slot: a.slots[w.i], alpha: dim });
      if (y < a.d + 3) ripples.push({ ll: here, slot: a.slots[w.i], age: (y - a.d) / 3, kind: 'death', c: a.c });
      continue;
    }
    alive++;
    const haze = D.places[s[0]].prec === 'area' || D.places[s[0]].prec === 'country';
    if (y < a.b + 2) ripples.push({ ll: here, slot: a.slots[w.i], age: (y - a.b) / 2, kind: 'birth', c: a.c });
    if (w.t === undefined) { lights.push({ a, ll: here, slot: a.slots[w.i], alpha: dim, haze, pid: s[0] }); continue; }
    const l = a.legs[w.i], n = a.st[w.i + 1], there = siteOf(n[0]).ll;
    if (w.sail) {
      const p = along(l.pts, w.t);
      lights.push({ a, ll: p, slot: -1, alpha: dim, moving: true, leg: l, t: w.t, from: s[0], to: n[0] });
      traces.push({ a, l, pts: l.pts, upto: w.t, style: 'sail', alpha: 0.9 * dim });
      if (l.km > 9000) ship = p;
    } else {
      lights.push({ a, ll: here, slot: a.slots[w.i], alpha: Math.max(0.18, 1 - w.t) * dim, haze, pid: s[0] });
      lights.push({ a, ll: there, slot: a.slots[w.i + 1], alpha: Math.max(0.18, w.t) * dim, haze: false, pid: n[0], ghost: true });
      if (l.km > 3) traces.push({ a, l, pts: l.pts, style: l.doubt ? 'doubt' : 'fade', alpha: 0.5 * dim, t: w.t });
    }
  }
  return { lights, traces, embers, ripples, alive, ship };
}

// ---- drawing ----
const sprites = new Map();
function glow(c, soft) {
  const key = c + soft; let s = sprites.get(key);
  if (!s) { s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, c + (soft ? '66' : 'cc')); gr.addColorStop(soft ? 0.6 : 0.25, c + (soft ? '33' : '44')); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); sprites.set(key, s); }
  return s;
}
let hits = [];
function drawView(c, v, sc, opts = {}) {
  const { proj, vis } = v, path = geoPath(proj, c), gap = opts.gap ?? 7;
  // traces
  c.lineCap = 'round';
  for (const t of sc.traces) {
    const pts = t.upto !== undefined ? t.pts.slice(0, Math.max(2, Math.ceil(t.upto * (t.pts.length - 1)) + 1)) : t.pts;
    c.beginPath(); path({ type: 'LineString', coordinates: pts });
    c.globalAlpha = t.alpha; c.strokeStyle = t.style === 'doubt' ? '#FF8A7A' : t.a.c; c.lineWidth = opts.tiny ? 0.8 : t.style === 'sail' ? 2 : 1.3;
    c.setLineDash(t.style === 'fade' ? [5, 5] : t.style === 'doubt' ? [1.5, 5] : []); c.stroke();
  }
  c.setLineDash([]); c.globalAlpha = 1;
  const at = (ll, slot) => { if (vis && !vis(ll)) return null; const p = proj(ll); if (!p) return null; if (v.clip && (p[0] < v.clip[0] || p[0] > v.clip[2] || p[1] < v.clip[1] || p[1] > v.clip[3])) return null; if (slot > 0) { const o = spiral(slot, gap); p[0] += o[0]; p[1] += o[1]; } return p; };
  if (opts.tiny) { for (const l of sc.lights) { const p = at(l.ll, 0); if (!p) continue; c.globalAlpha = l.alpha; c.fillStyle = l.a.c; c.fillRect(p[0] - 1, p[1] - 1, 2.2, 2.2); } c.globalAlpha = 1; return; }
  for (const e of sc.embers) { const p = at(e.ll, e.slot); if (!p) continue; c.globalAlpha = 0.5 * e.alpha; c.fillStyle = e.a.c; c.beginPath(); c.arc(p[0], p[1], 1.3, 0, 7); c.fill(); }
  c.globalCompositeOperation = 'lighter';
  for (const l of sc.lights) {
    const p = at(l.ll, l.slot); if (!p) continue;
    c.globalAlpha = l.alpha * (l.haze ? 0.35 : l.a.h ? 0.45 : 1);
    const r = l.haze ? 26 : l.moving ? 14 : 11; c.drawImage(glow(l.a.c, l.haze), p[0] - r, p[1] - r, r * 2, r * 2);
  }
  c.globalCompositeOperation = 'source-over';
  for (const l of sc.lights) {
    const p = at(l.ll, l.slot); if (!p) continue;
    c.globalAlpha = l.alpha;
    if (l.haze) { c.strokeStyle = l.a.c; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath(); c.arc(p[0], p[1], 9, 0, 7); c.stroke(); c.setLineDash([]); }
    else if (l.a.h) { c.strokeStyle = l.a.c; c.lineWidth = 1.4; c.beginPath(); c.arc(p[0], p[1], 2.6, 0, 7); c.stroke(); }
    else { c.fillStyle = l.a.c; c.beginPath(); c.arc(p[0], p[1], l.moving ? 3.6 : 2.8, 0, 7); c.fill(); c.fillStyle = '#fff'; c.globalAlpha = l.alpha * 0.7; c.beginPath(); c.arc(p[0], p[1], 1, 0, 7); c.fill(); }
    if (l.a === selected) { c.globalAlpha = 1; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(p[0], p[1], 7, 0, 7); c.stroke(); }
    hits.push({ x: p[0], y: p[1], l });
  }
  for (const r of sc.ripples) {
    const p = at(r.ll, r.slot); if (!p) continue;
    const u = r.kind === 'birth' ? r.age : 1 - r.age;
    c.globalAlpha = (1 - r.age) * 0.8; c.strokeStyle = r.c; c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1], 3 + u * (r.kind === 'birth' ? 11 : 6), 0, 7); c.stroke();
  }
  c.globalAlpha = 1;
  // place names, the busiest first
  const count = new Map();
  for (const l of sc.lights) if (l.pid) { const s = D.places[l.pid].site; count.set(s, (count.get(s) ?? 0) + l.alpha); }
  const boxes = [];
  c.font = '500 11px Inter, system-ui, sans-serif'; c.textBaseline = 'middle';
  for (const [sid, n] of [...count].sort((a, b) => b[1] - a[1]).slice(0, opts.labels ?? 10)) {
    const pl = D.places[sid], p = at(pl.ll, 0); if (!p) continue;
    const text = pl.name.split(',')[0].replace(' (then Alexandra)', ''), tw = c.measureText(text).width, off = 8 + gap * Math.sqrt(Math.min(n, 30));
    const box = [p[0] + off, p[1] - 7, p[0] + off + tw, p[1] + 7];
    if (boxes.some((b) => box[0] < b[2] + 4 && box[2] > b[0] - 4 && box[1] < b[3] && box[3] > b[1])) continue;
    boxes.push(box);
    c.fillStyle = 'rgba(10,20,34,.7)'; c.fillRect(box[0] - 3, box[1], tw + 6, 14); c.fillStyle = '#C5D1E0'; c.fillText(text, box[0], p[1]);
  }
}
function base(c, v, land, globe) {
  const path = geoPath(v.proj, c);
  if (globe) {
    const [cx, cy] = v.proj.translate(), R = v.proj.scale();
    const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R); g.addColorStop(0, '#16304f'); g.addColorStop(1, '#0b1a2e');
    c.shadowColor = '#3d6ea8'; c.shadowBlur = 26; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.shadowBlur = 0;
  } else { c.fillStyle = '#0e1d33'; c.beginPath(); path({ type: 'Sphere' }); c.fill(); }
  c.strokeStyle = 'rgba(120,150,190,.12)'; c.lineWidth = 0.6; c.beginPath(); path(geoGraticule10()); c.stroke();
  c.fillStyle = '#24395a'; c.strokeStyle = '#3a5580'; c.lineWidth = 0.7; c.beginPath(); path(land); c.fill(); c.stroke();
}

// ---- cameras ----
const cam = { lon: 1, lat: 52.5, k: 7, cx: 0, cy: 0, fk: 1 };
const flatBase = geoEqualEarth().rotate([-87, 0]).translate([0, 0]);
let side = 'eu';
function globeTarget(sc) {
  if (sc.ship) return { lon: sc.ship[0], lat: sc.ship[1], k: 1.7 };
  const sum = { eu: [0, 0, 0], nz: [0, 0, 0] };
  for (const l of sc.lights) { if (l.moving || l.ll[0] < -30) continue; const s = l.ll[0] > 100 ? 'nz' : 'eu', w = l.alpha * (Y - l.a.b < 30 ? 3 : 1); sum[s][0] += l.ll[0] * w; sum[s][1] += l.ll[1] * w; sum[s][2] += w; }
  const other = side === 'eu' ? 'nz' : 'eu';
  if (sum[other][2] > sum[side][2] * 1.15) side = other;
  const s = sum[side]; if (!s[2]) return null;
  const c = [s[0] / s[2], s[1] / s[2]];
  let spread = 1; for (const l of sc.lights) if (!l.moving && (l.ll[0] > 100) === (side === 'nz') && l.ll[0] > -30) spread = Math.max(spread, geoDistance(c, l.ll) * 57.3);
  return { lon: c[0], lat: c[1], k: Math.max(1.8, Math.min(9, 34 / (spread + 2))) };
}
function flatTarget(sc) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const l of sc.lights) { const p = flatBase.scale(flatS0())(l.ll); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  if (x0 > x1) return null;
  const k = Math.max(1, Math.min(30, Math.min((W * 0.62) / (x1 - x0 + 14), (H * 0.6) / (y1 - y0 + 14))));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, fk: k };
}
const flatS0 = () => Math.min(W / 5.4, H / 2.7);
function views() {
  if (MODE === 'globe') {
    const R = Math.min(W, H) * 0.44 * cam.k, proj = geoOrthographic().rotate([-cam.lon, -cam.lat]).scale(R).translate([W / 2, H / 2]).clipAngle(90);
    return [{ proj, vis: (ll) => geoDistance(ll, [cam.lon, cam.lat]) < 1.5, globe: true, land: cam.k > 3 ? land50 : land110 }];
  }
  if (MODE === 'chart') {
    const s = flatS0(), proj = geoEqualEarth().rotate([-87, 0]).scale(s * cam.fk).translate([W / 2 - cam.cx * cam.fk, H / 2 - cam.cy * cam.fk]);
    return [{ proj, land: cam.fk > 3 ? land50 : land110 }];
  }
  // two shores: Britain and New Zealand drawn large, the ocean between them folded away
  const tall = H > W, g = tall ? 0 : W * 0.13;
  const rects = tall ? [[10, 84, W - 10, H * 0.5 + 10], [10, H * 0.5 + 34, W - 10, H - 64]] : [[16, 84, (W - g) / 2, H - 84], [(W + g) / 2, 84, W - 16, H - 84]];
  const fit = (r, box) => geoMercator().fitExtent([[r[0] + 12, r[1] + 12], [r[2] - 12, r[3] - 12]], { type: 'MultiPoint', coordinates: [[box[0], box[1]], [box[2], box[3]]] }).clipExtent([[r[0], r[1]], [r[2], r[3]]]);
  const inBox = (b) => (ll) => ll[0] >= b[0] && ll[0] <= b[2] && ll[1] >= b[1] && ll[1] <= b[3];
  const GB = [-8.6, 49.7, 2.4, 55.3], NZ = [166, -47.6, 179, -34], PLD = [13.5, 48.8, 24.6, 55];
  const r0 = rects[0], pr = [r0[0] + 8, r0[1] + 8, r0[0] + 8 + Math.min(170, (r0[2] - r0[0]) * 0.3), r0[1] + 8 + Math.min(130, (r0[3] - r0[1]) * 0.26)];
  return [
    { proj: fit(rects[0], GB), vis: inBox(GB), clip: rects[0], rect: rects[0], land: land50, title: 'Britain and Ireland', hide: pr },
    { proj: fit(rects[1], NZ), vis: inBox(NZ), clip: rects[1], rect: rects[1], land: land50, title: 'New Zealand' },
    { proj: fit(pr, PLD), vis: inBox(PLD), clip: pr, rect: pr, land: land50, title: 'Poland', small: true },
  ];
}

function draw() {
  const sc = scene(Y);
  if (auto) {
    if (MODE === 'globe') { const t = globeTarget(sc); if (t) { let dl = t.lon - cam.lon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; const far = Math.abs(dl) > 40; cam.lon += dl * 0.035; cam.lat += (t.lat - cam.lat) * 0.035; cam.k += ((far ? Math.min(t.k, 1.5) : t.k) - cam.k) * 0.03; } }
    if (MODE === 'chart') { const t = flatTarget(sc); if (t) { cam.cx += (t.cx - cam.cx) * 0.04; cam.cy += (t.cy - cam.cy) * 0.04; cam.fk += (t.fk - cam.fk) * 0.04; } }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  hits = [];
  const vs = views();
  if (MODE !== 'shores') { base(ctx, vs[0], vs[0].land, vs[0].globe); drawView(ctx, vs[0], sc, { gap: MODE === 'globe' ? Math.min(9, 3 + cam.k * 0.7) : Math.min(9, 3 + cam.fk * 0.5) }); }
  else drawShores(vs, sc);
  if (MODE === 'globe') {
    const iw = inset.clientWidth, ih = inset.clientHeight; ictx.setTransform(dpr, 0, 0, dpr, 0, 0); ictx.clearRect(0, 0, iw, ih);
    const v = { proj: geoEqualEarth().rotate([-87, 0]).fitExtent([[6, 6], [iw - 6, ih - 6]], { type: 'Sphere' }) };
    base(ictx, v, land110, false); drawView(ictx, v, sc, { tiny: true });
    const p = v.proj([cam.lon, cam.lat]); ictx.strokeStyle = '#F2B544'; ictx.lineWidth = 1.2; ictx.beginPath(); ictx.arc(p[0], p[1], Math.max(5, 60 / cam.k), 0, 7); ictx.stroke();
  }
  $('#year').textContent = Math.round(Y);
  $('#alive').textContent = `${sc.alive} lit · ${D.counts.living} living not shown`;
  caption();
  return sc;
}
function drawShores(vs, sc) {
  for (const v of vs) {
    const r = v.rect; ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); ctx.clip();
    ctx.fillStyle = '#0e1d33'; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    const path = geoPath(v.proj, ctx); ctx.fillStyle = '#24395a'; ctx.strokeStyle = '#3a5580'; ctx.lineWidth = 0.8; ctx.beginPath(); path(v.land); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#2A3F5F'; ctx.lineWidth = 1; ctx.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2] - r[0], r[3] - r[1]);
    ctx.fillStyle = '#9FB0C6'; ctx.font = '500 11px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'alphabetic'; ctx.fillText(v.title.toUpperCase(), r[0] + 8, v.small ? r[1] + 16 : r[1] - 8);
  }
  const panelOf = (ll) => vs.find((v) => v.vis(ll));
  const pos = (ll) => { const v = panelOf(ll); return v ? v.proj(ll) : null; };
  // moves inside a panel are drawn on it; moves between panels arc across the gap
  const local = { ...sc, traces: [], lights: [] };
  for (const t of sc.traces) {
    const a = t.pts[0], b = t.pts[t.pts.length - 1], va = panelOf(a), vb = panelOf(b);
    if (va && va === vb) { local.traces.push(t); continue; }
    const p = pos(a), q = pos(b); if (!p || !q) continue;
    const tall = H > W, mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, bend = tall ? 0 : -Math.min(120, Math.abs(q[0] - p[0]) * 0.18);
    const cpx = mx + (tall ? 60 : 0), cpy = my + bend;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(cpx, cpy, q[0], q[1]);
    ctx.globalAlpha = t.alpha; ctx.strokeStyle = t.style === 'doubt' ? '#FF8A7A' : t.a.c; ctx.lineWidth = t.style === 'sail' ? 2 : 1.2; ctx.setLineDash(t.style === 'fade' ? [5, 5] : t.style === 'sail' ? [] : []); ctx.stroke(); ctx.setLineDash([]);
    if (t.style === 'sail') { const u = t.upto, x = (1 - u) * (1 - u) * p[0] + 2 * (1 - u) * u * cpx + u * u * q[0], y = (1 - u) * (1 - u) * p[1] + 2 * (1 - u) * u * cpy + u * u * q[1]; ctx.globalAlpha = 1; ctx.drawImage(glow(t.a.c, false), x - 14, y - 14, 28, 28); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  local.lights = sc.lights.filter((l) => !l.moving || (panelOf(l.ll)));
  for (const v of vs) drawView(ctx, v, local, { gap: v.small ? 5 : 7, labels: v.small ? 4 : 14 });
  if (W >= H) { ctx.save(); ctx.translate(W / 2, H / 2 + 40); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#6E8099'; ctx.font = 'italic 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('about 19,000 km · three months under sail', 0, 0); ctx.restore(); ctx.textAlign = 'left'; }
}

// ---- captions, from the moves themselves ----
const beats = [];
{
  const groups = new Map();
  for (const a of A) a.legs.forEach((l, i) => { if (l.km < 1500 && !l.doubt) return; const from = siteOf(a.st[i][0]).name.split(',')[0], to = siteOf(a.st[i + 1][0]).name.split(',')[0], key = [l.y0, l.y1, from, to].join('|'); (groups.get(key) ?? groups.set(key, { l, from, to, who: [] }).get(key)).who.push(a.n); });
  for (const g of groups.values()) {
    const who = g.who.length > 2 ? `${g.who[0]} and ${g.who.length - 1} others` : g.who.join(' and ');
    if (g.l.doubt) beats.push({ y: g.l.y1, text: `A Francis Barlow is a father in ${g.to}. If he is the boy baptised at ${g.from}, he came 250 km and was fifteen. The tree doubts it.` });
    else if (g.l.sail) beats.push({ y: g.l.y0, text: `${who}: in ${g.from} in ${g.l.y0}, in ${g.to} by ${g.l.y1}. The voyage falls in ${g.l.y1 === g.l.y0 ? 'that year' : 'those years'}.` });
    else beats.push({ y: g.l.y1, text: `By ${g.l.y1} ${who} ${g.who.length > 1 ? 'are' : 'is'} in ${g.to}. Last recorded in ${g.from} in ${g.l.y0}; when the move happened is not recorded.` });
  }
  beats.sort((a, b) => a.y - b.y);
}
let shown = null;
function caption() {
  let b = null; for (const x of beats) if (x.y <= Y && Y < x.y + 9) b = x;
  if (b === shown) return; shown = b;
  const el = $('#caption'); el.classList.toggle('on', !!b); if (b) el.innerHTML = `<b>${b.y}</b>${b.text}`;
}

// ---- time ----
let last = 0;
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) {
    const sc = scene(Y);
    Y += dt * (sc.ship ? 0.5 : Y < 1650 ? 14 : 8);
    if (Y >= Y1) { Y = Y1; setPlaying(false); }
    $('#track').value = Math.round(Y);
  }
  draw(); requestAnimationFrame(tick);
}
function setPlaying(p) { playing = p; $('#play').textContent = p ? '❚❚' : '▶'; if (p) { auto = true; if (Y >= Y1) Y = 1600; } }
$('#play').onclick = () => setPlaying(!playing);
$('#track').oninput = (e) => { setPlaying(false); Y = +e.target.value; };
addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); } if (e.key === 'ArrowRight') { setPlaying(false); Y = Math.min(Y1, Math.round(Y) + (e.shiftKey ? 10 : 1)); $('#track').value = Y; } if (e.key === 'ArrowLeft') { setPlaying(false); Y = Math.max(Y0, Math.round(Y) - (e.shiftKey ? 10 : 1)); $('#track').value = Y; } if (e.key === 'Escape') pick(null); });

// ---- pointer ----
function nearest(x, y) { let best = 16, hit = null; for (const h of hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < best) { best = d; hit = h; } } return hit; }
let drag = null, moved = false;
canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; moved = false; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (drag) {
    const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; drag = [e.clientX, e.clientY];
    if (moved && MODE === 'globe') { auto = false; const s = 57.3 / (Math.min(W, H) * 0.44 * cam.k); cam.lon -= dx * s; cam.lat = Math.max(-85, Math.min(85, cam.lat + dy * s)); }
    if (moved && MODE === 'chart') { auto = false; cam.cx -= dx / cam.fk; cam.cy -= dy / cam.fk; }
    return;
  }
  const h = nearest(x, y), tip = $('#tip');
  if (h) { const a = h.l.a; tip.hidden = false; tip.style.left = Math.min(innerWidth - 270, e.clientX + 14) + 'px'; tip.style.top = e.clientY + 14 + 'px'; tip.innerHTML = `<b>${a.n}</b><small>${a.b} to ${a.d}${a.h ? ' · no place of their own' : ''}</small>`; canvas.style.cursor = 'pointer'; }
  else { tip.hidden = true; canvas.style.cursor = MODE === 'shores' ? 'default' : 'grab'; }
});
canvas.addEventListener('pointerup', (e) => { const r = canvas.getBoundingClientRect(); if (!moved) { const h = nearest(e.clientX - r.left, e.clientY - r.top); pick(h ? h.l.a : null); } drag = null; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); auto = false; const f = Math.exp(-e.deltaY * 0.0015); if (MODE === 'globe') cam.k = Math.max(0.9, Math.min(40, cam.k * f)); if (MODE === 'chart') cam.fk = Math.max(0.9, Math.min(60, cam.fk * f)); }, { passive: false });
function pick(a) {
  selected = a; const card = $('#card'); card.hidden = !a; if (!a) return;
  const moves = a.legs.filter((l) => l.km > 3).map((l) => `<p>${l.sail ? 'Moved' : 'Moved some time'} between ${l.y0} and ${l.y1}: ${l.km.toLocaleString()} km.${l.kind !== 'direct' ? ' Drawn along the usual sea route of the time; the tree records no ship.' : ''}${l.doubt ? ' <b style="color:#FF8A7A">In doubt: ' + l.doubt + '.</b>' : ''}</p>`).join('');
  card.innerHTML = `<button aria-label="Close">×</button><h2>${a.n}</h2><div class="life">${a.b} to ${a.d} · ${a.line} line</div>${a.h ? '<p>No place is recorded for this person. The hollow light is where a close relative was.</p>' : ''}<ol>${a.stops.map((s) => `<li><b>${s[0]}</b><span>${s[1]}<small>${s[2]}${s[3] ? ' · no closer than this' : ''}</small></span></li>`).join('')}</ol>${moves}`;
  card.querySelector('button').onclick = () => pick(null);
}

$('#legend').innerHTML = `<span><i style="background:#F2B544"></i>Placed by a record</span><span><i class="ring"></i>No place of their own: shown with a relative</span><span><i class="haze"></i>Known only to a county or country</span><span><i class="em"></i>Died here</span><span><i class="ln"></i>A move, year known</span><span><i class="ln d"></i>A move, some time in a window</span><span><i class="ln q"></i>A move in doubt</span><span>${Object.entries(D.lines).map(([n, c]) => `<i style="background:${c}" title="${n}"></i>`).join(' ')} the seven lines</span>`;

function resize() { dpr = Math.min(2, devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; inset.width = inset.clientWidth * dpr; inset.height = inset.clientHeight * dpr; }
addEventListener('resize', resize); resize();
{ const q = new URLSearchParams(location.hash.slice(1)); if (q.get('y')) { Y = +q.get('y'); $('#track').value = Y; } const t = MODE === 'chart' ? flatTarget(scene(Y)) : MODE === 'globe' ? globeTarget(scene(Y)) : null; if (t) Object.assign(cam, t); if (q.get('play') !== '0' && !q.get('y')) setTimeout(() => setPlaying(true), 700); }
window.__proto = { set: (y) => { Y = y; }, cam, pick: (n) => pick(A.find((a) => a.n === n)), settle: () => { for (let i = 0; i < 200; i++) draw(); } };
requestAnimationFrame((t) => { last = t; tick(t); });
