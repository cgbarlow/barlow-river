import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseDate } from '../pipeline/dates.ts';
import { regionOf } from '../pipeline/places.ts';
import { buildRiver, livingNeedles } from '../pipeline/build.ts';
import { fixture } from './fixture.ts';

describe('dates', () => {
  it('reads plain GEDCOM dates', () => {
    expect(parseDate('4 APR 1736')).toEqual({ year: 1736, text: '4 Apr 1736', approx: false });
    expect(parseDate('1871')).toEqual({ year: 1871, text: '1871', approx: false });
    expect(parseDate('22 Apr 1706')?.text).toBe('22 Apr 1706');
  });
  it('reads Old Style dual years as the later year', () => {
    expect(parseDate('21 MAR 1649/50')).toEqual({ year: 1650, text: '21 Mar 1649/50', approx: false });
  });
  it('keeps qualifiers', () => {
    expect(parseDate('ABT JUN 1979')).toEqual({ year: 1979, text: 'c. Jun 1979', approx: true });
    expect(parseDate('AFT 1808')?.text).toBe('after 1808');
  });
  it('returns null for nothing', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('unknown')).toBeNull();
  });
});

describe('places', () => {
  it('groups free text into regions', () => {
    expect(regionOf('St Augustine, Norwich, Norfolk, England')).toBe('Norfolk');
    expect(regionOf('Pirongia, Auckland, N.Z.')).toBe('New Zealand');
    expect(regionOf('Zamość')).toBe('Poland');
    expect(regionOf('Mucklestone, Staffordshire, England')).toBe('Staffordshire');
    expect(regionOf('Woolwich, Kent, England')).toBe('Kent');
    expect(regionOf('New York')).toBe('Elsewhere');
    expect(regionOf('')).toBeNull();
  });
});

describe('privacy', () => {
  const river = buildRiver(structuredClone(fixture));
  const byName = (n: string) => river.people.find((p) => p.name === n);
  const json = JSON.stringify(river);

  it('gives living people nothing but links and a structural year', () => {
    const living = river.people.filter((p) => p.living);
    expect(living).toHaveLength(3);
    for (const p of living) expect(Object.keys(p).sort()).toEqual(expect.arrayContaining(['estY', 'fams', 'id', 'living']));
    for (const p of living) expect(Object.keys(p).every((k) => ['id', 'living', 'fams', 'parents', 'estY'].includes(k))).toBe(true);
  });
  it('never ships a living name, date, place, photo or original id', () => {
    for (const s of ['Zed', 'Eve Stone', 'Flagless', '1982', 'Auckland', 'example.com', '"I5"', '"I6"', 'el-I5']) expect(json).not.toContain(s);
  });
  it('treats a missing flag as living unless a date settles it', () => {
    expect(byName('Flagless Modern')).toBeUndefined();
    expect(byName('Old Hugh')?.b?.y).toBe(1613);
  });
  it('drops notes that name a living person, by full or first name, and keeps the rest', () => {
    expect(byName('Abel Stone')?.notes).toEqual(['A plain note.']);
  });
  it('ships free text only for people of an older era', () => {
    const dora = byName('Dora Stone')!;
    expect(dora.notes).toBeUndefined();
    expect(dora.desc).toBeUndefined();
    expect(dora.cites).toEqual([{ source: 'A census' }]);
    expect(byName('Abel Stone')?.desc).toBe('An old description.');
  });
  it('hides marriage details when a partner is living', () => {
    expect(river.families.find((f) => f.id === 'F3')?.m).toBeUndefined();
    expect(river.families.find((f) => f.id === 'F2')?.m?.y).toBe(1940);
    expect(json).not.toContain('Wellington');
  });
  it('places the living from their relatives, not their own record', () => {
    const zed = river.people.find((p) => p.living && p.parents === 'F2')!;
    expect(zed.estY).not.toBe(1982);
  });
  it('does not treat a name shared with a dead ancestor as a living name', () => {
    const els = [{ id: 'a', data: { full_name: 'Hugh Barlow', given_names: 'Hugh', surname: 'Barlow' } }, { id: 'b', data: { full_name: 'Hugh Barlow', given_names: 'Hugh', surname: 'Barlow' } }];
    expect(livingNeedles(els, new Set(['a']))).toEqual([]);
    expect(livingNeedles(els, new Set())).toEqual(['hugh barlow']);
  });
});

describe('certainty', () => {
  const river = buildRiver(structuredClone(fixture));
  const byName = (n: string) => river.people.find((p) => p.name === n)!;
  it('reads a disputed edge label from the diagrams', () => {
    expect(byName('Cain Stone').tier).toBe('disputed');
  });
  it('separates a cited record from a compiled tree from nothing', () => {
    expect(byName('Abel Stone').sourced).toBe('record');
    expect(byName('Cain Stone').sourced).toBe('compiled');
    expect(byName('Beth Lark').sourced).toBe('none');
  });
  it('estimates missing years and says so', () => {
    expect(byName('Beth Lark').b?.est).toBe(true);
    expect(byName('Cain Stone').b).toMatchObject({ y: 1650, text: '21 Mar 1649/50' });
  });
});

describe('leads', () => {
  it('does not treat "after 1700" as a death date', () => {
    const river = buildRiver(structuredClone(fixture));
    expect(river.leads.filter((l) => l.kind === 'after-death')).toEqual([]);
  });
  it('flags a parent who would have been a child', () => {
    const f = structuredClone(fixture);
    (f.elements[0].data as Record<string, unknown>).birth = { date: '1640' };
    const river = buildRiver(f);
    expect(river.leads.some((l) => l.kind === 'young-parent' && /would have been 10/.test(l.title))).toBe(true);
  });
});

// The committed data file must hold up too.
describe('public/data/river.json', () => {
  const river = JSON.parse(readFileSync('public/data/river.json', 'utf8'));
  it('has no personal field on any living person', () => {
    for (const p of river.people) if (p.living) expect(Object.keys(p).every((k) => ['id', 'living', 'fams', 'parents', 'estY'].includes(k))).toBe(true);
  });
  it('holds no email address', () => {
    expect(JSON.stringify(river)).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
  // Runs only where the raw export is present (it is never committed).
  it.skipIf(!existsSync('data/raw/iris-export.json'))('names no living person anywhere', () => {
    const raw = JSON.parse(readFileSync('data/raw/iris-export.json', 'utf8'));
    const people = raw.elements.filter((e: any) => e.element_type === 'object' && e.data?.type !== 'model' && !['Family', 'Source'].includes(e.data?.classifier));
    const shownIris = new Set(river.people.filter((p: any) => !p.living).map((p: any) => p.iris));
    const dead = new Set<string>(people.filter((e: any) => shownIris.has(e.id)).map((e: any) => e.id));
    const needles = livingNeedles(people, dead);
    expect(needles.length).toBeGreaterThan(50);
    const hay = JSON.stringify(river).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase();
    expect(needles.filter((n) => hay.includes(n))).toEqual([]);
  });
});

describe('facts', () => {
  const river = JSON.parse(readFileSync('public/data/river.json', 'utf8'));
  const P = new Map<string, any>(river.people.map((p: any) => [p.id, p]));
  it('are computed, and name only the dead', () => {
    expect(river.facts.length).toBeGreaterThanOrEqual(5);
    for (const f of river.facts) for (const id of f.people) expect(P.get(id).living).toBe(false);
  });
  it('leads that light living people show them only as unnamed markers', () => {
    for (const l of river.leads) for (const id of l.people) if (P.get(id).living) expect(P.get(id).name).toBeUndefined();
  });
});
