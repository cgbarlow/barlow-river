import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ancestorLabel, buildLayout, LINES } from '../src/model/layout.ts';
import { CARDS, SOFT_BREAKS } from '../src/casefile.ts';
import type { RiverData } from '../src/model/types.ts';

const data: RiverData = JSON.parse(readFileSync('public/data/river.json', 'utf8'));
const L = buildLayout(data, new Set(SOFT_BREAKS));
const P = new Map(data.people.map((p) => [p.id, p]));

describe('river layout', () => {
  it('places every person exactly once', () => {
    expect(L.spots.size).toBe(data.people.length);
    expect(L.streams.reduce((n, s) => n + s.members.length, 0)).toBe(data.people.length);
    for (const s of L.spots.values()) { expect(Number.isFinite(s.x)).toBe(true); expect(Number.isFinite(s.y)).toBe(true); }
  });
  it('makes the Barlow line the trunk, reaching the present', () => {
    expect(L.trunk.line).toBe('Barlow');
    expect(L.trunk.joinX).toBe(data.meta.thisYear);
    expect(P.get(L.trunk.chain[0])?.name).toBe('Hugh Barlow');
  });
  it('shows all seven named lines', () => {
    for (const l of LINES) expect(L.streams.some((s) => s.line === l && !s.minor), l).toBe(true);
  });
  it('joins every tributary at or after its people are born, and before the stream it joins ends', () => {
    for (const s of L.streams) {
      if (!s.into || s.cut) continue;
      expect(s.joinX).toBeGreaterThan(s.startX);
      expect(s.joinX).toBeLessThanOrEqual(s.into.joinX);
    }
  });
  it('keeps neighbouring channels from sharing water', () => {
    // sample each pair of streams that are not parent and child, where both exist in the same year
    let clashes = 0;
    const live = L.streams.filter((s) => !s.cut);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.into === b || b.into === a) continue;
      const from = Math.max(a.startX, b.startX), to = Math.min(a.joinX - a.bend, b.joinX - b.bend);
      for (let t = from; t <= to; t += 3) {
        if (Math.abs(L.centre(a, t) - L.centre(b, t)) < L.halfWidth(a, t) + L.halfWidth(b, t) - 0.5) { clashes++; break; }
      }
    }
    expect(clashes).toBe(0);
  });
  it('keeps people from sitting on top of each other', () => {
    const spots = [...L.spots.values()];
    let overlaps = 0;
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      if (spots[i].stream !== spots[j].stream) continue;
      if (Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y) < 6) overlaps++;
    }
    expect(overlaps).toBeLessThanOrEqual(3);
  });
  it('computes where unbroken evidence ends, and the breaks above it', () => {
    expect(P.get(L.proofHead!)?.name).toBe('John Barlow');
    expect(L.breaks.map((b) => b.tier)).toContain('disputed');
    expect(L.breaks.length).toBeGreaterThanOrEqual(3);
  });
  it('cuts off the family that was ruled out', () => {
    const ranulph = L.spots.get('I900113')!;
    let s = ranulph.stream;
    while (s.into && !s.cut) s = s.into;
    expect(s.cut).toBe(true);
    expect(L.route('I900113')).toHaveLength(1);
  });
  it('routes any connected person downstream to the mouth', () => {
    const r = L.route('I11');
    expect(r.length).toBeGreaterThan(50);
    expect(r[r.length - 1][0]).toBeCloseTo(L.X(data.meta.thisYear), 0);
  });
  it('is deterministic', () => {
    const again = buildLayout(data, new Set(SOFT_BREAKS));
    for (const [id, s] of L.spots) { expect(again.spots.get(id)!.x).toBe(s.x); expect(again.spots.get(id)!.y).toBe(s.y); }
  });
});

describe('case file', () => {
  it('points every card at people who exist and are not living', () => {
    for (const c of CARDS) for (const id of c.people) { expect(P.has(id), `${c.id}: ${id}`).toBe(true); expect(P.get(id)!.living).toBe(false); }
  });
});

describe('ancestorLabel', () => {
  it('counts greats', () => {
    expect(ancestorLabel(1, 'M')).toBe('father');
    expect(ancestorLabel(2, 'F')).toBe('grandmother');
    expect(ancestorLabel(3)).toBe('great-grandparent');
    expect(ancestorLabel(7, 'M')).toBe('5× great-grandfather');
  });
});
