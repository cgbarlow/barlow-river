// Usage: node scripts/build-land.ts
// Writes src/atlas/land.json: the world's coastline, coarse (Natural Earth 1:110m),
// with Britain, Ireland and New Zealand swapped for the 1:50m outlines. The family
// lives on those islands, so that is where detail is worth its weight; drawing the
// whole world at 1:50m costs ten times as much every frame.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const load = (f: string) => { const t = JSON.parse(readFileSync(`node_modules/world-atlas/${f}`, 'utf8')); return (feature(t, t.objects.land) as any).features?.[0]?.geometry ?? (feature(t, t.objects.land) as any).geometry; };
const polys = (g: any): number[][][][] => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);
const BOXES = [[-11, 49.8, 2.2, 61], [165, -48, 179.6, -34]];
const bbox = (p: number[][][]) => { let x0 = 999, y0 = 999, x1 = -999, y1 = -999; for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
const inside = (b: number[]) => BOXES.some((B) => b[0] >= B[0] && b[1] >= B[1] && b[2] <= B[2] && b[3] <= B[3]);
const round = (p: number[][][], d: number) => p.map((ring) => ring.map(([x, y]) => [+x.toFixed(d), +y.toFixed(d)]));

const coarse = polys(load('land-110m.json')).filter((p) => !inside(bbox(p))).map((p) => round(p, 2));
const fine = polys(load('land-50m.json')).filter((p) => inside(bbox(p))).map((p) => round(p, 3));
const out = { type: 'MultiPolygon', coordinates: [...coarse, ...fine] };
writeFileSync('src/atlas/land.json', JSON.stringify(out));
const n = (ps: number[][][][]) => ps.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);
console.log(`land.json: ${coarse.length} coarse outlines (${n(coarse)} points), ${fine.length} detailed islands (${n(fine)} points)`);
