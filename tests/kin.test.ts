import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ageBetween, chain, kinTerm, kinship, lifeLines, namesakes, restsOn } from '../src/model/kin.ts';
import type { Family, Person, RiverData } from '../src/model/types.ts';

describe('kinTerm', () => {
  it('names direct lines', () => {
    expect(kinTerm(0, 1, 'M')).toBe('father');
    expect(kinTerm(0, 2, 'F')).toBe('grandmother');
    expect(kinTerm(0, 7, 'M')).toBe('5× great-grandfather');
    expect(kinTerm(1, 0, 'F')).toBe('daughter');
    expect(kinTerm(3, 0)).toBe('great-grandchild');
  });
  it('names siblings, uncles and nieces', () => {
    expect(kinTerm(1, 1, 'M')).toBe('brother');
    expect(kinTerm(1, 1, 'F', true)).toBe('half-sister');
    expect(kinTerm(1, 2, 'M')).toBe('uncle');
    expect(kinTerm(1, 3, 'F')).toBe('great-aunt');
    expect(kinTerm(2, 1, 'F')).toBe('niece');
    expect(kinTerm(4, 1, 'M')).toBe('2× great-nephew');
  });
  it('names cousins', () => {
    expect(kinTerm(2, 2)).toBe('1st cousin');
    expect(kinTerm(3, 3)).toBe('2nd cousin');
    expect(kinTerm(2, 3)).toBe('1st cousin once removed');
    expect(kinTerm(4, 2)).toBe('1st cousin twice removed');
    expect(kinTerm(5, 4)).toBe('3rd cousin once removed');
  });
});

// a small invented family: G1+G2 -> A, B ; A+X -> C ; B+Y -> D ; C+Z -> E
const mk = (id: string, sex: 'M' | 'F', b: number, d?: number, extra: Partial<Person> = {}): Person => ({ id, living: false, fams: [], name: id, given: id, surname: 'Test', sex, b: { y: b, text: String(b) }, d: d ? { y: d, text: String(d) } : { y: b + 70, text: '', est: true }, ...extra });
const people: Person[] = [mk('G1', 'M', 1700, 1760), mk('G2', 'F', 1702, 1733), mk('A', 'M', 1725, 1790), mk('B', 'F', 1730, 1733), mk('X', 'F', 1727, 1770), mk('C', 'F', 1750), mk('Y', 'M', 1728), mk('D', 'M', 1752), mk('Z', 'M', 1748), mk('E', 'F', 1775), mk('Q', 'M', 1800)];
const families: Family[] = [
  { id: 'F1', partners: ['G1', 'G2'], children: ['A', 'B'], estY: 1724, m: { y: 1724, text: '1724' } },
  { id: 'F2', partners: ['A', 'X'], children: ['C'], estY: 1749, m: { y: 1749, text: '1749' } },
  { id: 'F3', partners: ['Y', 'B'], children: ['D'], estY: 1751 },
  { id: 'F4', partners: ['Z', 'C'], children: ['E'], estY: 1774 },
];
const P = new Map(people.map((p) => [p.id, p]));
for (const f of families) { for (const id of f.partners) P.get(id)!.fams.push(f.id); for (const id of f.children) P.get(id)!.parents = f.id; }
const t = { P, F: new Map(families.map((f) => [f.id, f])) };

describe('kinship', () => {
  it('finds blood relationships and the ancestors shared', () => {
    expect(kinship(t, 'G1', 'E').term).toBe('great-grandfather');
    expect(kinship(t, 'A', 'B').term).toBe('brother');
    expect(kinship(t, 'C', 'D')).toMatchObject({ term: '1st cousin', common: expect.arrayContaining(['G1', 'G2']) });
    expect(kinship(t, 'E', 'D').term).toBe('1st cousin once removed');
    expect(kinship(t, 'B', 'C').term).toBe('aunt');
    expect(kinship(t, 'C', 'D').path).toEqual(expect.arrayContaining(['C', 'A', 'G1', 'G2', 'B', 'D']));
  });
  it('falls back to marriage, then to nothing', () => {
    expect(kinship(t, 'X', 'A').byMarriage).toBe('wife');
    expect(kinship(t, 'X', 'B').byMarriage).toMatch(/married to A, who is the brother of/);
    expect(kinship(t, 'D', 'X').byMarriage).toMatch(/the nephew of A, who married/);
    const none = kinship(t, 'Q', 'A');
    expect(none.term).toBeNull();
    expect(none.byMarriage).toBeUndefined();
  });
});

