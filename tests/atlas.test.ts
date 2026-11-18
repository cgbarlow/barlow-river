import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { buildAtlas, TOWN_ONLY_FROM } from '../pipeline/atlas.ts';
import { COUNTRY_BOX, locate, PLACE, PLACES } from '../pipeline/gazetteer.ts';
import { km, route, densify, slerp } from '../src/model/geo.ts';
import { legsOf, staysOf, whereAt, mostLikely, SAIL_MAX } from '../src/model/journey.ts';
import type { RiverData, Person, Family } from '../src/model/types.ts';
import type { AtlasPerson } from '../src/model/atlas-types.ts';

const place = (id: string) => PLACE.get(id)!;
const river: RiverData = JSON.parse(readFileSync('public/data/river.json', 'utf8'));
const { atlas, unmapped } = buildAtlas(river);
const P = new Map(river.people.map((p) => [p.id, p]));

function tiny(people: Partial<Person>[], families: Partial<Family>[] = []): RiverData {
  return {
    meta: { exportedAt: '', set: '', counts: { people: 0, living: 0, deceased: 0, families: 0, sources: 0 }, thisYear: 2026 },
    people: people.map((p) => ({ living: false, fams: [], ...p }) as Person),
    families: families.map((f) => ({ partners: [], children: [], estY: 1800, ...f }) as Family),
    leads: [], facts: [],
  };
}

describe('gazetteer', () => {
  it('knows the places in the tree, most specific first', () => {
    expect((locate('St Augustine, Norwich, Norfolk, England') as any).id).toBe('norwich-st-augustine');
    expect((locate('Norwich, England') as any).id).toBe('norwich');
    expect((locate('Zamość') as any).id).toBe('zamosc');
    expect((locate('Howick Auckland NZ') as any).id).toBe('howick');
    expect((locate('Hamilton, Auckland, New Zealand') as any).id).toBe('hamilton');
    expect((locate('Saint Barnabas, South Kennigtion, Surrey, England') as any).id).toBe('lambeth');
    expect((locate('London Middlesex') as any).id).toBe('london');
  });
  it('treats Alexandra and Pirongia as the one place they are', () => {
    expect((locate('Alexandra, Auckland, New Zealand') as any).id).toBe('pirongia');
    expect((locate('Pirongia, Waipa, Waikato, New Zealand or Alexandra, Auckland, New Zealand ?') as any).id).toBe('pirongia');
  });
  it('ignores occupations that sit in place fields, and admits what it does not know', () => {
    expect(locate('Teacher')).toBe('ignore');
    expect(locate('Mounimental Stonemason')).toBe('ignore');
    expect(locate('Atlantis')).toBeNull();
  });
  it('has every coordinate inside its country', () => {
    for (const p of PLACES) {
      const [s, n, w, e] = COUNTRY_BOX[p.country];
      expect(p.lat > s && p.lat < n && p.lon > w && p.lon < e, `${p.name} at ${p.lat}, ${p.lon}`).toBe(true);
    }
  });
  it('has a real town behind every parish, suburb and cemetery', () => {
    for (const p of PLACES) if (p.town) { expect(place(p.town).prec).toBe('town'); expect(km([p.lon, p.lat], [place(p.town).lon, place(p.town).lat])).toBeLessThan(15); }
  });
  it('names no street', () => {
    for (const p of PLACES) expect(p.name).not.toMatch(/\d|street|\bave\b|road/i);
  });
  it('maps every place string in the published tree', () => {
    expect(unmapped).toEqual([]);
  });
});

