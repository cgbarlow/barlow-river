// Builds the three Atlas mockups into self-contained HTML files in mockup/atlas/.
// Usage: node scripts/build-mockups.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { buildLayout } from '../src/model/layout.ts';
import { legsOf, staysOf } from '../src/model/journey.ts';
import { densify, route } from '../src/model/geo.ts';

const river = JSON.parse(readFileSync('public/data/river.json', 'utf8'));
const atlas = JSON.parse(readFileSync('public/data/atlas.json', 'utf8'));
const LINE: Record<string, string> = { Barlow: '#F2B544', Finch: '#6FD3C3', Carter: '#F08C6E', Watkins: '#C3A6F5', Chmielewski: '#7DBBFF', Czeladka: '#F29BC4', Klos: '#B5DE7A' };
const L = buildLayout(river, new Set(['I900005']));
const P = new Map<string, any>(river.people.map((p: any) => [p.id, p]));
const PL = new Map<string, any>(atlas.places.map((p: any) => [p.id, p]));
const place = (id: string) => PL.get(id);
const r2 = (n: number) => Math.round(n * 100) / 100;

const actors = atlas.people.map((a: any) => {
  const p = P.get(a.id), st = staysOf(a, place), legs = legsOf(st, place);
  const last = st[st.length - 1].stops;
  return {
    n: p.name, b: p.b.y, d: p.d.y, line: L.spots.get(p.id)?.stream.line ?? 'Barlow', c: LINE[L.spots.get(p.id)?.stream.line ?? 'Barlow'],
    h: a.borrowed ? 1 : 0, e: last.some((s: any) => s.kind === 'death' || s.kind === 'burial') ? 1 : 0,
    st: st.map((s) => [s.p, s.from, s.to]),
    stops: a.stops.map((s: any) => [s.y, place(s.p).name, s.why, s.coarse ? 1 : 0]),
    legs: legs.map((l) => {
      const A = place(l.a), B = place(l.b);
      const rt = route([A.lon, A.lat], [B.lon, B.lat], l.y1);
      return { y0: l.y0, y1: l.y1, sail: l.sail, km: Math.round(l.km), doubt: l.doubt ?? '', kind: rt.kind, pts: densify(rt.pts, 250).pts.map((q) => [r2(q[0]), r2(q[1])]) };
    }),
  };
});
const data = {
  places: Object.fromEntries(atlas.places.map((p: any) => [p.id, { ll: [p.lon, p.lat], name: p.name, prec: p.prec, country: p.country, site: p.town ?? p.id }])),
  actors, counts: atlas.meta.counts, lines: LINE,
};
const land110 = readFileSync('node_modules/world-atlas/land-110m.json', 'utf8');
const land50 = readFileSync('node_modules/world-atlas/land-50m.json', 'utf8');

const js = (await build({ entryPoints: ['mockup/atlas/proto.js'], bundle: true, minify: true, format: 'iife', write: false })).outputFiles[0].text;
const css = readFileSync('mockup/atlas/proto.css', 'utf8');
const MODES: [string, string, string, string][] = [
  ['a-lantern-globe', 'globe', 'A · The Lantern Globe', 'The Earth turns to follow the family. A small flat map in the corner keeps the whole world in view.'],
  ['b-the-chart', 'chart', 'B · The Chart', 'One flat map. It opens close on Norfolk and pulls back as the family spreads, until both ends of the voyage are on the page.'],
  ['c-two-shores', 'shores', 'C · Two Shores', 'The family lives in two small places on opposite sides of the world. So draw those two places large, and the crossing between them.'],
];
for (const [file, mode, title, blurb] of MODES) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Atlas Mockup ${title.slice(0, 1)}</title><style>${css}</style></head>
<body data-mode="${mode}"><header><div><small>Mockup · Barlow family · The Atlas</small><h1>${title}</h1><p>${blurb}</p></div><nav>${MODES.map((m) => `<a href="${m[0]}.html"${m[0] === file ? ' class="on"' : ''}>${m[2].slice(0, 1)}</a>`).join('')}</nav></header>
<main id="stage"><canvas id="c"></canvas><canvas id="inset"></canvas><div id="caption"></div><div id="legend"></div><div id="tip" hidden></div><aside id="card" hidden></aside></main>
<footer><button id="play" aria-label="Play">▶</button><div id="year">1600</div><input id="track" type="range" min="1590" max="2026" value="1600" aria-label="Year"><div id="alive"></div></footer>
<script>window.DATA=${JSON.stringify(data)};window.LAND110=${land110};${mode === 'shores' ? `window.LAND50=${land50};` : ''}</script><script>${js}</script></body></html>`;
  writeFileSync(`mockup/atlas/${file}.html`, html);
  console.log(file, Math.round(html.length / 1024) + ' KB');
}
