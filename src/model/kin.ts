// Things worked out about a person from the people around them: how two people
// are related, a life told in a few plain sentences, who shares a name, and
// what rests on a link. Recorded dates only. The living are counted, never named.

import type { Family, Person } from './types.ts';

export interface Tree { P: Map<string, Person>; F: Map<string, Family> }

const rec = (p: Person | undefined, k: 'b' | 'd') => (p && !p.living && p[k] && !p[k]!.est && !/^(after|before)/.test(p[k]!.text) ? p[k]! : undefined);
const parentsOf = (t: Tree, id: string): string[] => { const f = t.P.get(id)?.parents; return f ? t.F.get(f)?.partners ?? [] : []; };

/** Every ancestor of a person with how many generations up, self included at 0. */
export function ancestorDepths(t: Tree, id: string): Map<string, number> {
  const out = new Map<string, number>([[id, 0]]);
  let frontier = [id];
  for (let d = 1; frontier.length && d < 60; d++) {
    const next: string[] = [];
    for (const x of frontier) for (const p of parentsOf(t, x)) if (!out.has(p)) { out.set(p, d); next.push(p); }
    frontier = next;
  }
  return out;
}

const ord = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
const greats = (n: number) => (n <= 0 ? '' : n === 1 ? 'great-' : `${n}× great-`);
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** The word for what A is to B, given the generations from each up to the ancestor they share. */
export function kinTerm(da: number, db: number, sex?: string, half = false): string {
  const w = (m: string, f: string, n: string) => (sex === 'M' ? m : sex === 'F' ? f : n);
  if (da === 0 && db === 0) return 'the same person';
  if (da === 0) return db === 1 ? w('father', 'mother', 'parent') : db === 2 ? w('grandfather', 'grandmother', 'grandparent') : greats(db - 2) + w('grandfather', 'grandmother', 'grandparent');
  if (db === 0) return da === 1 ? w('son', 'daughter', 'child') : da === 2 ? w('grandson', 'granddaughter', 'grandchild') : greats(da - 2) + w('grandson', 'granddaughter', 'grandchild');
  if (da === 1 && db === 1) return (half ? 'half-' : '') + w('brother', 'sister', 'sibling');
  if (da === 1) return (db === 2 ? '' : db === 3 ? 'great-' : `${db - 2}× great-`) + w('uncle', 'aunt', 'uncle or aunt');
  if (db === 1) return (da === 2 ? '' : da === 3 ? 'great-' : `${da - 2}× great-`) + w('nephew', 'niece', 'nephew or niece');
  const degree = Math.min(da, db) - 1, removed = Math.abs(da - db);
  return `${ord(degree)} cousin${removed ? ` ${times(removed)} removed` : ''}`;
}

export interface Kinship {
  /** "the 2nd cousin once removed of" style phrase, or null when there is no blood link */
  term: string | null;
  /** the ancestors they share (the nearest ones) */
  common: string[];
  /** everyone on the two lines down from the shared ancestors, for lighting */
  path: string[];
  /** how they are connected when not by blood */
  byMarriage?: string;
}

function lineTo(t: Tree, from: string, to: string): string[] {
  // the chain of people from `from` up to ancestor `to`
  const prev = new Map<string, string>();
  let frontier = [from];
  const seen = new Set([from]);
  while (frontier.length && !seen.has(to)) {
    const next: string[] = [];
    for (const x of frontier) for (const p of parentsOf(t, x)) if (!seen.has(p)) { seen.add(p); prev.set(p, x); next.push(p); }
    frontier = next;
  }
  const out = [to];
  for (let x = to; prev.has(x);) { x = prev.get(x)!; out.push(x); }
  return out;
}

export function kinship(t: Tree, a: string, b: string, viaMarriage = true): Kinship {
  if (a === b) return { term: 'the same person', common: [a], path: [a] };
  const A = ancestorDepths(t, a), B = ancestorDepths(t, b);
  let best = Infinity;
  let common: string[] = [];
  for (const [id, da] of A) {
    const db = B.get(id);
    if (db === undefined) continue;
    const sum = da + db;
    if (sum < best) { best = sum; common = [id]; } else if (sum === best) common.push(id);
  }
  if (common.length) {
    const da = A.get(common[0])!, db = B.get(common[0])!;
    const half = da === 1 && db === 1 && common.length === 1 && parentsOf(t, a).length + parentsOf(t, b).length > 2;
    const path = new Set<string>();
    for (const c of common) { for (const x of lineTo(t, a, c)) path.add(x); for (const x of lineTo(t, b, c)) path.add(x); }
    return { term: kinTerm(da, db, t.P.get(a)?.sex, half), common, path: [...path] };
  }
  if (!viaMarriage) return { term: null, common: [], path: [a, b] };
  // not by blood: try one marriage either side
  const partners = (id: string) => (t.P.get(id)?.fams ?? []).flatMap((f) => t.F.get(f)?.partners ?? []).filter((x) => x !== id);
  if (partners(a).includes(b)) return { term: null, common: [], path: [a, b], byMarriage: t.P.get(a)?.sex === 'M' ? 'husband' : t.P.get(a)?.sex === 'F' ? 'wife' : 'partner' };
  for (const sp of partners(a)) {
    const k = kinship(t, sp, b, false);
    if (k.term) return { term: null, common: k.common, path: [a, ...k.path], byMarriage: `married to ${nameOr(t, sp)}, who is the ${k.term} of` };
  }
  for (const sp of partners(b)) {
    const k = kinship(t, a, sp, false);
    if (k.term) return { term: null, common: k.common, path: [...k.path, b], byMarriage: `the ${k.term} of ${nameOr(t, sp)}, who married` };
  }
  return { term: null, common: [], path: [a, b] };
}
const nameOr = (t: Tree, id: string) => { const p = t.P.get(id); return !p || p.living ? 'a living relative' : p.name!; };