describe('geometry', () => {
  it('measures the Earth', () => {
    expect(km([1.297, 52.63], [174.763, -36.848])).toBeGreaterThan(18000);
    expect(km([1.297, 52.63], [1.297, 52.63])).toBe(0);
    const mid = slerp([0, 0], [90, 0], 0.5);
    expect(mid[0]).toBeCloseTo(45); expect(mid[1]).toBeCloseTo(0);
  });
  it('draws short moves straight and voyages along the route of their era', () => {
    const norwich: [number, number] = [1.297, 52.63], howick: [number, number] = [174.932, -36.894], london: [number, number] = [-0.128, 51.507];
    expect(route(norwich, london, 1800).kind).toBe('direct');
    expect(route(norwich, howick, 1855).kind).toBe('cape');
    expect(route(norwich, howick, 1874).kind).toBe('suez');
    expect(route(howick, norwich, 1860).kind).toBe('horn');
    const r = route(norwich, howick, 1855);
    expect(r.pts[0]).toEqual(norwich); expect(r.pts[r.pts.length - 1]).toEqual(howick);
    const d = densify(r.pts);
    expect(d.total).toBeGreaterThan(20000); expect(d.total).toBeLessThan(32000);
    for (let i = 1; i < d.pts.length; i++) expect(km(d.pts[i - 1], d.pts[i])).toBeLessThan(151);
  });
});

describe('journeys', () => {
  const person = (stops: AtlasPerson['stops']): AtlasPerson => ({ id: 'x', stops });
  it('folds stops in one place into one stay, and a town into its parish', () => {
    const st = staysOf(person([{ y: 1776, p: 'norwich', kind: 'birth', why: 'born' }, { y: 1776, p: 'norwich-st-simon', kind: 'baptism', why: 'baptised' }, { y: 1801, p: 'shipdham', kind: 'marriage', why: 'married' }]), place);
    expect(st.map((s) => s.p)).toEqual(['norwich-st-simon', 'shipdham']);
    expect(st[0]).toMatchObject({ from: 1776, to: 1776 });
  });
  it('sails when the window is short', () => {
    const st = staysOf(person([{ y: 1848, p: 'lambeth', kind: 'birth', why: 'born' }, { y: 1872, p: 'lambeth', kind: 'census', why: 'census' }, { y: 1874, p: 'christchurch', kind: 'child', why: 'birth of Agnes' }]), place);
    const leg = legsOf(st, place)[0];
    expect(leg).toMatchObject({ y0: 1872, y1: 1874, sail: true });
    expect(whereAt(st, 1860)).toEqual({ a: 'lambeth' });
    expect(whereAt(st, 1873)).toMatchObject({ a: 'lambeth', b: 'christchurch', t: 0.5, sail: true });
    expect(whereAt(st, 1880)).toEqual({ a: 'christchurch' });
  });
  it('does not pretend to know when a long window is all there is', () => {
    const st = staysOf(person([{ y: 1823, p: 'sproughton', kind: 'birth', why: 'born' }, { y: 1855, p: 'howick', kind: 'child', why: 'birth of George' }]), place);
    expect(legsOf(st, place)[0].sail).toBe(false);
    expect(1855 - 1823).toBeGreaterThan(SAIL_MAX);
    const w = whereAt(st, 1839)!;
    expect(w).toMatchObject({ a: 'sproughton', b: 'howick', sail: false });
    expect(w.t).toBeCloseTo(0.5);
    expect(mostLikely(st, 1830)).toBe('sproughton');
    expect(mostLikely(st, 1850)).toBe('howick');
  });
  it('keeps birth first and death last whatever the years say', () => {
    const st = staysOf(person([{ y: 1639, p: 'mucklestone', kind: 'birth', why: 'born' }, { y: 1638, p: 'mucklestone', kind: 'baptism', why: 'baptised' }, { y: 1709, p: 'norwich', kind: 'death', why: 'died' }, { y: 1654, p: 'norwich', kind: 'child', why: 'birth of Noah' }]), place);
    expect(st.map((s) => s.p)).toEqual(['mucklestone', 'norwich']);
    expect(st[0].to).toBeLessThanOrEqual(st[1].from);
  });
});