describe('chain', () => {
  it('walks parent, child and marriage steps between people with no shared blood', () => {
    expect(chain(t, 'Y', 'Z')).toEqual([{ id: 'B', how: 'married' }, { id: 'G1', how: 'child of' }, { id: 'A', how: 'parent of' }, { id: 'C', how: 'parent of' }, { id: 'Z', how: 'married' }]);
    expect(chain(t, 'Q', 'A')).toBeNull();
  });
});

describe('ageBetween', () => {
  const d = (text: string, approx = false) => ({ y: Number(/\d{4}/.exec(text)![0]), text, ...(approx ? { approx } : {}) });
  it('counts birthdays, not calendar years', () => {
    expect(ageBetween(d('13 Oct 1776'), d('10 May 1812'))).toBe('35');
    expect(ageBetween(d('10 Dec 1821'), d('Jun 1843'))).toBe('21');
    expect(ageBetween(d('1 Jun 1814'), d('1 Jun 1855'))).toBe('41');
    expect(ageBetween(d('2 Jun 1814'), d('1 Jun 1855'))).toBe('40');
    expect(ageBetween(d('5 Mar 1800'), d('Nov 1830'))).toBe('30');
  });
  it('says so when the dates cannot settle it', () => {
    expect(ageBetween(d('1800'), d('1830'))).toBe('29 or 30');
    expect(ageBetween(d('Mar 1800'), d('12 Mar 1830'))).toBe('29 or 30');
    expect(ageBetween(d('c. 1800', true), d('4 May 1830'))).toBe('about 30');
  });
});

describe('birth order', () => {
  const mkd = (id: string, text: string, living = false): Person => ({ id, living, fams: [], parents: 'FX', name: id, b: { y: Number(/\d{4}/.exec(text)![0]), text }, d: { y: 1990, text: '1990' } } as Person);
  const tree = (kids: Person[]) => ({ P: new Map(kids.map((k) => [k.id, k])), F: new Map([['FX', { id: 'FX', partners: [], children: kids.map((k) => k.id) } as unknown as Family]]) });
  it('is read from the dates, not from the order the children are listed in', () => {
    const kids = [mkd('late', '21 Jul 1910'), mkd('first', '1902'), mkd('mid', '1905')];
    const tr = tree(kids);
    expect(lifeLines(tr, kids[0]).join(' ')).toMatch(/youngest of 3/);
    expect(lifeLines(tr, kids[1]).join(' ')).toMatch(/eldest of 3/);
  });
  it('says nothing when two bare years tie', () => {
    const kids = [mkd('a', '1902'), mkd('b', '1902')];
    expect(lifeLines(tree(kids), kids[0]).join(' ')).not.toMatch(/elder|younger/);
  });
});

describe('lifeLines', () => {
  it('tells a life from the family around it', () => {
    const a = lifeLines(t, P.get('A')!).join(' ');
    expect(a).toMatch(/elder of two children/);
    expect(a).toMatch(/Lost a mother at about 8/);
    // bare years cannot say which side of a birthday: the age is given as either
    expect(a).toMatch(/Married at 23 or 24/);
    expect(a).toMatch(/One child on record, at 24 or 25/);
    expect(a).toMatch(/Outlived X by 19 or 20 years/);
    expect(lifeLines(t, P.get('B')!).join(' ')).toMatch(/Died in early childhood/);
    expect(lifeLines(t, P.get('G1')!).join(' ')).toMatch(/Buried a child who did not reach 21/);
  });
  it('says nothing about the living', () => {
    expect(lifeLines(t, { id: 'L', living: true, fams: [] })).toEqual([]);
  });
});

describe('on the real tree', () => {
  const data: RiverData = JSON.parse(readFileSync('public/data/river.json', 'utf8'));
  const real = { P: new Map(data.people.map((p) => [p.id, p])), F: new Map(data.families.map((f) => [f.id, f])) };
  it('finds the Peter Barlows', () => {
    expect(namesakes(real, real.P.get('I11')!).length).toBeGreaterThanOrEqual(5);
  });
  it('counts what rests on the disputed link', () => {
    const r = restsOn(real, 'I900104');
    expect(r.ids.sort()).toEqual(['I900106', 'I900107']);
  });
  it('never puts a living name in a sentence', () => {
    for (const p of data.people) for (const s of lifeLines(real, p)) expect(s).not.toMatch(/undefined|living/);
  });
});
