// Facts: what the tree shows when you count. Recorded dates only, the dead only.

import { regionOf } from './places.ts';
import type { Family, Lead, Person } from '../src/model/types.ts';

const rec = (p: Person, k: 'b' | 'd') => (!p.living && p[k] && !p[k]!.est && !/^(after|before)/.test(p[k]!.text) ? p[k]! : undefined);

export function findFacts(people: Person[], families: Family[], thisYear: number): Lead[] {
  const P = new Map(people.map((p) => [p.id, p]));
  const dead = people.filter((p) => !p.living);
  const facts: Lead[] = [];
  const add = (key: string, title: string, body: string, ps: Person[], y: number) =>
    facts.push({ id: 'fact:' + key, kind: 'fact', title, body, people: ps.map((p) => p.id), y });

  // the first of the family recorded in a new country
  const firstIn = (region: string) => dead.filter((p) => rec(p, 'b') && p.b!.place && regionOf(p.b!.place) === region).sort((a, b) => a.b!.y - b.b!.y)[0];
  const nz = firstIn('New Zealand');
  if (nz) {
    const f = nz.parents ? families.find((x) => x.id === nz.parents) : undefined;
    const from = f?.partners.map((id) => P.get(id)!).filter((q) => !q.living && q.region && q.region !== 'New Zealand' && !q.regionInferred).map((q) => q.region)[0];
    add('first-nz', `The river reaches New Zealand in ${nz.b!.y}`,
      `${nz.name} is the first person in the tree recorded as born in New Zealand, in ${nz.b!.place!.split(',')[0]}${from ? `. A parent was born in ${from}` : ''}. Switch to the place lens and play from 1800 to watch the colour change.`, [nz], nz.b!.y);
  }

  // earliest dated record
  const oldest = dead.filter((p) => rec(p, 'b') && !p.b!.approx).sort((a, b) => a.b!.y - b.b!.y)[0];
  if (oldest) add('earliest', `The oldest dated record is from ${oldest.b!.y}`,
    `${oldest.name}, ${oldest.b!.kind === 'bap' ? 'baptised' : 'born'} ${oldest.b!.text}${oldest.b!.place ? ' at ' + oldest.b!.place.split(',')[0] : ''}. Everything earlier in the tree is an estimate.`, [oldest], oldest.b!.y);

  // largest family
  const big = families.filter((f) => f.partners.length && f.partners.every((id) => !P.get(id)!.living)).sort((a, b) => b.children.length - a.children.length)[0];
  if (big && big.children.length >= 6) {
    const ps = big.partners.map((id) => P.get(id)!);
    add('largest', `${big.children.length} children in one family`,
      `${ps.map((p) => p.name).join(' and ')} have the most children recorded of any couple in the tree.`, [...ps, ...big.children.map((id) => P.get(id)!)], Math.min(...ps.map((p) => p.b?.y ?? thisYear)));
  }

  // longest life
  const lived = dead.filter((p) => rec(p, 'b') && rec(p, 'd') && p.d!.y - p.b!.y <= 105).sort((a, b) => (b.d!.y - b.b!.y) - (a.d!.y - a.b!.y))[0];
  if (lived) add('longest', `${lived.name} lived to ${lived.d!.y - lived.b!.y}`,
    `Born ${lived.b!.text}, died ${lived.d!.text}. The longest life in the tree with both dates on record.`, [lived], lived.b!.y);

  // children lost young
  const young = dead.filter((p) => rec(p, 'b') && rec(p, 'd') && p.d!.y - p.b!.y <= 5 && p.d!.y >= p.b!.y);
  if (young.length >= 3) {
    const before1800 = young.filter((p) => p.b!.y < 1800).length;
    add('young', `${young.length} children did not reach six`,
      `These are the ones with both dates recorded. ${before1800} were born before 1800. The real number is higher: children who died young are the people most often missing from a tree.`, young, Math.min(...young.map((p) => p.b!.y)));
  }

  // most common names
  const tally = new Map<string, Person[]>();
  for (const p of dead) { const g = (p.given ?? p.name ?? '').replace(/\(.*?\)/g, '').trim().split(' ')[0]; if (g.length > 1) tally.set(g, [...(tally.get(g) ?? []), p]); }
  const top = [...tally].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  if (top.length === 3 && top[0][1].length >= 5) add('names', `${top[0][1].length} people are called ${top[0][0]}`,
    `The most used first names in the tree are ${top.map(([n, ps]) => `${n} (${ps.length})`).join(', ')}.`, top[0][1], Math.min(...top[0][1].map((p) => p.b?.y ?? thisYear)));

  // how well the tree is sourced, in one line
  const n = dead.length, r = dead.filter((p) => p.sourced === 'record').length, c = dead.filter((p) => p.sourced === 'compiled').length;
  add('sourcing', `${Math.round((r / n) * 100)}% of people cite a record`,
    `Of ${n} people shown, ${r} cite a parish register, will, census or similar. ${c} rest only on someone else's tree. ${n - r - c} cite nothing. Switch to the certainty lens to see where each kind sits.`, dead.filter((p) => p.sourced === 'record'), Math.min(...dead.map((p) => p.b?.y ?? thisYear)));

  return facts;
}