describe('placing people', () => {
  it('puts both parents where a child was born, and credits the child', () => {
    const r = tiny([
      { id: 'pa', name: 'Tom Finch', given: 'Tom', sex: 'M', b: { y: 1823, text: '', place: 'Sproughton, Suffolk, England' }, d: { y: 1892, text: '' }, fams: ['f'] },
      { id: 'ma', name: 'Ann Finch', given: 'Ann', sex: 'F', b: { y: 1830, text: '' }, d: { y: 1890, text: '' }, fams: ['f'] },
      { id: 'kid', name: 'George Finch', given: 'George', sex: 'M', b: { y: 1855, text: '', place: 'Howick, Auckland, New Zealand' }, d: { y: 1920, text: '' }, parents: 'f' },
    ], [{ id: 'f', partners: ['pa', 'ma'], children: ['kid'] }]);
    const a = buildAtlas(r).atlas;
    const ma = a.people.find((p) => p.id === 'ma')!;
    expect(ma.borrowed).toBeUndefined();
    expect(ma.stops).toEqual([{ y: 1855, p: 'howick', kind: 'child', why: 'birth of George' }]);
    expect(a.people.find((p) => p.id === 'pa')!.stops.map((s) => s.p)).toEqual(['sproughton', 'howick']);
  });
  it('lends a place from a close relative and says so; never invents one', () => {
    const r = tiny([
      { id: 'ma', name: 'Ann Finch', given: 'Ann', sex: 'F', b: { y: 1800, text: '', place: 'St Augustine, Norwich, Norfolk, England' }, d: { y: 1870, text: '' }, fams: ['f'] },
      { id: 'kid', name: 'Jo Finch', given: 'Jo', sex: 'F', b: { y: 1825, text: '' }, d: { y: 1890, text: '' }, parents: 'f' },
      { id: 'stranger', name: 'No One', given: 'No', sex: 'M', b: { y: 1825, text: '' }, d: { y: 1890, text: '' } },
    ], [{ id: 'f', partners: ['ma'], children: ['kid'] }]);
    const a = buildAtlas(r).atlas;
    const kid = a.people.find((p) => p.id === 'kid')!;
    expect(kid.borrowed).toEqual({ from: 'ma', how: 'parent' });
    // lent to the town, not the parish: the parish is the mother's, not known to be the child's
    expect(kid.stops).toEqual([{ y: 1825, p: 'norwich', kind: 'borrowed', why: 'no place recorded: shown with her mother, Ann Finch', est: true }]);
    expect(a.unplaced).toEqual(['stranger']);
  });
  it('sets a vague stop aside when a closer one covers it', () => {
    const r = tiny([{ id: 'a', name: 'A B', b: { y: 1880, text: '', place: 'New Zealand' }, d: { y: 1940, text: '', place: 'Wellington, New Zealand' } },
      { id: 'b', name: 'C D', b: { y: 1874, text: '', place: 'England' }, d: { y: 1940, text: '', place: 'Napier, New Zealand' } }]);
    const a = buildAtlas(r).atlas;
    expect(a.people[0].stops[0]).toMatchObject({ p: 'new-zealand', coarse: true });
    expect(staysOf(a.people[0], place).map((s) => s.p)).toEqual(['wellington']);
    expect(staysOf(a.people[1], place).map((s) => s.p)).toEqual(['england', 'napier']);
  });
  it('shows only the town for anyone who died in living memory', () => {
    const r = tiny([{ id: 'old', name: 'A B', b: { y: 1848, text: '' }, d: { y: 1912, text: '', place: 'Linwood, Christchurch, New Zealand' } },
      { id: 'new', name: 'C D', b: { y: 1874, text: '' }, d: { y: 1957, text: '', place: '29 Fairfield Ave, Christchurch, New Zealand' } },
      { id: 'new2', name: 'E F', b: { y: 1900, text: '' }, d: { y: 1970, text: '', place: 'Linwood, Christchurch, New Zealand' } }]);
    const a = buildAtlas(r).atlas;
    expect(a.people.map((p) => p.stops[0].p)).toEqual(['linwood', 'christchurch', 'christchurch']);
  });
  it('marks a move that rests on a disputed identity', () => {
    const francis = atlas.people.find((p) => p.id === 'I900104')!;
    const leg = legsOf(staysOf(francis, place), place)[0];
    expect(leg).toMatchObject({ a: 'mucklestone', y1: 1654 });
    expect(leg.doubt).toMatch(/Mucklestone/);
    expect(atlas.leads.some((l) => l.kind === 'doubt' && l.people.includes('I900104'))).toBe(true);
  });
});

