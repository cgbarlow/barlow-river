// Leads: things in the tree worth a second look. Found by rule, from recorded
// dates only (never estimates), and only among the dead.

import type { Family, Lead, Person } from '../src/model/types.ts';

const rec = (p: Person | undefined, k: 'b' | 'd') => (p && !p.living && p[k] && !p[k]!.est && !/^(after|before)/.test(p[k]!.text) ? p[k]! : undefined);
const nm = (p: Person) => p.name ?? 'someone';
const first = (p: Person) => (p.given ?? p.name ?? '').split(' ')[0];

export function findLeads(people: Person[], families: Family[], unflagged: string[], thisYear: number): Lead[] {
  const P = new Map(people.map((p) => [p.id, p]));
  const F = new Map(families.map((f) => [f.id, f]));
  const leads: Lead[] = [];
  const add = (kind: string, key: string, title: string, body: string, ps: Person[], y: number) =>
    leads.push({ id: `${kind}:${key}`, kind, title, body, people: ps.map((p) => p.id), y });

  for (const f of families) {
    const partners = f.partners.map((id) => P.get(id)!).filter((p) => !p.living);
    const kids = f.children.map((id) => P.get(id)!).filter((p) => !p.living);

    for (const c of kids) {
      const cb = rec(c, 'b');
      if (!cb) continue;
      for (const par of partners) {
        const pb = rec(par, 'b');
        const pd = rec(par, 'd');
        if (pb) {
          const age = cb.y - pb.y;
          const old = par.sex === 'F' ? 50 : 70;
          if (age < 16) add('young-parent', `${par.id}-${c.id}`, `${nm(par)} would have been ${age}`,
            `${nm(par)} is recorded as born ${pb.text}, and as a parent of ${nm(c)}, born ${cb.text}. That makes a parent aged ${age}. One of the two dates, or the link itself, is probably wrong. Two people of the same name may have been merged.`, [par, c], cb.y);
          else if (age > old) add('old-parent', `${par.id}-${c.id}`, `${nm(par)} a parent at ${age}`,
            `${nm(par)} (born ${pb.text}) is recorded as a parent of ${nm(c)} (born ${cb.text}), at the age of ${age}. Possible, but worth checking for a missing generation or a second person of the same name.`, [par, c], cb.y);
        }
        if (pd && pd.kind !== 'bur' ? cb.y > pd.y + (par.sex === 'F' ? 0 : 1) : pd && cb.y > pd.y + 1) {
          add('after-death', `${par.id}-${c.id}`, `${nm(c)} born after a parent died`,
            `${nm(c)} is recorded as born ${cb.text}. ${nm(par)} is recorded as dying ${pd!.text}. A child cannot arrive that long after. Check both dates and whether this is the right parent.`, [par, c], cb.y);
        }
      }
    }

    // a name given twice in one family
    const seen = new Map<string, Person[]>();
    for (const c of kids) { const g = first(c).toLowerCase(); if (g) seen.set(g, [...(seen.get(g) ?? []), c]); }
    for (const [, group] of seen) {
      if (group.length < 2 || !group.every((c) => rec(c, 'b'))) continue;
      group.sort((a, b) => a.b!.y - b.b!.y);
      const died = group.slice(0, -1).filter((c) => rec(c, 'd') && c.d!.y <= group[group.length - 1].b!.y + 1);
      const years = group.map((c) => c.b!.text.replace(/^.*?(\d{4}(\/\d\d)?)$/, '$1')).join(', ');
      add('name-reuse', f.id + first(group[0]), `${group.length} children named ${first(group[0])}`,
        `One family baptised ${group.length} children ${first(group[0])}: ${years}. ${died.length ? `${died.length === 1 ? 'The earlier one' : 'The earlier ones'} had died, and the name was given again, which was normal practice.` : 'No death is recorded for the earlier one. If the earlier child did not die young, one of these may be a duplicate record.'}`,
        group, group[0].b!.y);
    }

    // children too close together
    const dated = kids.filter((c) => rec(c, 'b') && /\d{1,2} \w{3} \d{4}/.test(c.b!.text) && c.b!.kind !== 'bap');
    dated.sort((a, b) => a.b!.y - b.b!.y);
    void dated; // day-level spacing is too sparse in this tree to be useful yet

    // married very young
    if (f.m && !f.m.est) {
      for (const par of partners) {
        const pb = rec(par, 'b');
        const pd = rec(par, 'd');
        if (pb && f.m.y - pb.y < 15) add('young-marriage', `${f.id}-${par.id}`, `${nm(par)} married at ${f.m.y - pb.y}`,
          `${nm(par)} is recorded as born ${pb.text} and married ${f.m.text}. Check whether the birth belongs to a different person of the same name.`, [par], f.m.y);
        if (pd && f.m.y > pd.y) add('after-death', `${f.id}-${par.id}-m`, `${nm(par)} married after death`,
          `${nm(par)} is recorded as dying ${pd.text} and marrying ${f.m.text}.`, [par], f.m.y);
      }
    }
  }

  for (const p of people) {
    if (p.living) continue;
    const b = rec(p, 'b');
    const d = rec(p, 'd');
    if (b && d && d.y - b.y > 105) add('long-life', p.id, `${nm(p)} lived ${d.y - b.y} years`,
      `Born ${b.text}, died ${d.text}. Not impossible, but a life this long often means two people share one record.`, [p], b.y);
    if (b && d && d.y < b.y) add('after-death', p.id + '-self', `${nm(p)} died before birth`,
      `Recorded as born ${b.text} and died ${d.text}.`, [p], b.y);
  }

  // possible duplicates: same name, same recorded birth year, different records
  const byKey = new Map<string, Person[]>();
  for (const p of people) {
    const b = rec(p, 'b');
    if (!b || !p.name) continue;
    const k = p.name.replace(/\(.*?\)/g, '').trim().toLowerCase() + '|' + b.y;
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }
  for (const [k, group] of byKey) {
    if (group.length < 2) continue;
    if (new Set(group.map((p) => p.parents ?? p.id)).size < 2) continue; // twins or same family: skip
    add('duplicate', k, `Two records for ${nm(group[0])}, born ${group[0].b!.y}?`,
      `${group.length} separate records carry the name ${nm(group[0])} and the birth year ${group[0].b!.y}. They may be the same person entered twice.`, group, group[0].b!.y);
  }

  // whole-tree observations
  const dead = people.filter((p) => !p.living);
  const undated = dead.filter((p) => p.b?.est && p.d?.est);
  if (undated.length) add('undated', 'all', `${undated.length} ${undated.length === 1 ? 'person has' : 'people have'} no dates at all`,
    `They are placed on the river by estimating from parents, partners and children, and drawn with a dashed ring. Any one baptism or burial would pin a whole family down.`, undated, Math.min(...undated.map((p) => p.b!.y)));
  const noSource = dead.filter((p) => p.sourced === 'none' && p.b && p.b.y < 1900);
  if (noSource.length) add('unsourced', 'all', `${noSource.length} ${noSource.length === 1 ? 'person' : 'people'} born before 1900 cite${noSource.length === 1 ? 's' : ''} no source`,
    `They came in with the original family tree file and nothing has been attached since. These are the cheapest wins: one record each.`, noSource, Math.min(...noSource.map((p) => p.b!.y)));
  const oldLiving = people.filter((p) => p.living && p.estY !== undefined && p.estY < thisYear - 105);
  if (oldLiving.length) add('flag', 'living', `${oldLiving.length} ${oldLiving.length === 1 ? 'person is' : 'people are'} marked living in a generation born before ${thisYear - 105}`,
    `Their place in the tree puts them in a generation that would now be over 105. They are kept private here because the record says living. If they have died, updating the record would let them appear.`, oldLiving, Math.min(...oldLiving.map((p) => p.estY!)));
  if (unflagged.length) {
    const ps = unflagged.map((id) => P.get(id)!).filter(Boolean);
    add('flag', 'unflagged', `${ps.length} old ${ps.length === 1 ? 'record has' : 'records have'} no living-or-dead flag`,
      `${ps.map(nm).join(' and ')} ${ps.length === 1 ? 'carries' : 'carry'} no flag either way. Shown here because the dates are more than 120 years old. Setting the flag in Iris would make it explicit.`, ps, Math.min(...ps.map((p) => p.b?.y ?? thisYear)));
  }
  void F;
  const rank: Record<string, number> = { 'young-parent': 0, 'after-death': 1, duplicate: 2, 'old-parent': 3, 'young-marriage': 3, 'long-life': 4, 'name-reuse': 5, flag: 6, unsourced: 7, undated: 8 };
  leads.sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9) || a.y - b.y || (a.id < b.id ? -1 : 1));
  return leads;
}