/** A life in a few plain sentences, from the family around the person. */
export function lifeLines(t: Tree, p: Person): string[] {
  if (p.living) return [];
  const out: string[] = [];
  const b = rec(p, 'b'), d = rec(p, 'd');
  const pf = p.parents ? t.F.get(p.parents) : undefined;
  // birth order is only stated among siblings who have all died: it would otherwise place the living
  if (pf && pf.children.length > 1 && pf.children.every((id) => !t.P.get(id)?.living)) {
    const i = pf.children.indexOf(p.id) + 1, n = pf.children.length;
    out.push(n === 2 ? `The ${i === 1 ? 'elder' : 'younger'} of two children on record.` : `The ${i === 1 ? 'eldest' : i === n ? 'youngest' : ord(i)} of ${n} children on record.`);
  }
  if (b && pf) {
    for (const id of pf.partners) {
      const par = t.P.get(id)!;
      const pd = rec(par, 'd');
      if (pd && pd.y >= b.y && pd.y - b.y < 12) { out.push(`Lost ${par.sex === 'M' ? 'a father' : par.sex === 'F' ? 'a mother' : 'a parent'} at about ${pd.y - b.y}.`); break; }
    }
  }
  const fams = p.fams.map((f) => t.F.get(f)!).filter(Boolean);
  const wed = fams.filter((f) => f.m && !f.m.est).sort((x, y) => x.m!.y - y.m!.y);
  if (b && wed.length) out.push(`Married at ${wed[0].m!.y - b.y}${wed.length > 1 ? `, and again at ${wed.slice(1).map((f) => f.m!.y - b.y).join(' and ')}` : ''}.`);
  const kids = fams.flatMap((f) => f.children).map((id) => t.P.get(id)!).filter(Boolean);
  if (kids.length) {
    const dated = kids.map((k) => rec(k, 'b')).filter(Boolean).map((x) => x!.y).sort((x, y) => x - y);
    let s = `${kids.length === 1 ? 'One child' : `${kids.length} children`} on record`;
    if (b && dated.length) {
      const first = dated[0] - b.y, last = dated[dated.length - 1] - b.y;
      if (first >= 12 && first < 80) s += dated.length > 1 && last !== first ? `, the first at ${first} and the last at ${last}` : `, at ${first}`;
    }
    out.push(s + '.');
    if (d) {
      const lost = kids.filter((k) => { const kd = rec(k, 'd'); return kd && kd.y <= d.y && rec(k, 'b') && kd.y - k.b!.y < 21; }).length;
      if (lost) out.push(`Buried ${lost === 1 ? 'a child' : `${lost} children`} who did not reach 21.`);
    }
  }
  if (d) {
    for (const f of fams) {
      const sp = f.partners.map((id) => t.P.get(id)!).find((q) => q && q.id !== p.id && !q.living);
      const sd = sp ? rec(sp, 'd') : undefined;
      if (sp && sd && d.y - sd.y >= 5) { out.push(`Outlived ${sp.name} by ${d.y - sd.y} years.`); break; }
    }
  }
  if (b && d && d.y - b.y >= 0 && d.y - b.y < 6) out.push('Died in early childhood.');
  return out;
}

/** People who carry the same first name and surname. */
export function namesakes(t: Tree, p: Person): Person[] {
  if (p.living || !p.name) return [];
  const key = (q: Person) => `${(q.given ?? q.name ?? '').replace(/\(.*?\)/g, '').trim().split(' ')[0]}|${q.surname ?? ''}`.toLowerCase();
  const k = key(p);
  if (k.startsWith('|') || k.endsWith('|')) return [];
  return [...t.P.values()].filter((q) => !q.living && key(q) === k).sort((x, y) => (x.b?.y ?? 0) - (y.b?.y ?? 0));
}

/** Everyone upstream who is only this family's if the link from this person to their parents is right. */
export function restsOn(t: Tree, id: string): { ids: string[]; earliest?: number } {
  const A = ancestorDepths(t, id);
  A.delete(id);
  const ids = [...A.keys()];
  const years = ids.map((x) => t.P.get(x)!).filter((q) => !q.living && q.b).map((q) => q.b!.y);
  return { ids, earliest: years.length ? Math.min(...years) : undefined };
}

export interface Hop { id: string; how: 'parent of' | 'child of' | 'married' }
/**
 * The shortest way through the tree from one person to another, by any mix of
 * parent, child and marriage. For people who are connected but not by blood.
 */
export function chain(t: Tree, a: string, b: string, max = 14): Hop[] | null {
  const prev = new Map<string, Hop>();
  const seen = new Set([a]);
  let frontier = [a];
  const step = (from: string, to: string, how: Hop['how'], next: string[]) => { if (!seen.has(to) && t.P.has(to)) { seen.add(to); prev.set(to, { id: from, how }); next.push(to); } };
  for (let d = 0; d < max && frontier.length && !seen.has(b); d++) {
    const next: string[] = [];
    for (const x of frontier) {
      const p = t.P.get(x)!;
      for (const par of parentsOf(t, x)) step(x, par, 'child of', next);
      for (const fid of p.fams) {
        const f = t.F.get(fid);
        if (!f) continue;
        for (const sp of f.partners) if (sp !== x) step(x, sp, 'married', next);
        for (const c of f.children) step(x, c, 'parent of', next);
      }
    }
    frontier = next;
  }
  if (!seen.has(b)) return null;
  const out: Hop[] = [];
  for (let x = b; x !== a;) { const h = prev.get(x)!; out.unshift({ id: x, how: h.how }); x = h.id; }
  return out;
}