describe('the published atlas', () => {
  const file: typeof atlas = JSON.parse(readFileSync('public/data/atlas.json', 'utf8'));
  it('is what the pipeline builds from the published river', () => {
    expect(file).toEqual(JSON.parse(JSON.stringify(atlas)));
  });
  it('accounts for every deceased person exactly once', () => {
    const c = file.meta.counts;
    expect(c.recorded + c.borrowed + c.unplaced).toBe(c.deceased);
    expect(c.deceased).toBe(river.people.filter((p) => !p.living).length);
    expect(new Set([...file.people.map((p) => p.id), ...file.unplaced]).size).toBe(c.deceased);
  });
  it('holds no living person, anywhere', () => {
    const living = river.people.filter((p) => p.living).map((p) => p.id);
    expect(living.length).toBeGreaterThan(50);
    const text = JSON.stringify(file);
    for (const id of living) expect(text.includes(`"${id}"`), id).toBe(false);
    for (const a of file.people) expect(P.get(a.id)!.living).toBe(false);
    for (const l of [...file.facts, ...file.leads]) for (const id of l.people) expect(P.get(id)!.living).toBe(false);
  });
  it('holds no raw place string, street, or number', () => {
    const names = new Set(PLACES.map((p) => p.name));
    for (const p of file.places) expect(names.has(p.name)).toBe(true);
    expect(JSON.stringify(file)).not.toMatch(/Fairfield|Chapel Street|Molesworth|Cemetar|\b16 The/);
  });
  it('shows the recently dead to the town only', () => {
    for (const a of file.people) {
      const p = P.get(a.id)!;
      if (p.d!.est ? p.b!.y < TOWN_ONLY_FROM - 70 : p.d!.y < TOWN_ONLY_FROM) continue;
      for (const s of a.stops) expect(place(s.p).town, `${a.id} ${s.p}`).toBeUndefined();
    }
  });
  it('has a reason for every light', () => {
    for (const a of file.people) {
      expect(a.stops.length).toBeGreaterThan(0);
      for (const s of a.stops) { expect(s.why.length).toBeGreaterThan(2); expect(PLACE.has(s.p)).toBe(true); }
      if (a.borrowed) { expect(a.stops).toHaveLength(1); expect(a.stops[0].kind).toBe('borrowed'); expect(P.get(a.borrowed.from)!.living).toBe(false); }
      else expect(a.stops.some((s) => s.kind !== 'borrowed')).toBe(true);
    }
  });
  it('names no one in a reason who is not deceased and named in the river', () => {
    const deadNames = new Set(river.people.filter((p) => !p.living).flatMap((p) => [p.name!, (p.given ?? p.name!).split(' ')[0]]));
    for (const a of file.people) for (const s of a.stops) {
      const m = /(?:of|with (?:her|his|their) \w+,|married) (.+)$/.exec(s.why);
      if (m) expect(deadNames.has(m[1]), s.why).toBe(true);
    }
  });
  it('finds the first crossing and the move in doubt', () => {
    expect(file.facts.find((f) => f.id === 'a-first-crossing')!.y).toBe(1855);
    expect(file.facts.length).toBeGreaterThanOrEqual(5);
    expect(file.leads.length).toBeGreaterThanOrEqual(2);
  });
  it.skipIf(!existsSync('data/raw/iris-export.json'))('names no living person from the raw export', async () => {
    const { livingNeedles } = await import('../pipeline/build.ts');
    const raw = JSON.parse(readFileSync('data/raw/iris-export.json', 'utf8'));
    const people = raw.elements.filter((e: any) => e.element_type === 'object' && e.data?.type !== 'model' && !['Family', 'Source'].includes(e.data?.classifier));
    const shownIris = new Set(river.people.filter((p) => !p.living).map((p) => p.iris));
    const dead = new Set<string>(people.filter((e: any) => shownIris.has(e.id)).map((e: any) => e.id));
    const needles = livingNeedles(people, dead);
    expect(needles.length).toBeGreaterThan(50);
    const hay = JSON.stringify(file).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase();
    expect(needles.filter((n) => hay.includes(n))).toEqual([]);
  });
});
