// river.json -> atlas.json. Places every deceased person the records can place.
//
// Input is the published, privacy-filtered RiverData, never the raw export: the
// living arrive here with no name, date or place, and nothing is added for them.

import type { Family, Lead, Person, RiverData } from '../src/model/types.ts';
import type { AtlasData, AtlasPerson, AtlasPlace, AtlasStop, StopKind } from '../src/model/atlas-types.ts';
import { km } from '../src/model/geo.ts';
import { lastKnown, legsOf, ll, sortStops, staysOf, type Stay } from '../src/model/journey.ts';
import { locate, PLACE, PLACES } from './gazetteer.ts';

/** Anyone who died in or after this year is shown to the town, not the suburb, street or cemetery. */
export const TOWN_ONLY_FROM = 1950;

export interface AtlasBuild { atlas: AtlasData; unmapped: string[] }

const place0 = (id: string) => PLACE.get(id)!;
const first = (p: Person) => (p.given ?? p.name ?? '').split(' ')[0];

export function buildAtlas(river: RiverData): AtlasBuild {
  const P = new Map(river.people.map((p) => [p.id, p]));
  const F = new Map(river.families.map((f) => [f.id, f]));
  const dead = river.people.filter((p) => !p.living && p.b && p.d);
  const unmapped = new Set<string>();
  const used = new Set<string>();
  const out = new Map<string, AtlasPerson>();

  const recent = (p: Person) => (p.d!.est ? p.b!.y >= TOWN_ONLY_FROM - 70 : p.d!.y >= TOWN_ONLY_FROM);
  const resolve = (raw: string | undefined, p: Person): AtlasPlace | null => {
    if (!raw) return null;
    const hit = locate(raw);
    if (hit === 'ignore') return null;
    if (!hit) { unmapped.add(raw); return null; }
    return recent(p) && hit.town ? PLACE.get(hit.town)! : hit;
  };

  for (const p of dead) {
    const stops: AtlasStop[] = [];
    const seen = new Set<string>();
    // "disputed" on a person means the early record may be someone else of the same name
    const disputed = p.tier === 'disputed' ? (p.tierWhy ?? 'disputed').replace(/^disputed:\s*/i, '') : '';
    const add = (raw: string | undefined, y: number | undefined, kind: StopKind, why: string, est = false, approx = false) => {
      const pl = resolve(raw, p);
      if (!pl || y == null) return;
      // one marriage, recorded twice, is one row: keep the one that names the partner
      const dup = kind === 'marriage' ? stops.find((s) => s.kind === 'marriage' && s.y === y && s.p === pl.id) : undefined;
      if (dup) { if (why.length > dup.why.length) dup.why = why; return; }
      const key = `${y}|${pl.id}|${kind}|${why}`;
      if (seen.has(key)) return;
      seen.add(key);
      stops.push({ y, p: pl.id, kind, why, ...(est ? { est: true } : {}), ...(approx && !est ? { approx: true } : {}), ...(disputed && (kind === 'birth' || kind === 'baptism') ? { doubt: disputed } : {}) });
    };
    const b = p.b!, d = p.d!;
    add(b.place, b.y, b.kind === 'bap' ? 'baptism' : 'birth', b.kind === 'bap' ? 'baptised' : 'born', Boolean(b.est), Boolean(b.approx));
    for (const e of p.events ?? []) {
      if (!e.place) continue;
      if (e.tag === 'CHR' || e.tag === 'BAPM') add(e.place, e.y ?? (b.est ? undefined : b.y), 'baptism', 'baptised');
      else if (e.tag === 'BURI') add(e.place, e.y ?? (d.est ? undefined : d.y), 'burial', 'buried');
      else if (e.tag === 'CENS') add(e.place, e.y, 'census', 'census');
      else if (e.tag === 'MARR') add(e.place, e.y, 'marriage', 'married');
      else if (e.y != null && e.y >= b.y && e.y <= d.y) add(e.place, e.y, 'event', /accomplish/i.test(e.label) ? 'an achievement the tree dates to that year and places here' : `in the record for that year: ${e.label.toLowerCase()}`);
    }
    if (!d.est) add(d.place, d.y, d.kind === 'bur' ? 'burial' : 'death', d.kind === 'bur' ? 'buried' : 'died', false, Boolean(d.approx));
    for (const fid of p.fams) {
      const f = F.get(fid);
      if (!f) continue;
      const partner = f.partners.map((id) => P.get(id)).find((q) => q && q.id !== p.id && !q.living);
      if (f.m?.place && !f.m.est) add(f.m.place, f.m.y, 'marriage', partner ? `married ${first(partner)}` : 'married', false, Boolean(f.m.approx));
      // A child's recorded birthplace puts both parents there that year.
      for (const cid of f.children) {
        const c = P.get(cid);
        if (!c || c.living || !c.b?.place || c.b.est) continue;
        const y = c.b.y;
        if (y < b.y + 12 || y > d.y + (p.sex === 'M' ? 1 : 0)) continue;
        add(c.b.place, y, 'child', `${c.b.kind === 'bap' ? 'baptism' : 'birth'} of ${first(c)}`, false, Boolean(c.b.approx));
      }
    }
    if (stops.length) out.set(p.id, { id: p.id, stops: sortStops(stops) });
  }

  // ---- people with no place of their own borrow one from a close relative ----
  const stays = new Map<string, Stay[]>();
  const stay = (id: string) => { let s = stays.get(id); if (!s) { s = staysOf(out.get(id)!, place0); stays.set(id, s); } return s; };
  const pron = (p: Person) => (p.sex === 'F' ? 'her' : p.sex === 'M' ? 'his' : 'their');
  const subj = (p: Person) => (p.sex === 'F' ? 'she' : p.sex === 'M' ? 'he' : 'they');
  /**
   * A place to draw someone with no record of their own that year: where a relative
   * was last recorded. Never before the relative is recorded anywhere: `from` is the
   * first year the loan can start.
   */
  const lend = (id: string | undefined, year: number): { p: string; from: number; waited: boolean } | null => {
    const a = id ? out.get(id) : undefined;
    // only from someone with a record of their own: a borrowed place is never lent on
    if (!a || a.borrowed) return null;
    const recs = a.stops.filter((s) => s.kind !== 'borrowed');
    if (!recs.length) return null;
    const first = Math.min(...recs.map((s) => s.y));
    const from = Math.max(year, first);
    // nobody is drawn with a relative who had already died: a burial is not somewhere to be
    if (from >= P.get(a.id)!.d!.y) return null;
    const pid = lastKnown(stay(a.id), from);
    if (!pid) return null;
    const pl = PLACE.get(pid)!;
    return { p: pl.town ?? pl.id, from, waited: first > year };
  };
  // ---- nobody is drawn before a record places them ----
  // Someone whose first record comes years after birth is shown hollow with a parent
  // until then. With no parent to borrow from they are not drawn until that record.
  for (const p of [...dead].sort((a, b) => a.b!.y - b.b!.y)) {
    const a = out.get(p.id);
    if (!a) continue;
    const firstY = Math.min(...a.stops.map((s) => s.y));
    // a record within two years of birth is close enough to place the child, unless it is the child's own burial
    if (a.stops.some((s) => s.kind === 'birth' || s.kind === 'baptism') || a.stops.some((s) => s.y <= p.b!.y + 2 && s.kind !== 'death' && s.kind !== 'burial')) continue;
    const par = p.parents ? F.get(p.parents) : undefined;
    const ps = (par?.partners ?? []).map((id) => P.get(id)!).filter((q) => q && !q.living).sort((x, y) => (x.sex === 'F' ? 0 : 1) - (y.sex === 'F' ? 0 : 1));
    let done = false;
    for (const q of ps) {
      const l = lend(q.id, p.b!.y);
      if (!l || l.from >= firstY) continue;
      const late = l.from > p.b!.y + 2;
      a.stops = sortStops([{ y: l.from, p: l.p, kind: 'borrowed', why: `birthplace not recorded: shown with ${pron(p)} ${q.sex === 'F' ? 'mother' : 'father'}, ${q.name}${late ? `, from ${l.from}, the first year ${subj(q)} is recorded` : ''}`, est: true }, ...a.stops]);
      if (late) { a.seen = l.from; a.seenWhy = `the first year ${q.name} is recorded`; }
      stays.delete(p.id); done = true; break;
    }
    if (!done) { a.seen = firstY; a.seenWhy = 'the first record'; }
  }

  // ---- people with no record of their own are drawn where a relative with one was ----
  const round: AtlasPerson[] = [];
  for (const p of dead) {
    if (out.has(p.id)) continue;
    const y = p.b!.y, end = p.d!.y;
    type How = NonNullable<AtlasPerson['borrowed']>;
    const tries: { how: How; l: ReturnType<typeof lend>; when: string }[] = [];
    const par = p.parents ? F.get(p.parents) : undefined;
    if (par) {
      const ps = par.partners.map((id) => P.get(id)!).filter(Boolean).sort((a, b) => (a.sex === 'F' ? 0 : 1) - (b.sex === 'F' ? 0 : 1));
      for (const q of ps) tries.push({ how: { from: q.id, how: 'parent' }, l: lend(q.id, y), when: '' });
      for (const sid of par.children) if (sid !== p.id) tries.push({ how: { from: sid, how: 'sibling' }, l: lend(sid, Math.max(y, P.get(sid)?.b?.y ?? y)), when: `when ${P.get(sid)?.name ?? 'they'} was born` });
    }
    for (const fid of p.fams) {
      const f: Family | undefined = F.get(fid);
      if (!f) continue;
      for (const q of f.partners) if (q !== p.id) tries.push({ how: { from: q, how: 'partner' }, l: lend(q, Math.max(y, f.m?.y ?? f.estY)), when: f.m && !f.m.est ? 'the year they married' : 'about when they married, a year estimated from their children' });
      for (const c of f.children) tries.push({ how: { from: c, how: 'child' }, l: lend(c, Math.max(y, P.get(c)?.b?.y ?? y)), when: `when ${P.get(c)?.name ?? 'the child'} was born` });
    }
    const order = ['parent', 'partner', 'sibling', 'child'];
    // the loan has to start while the person is alive
    const hit = tries.filter((t) => t.l && t.l.from < end).sort((a, b) => order.indexOf(a.how.how) - order.indexOf(b.how.how) || a.l!.from - b.l!.from)[0];
    if (!hit) continue;
    const lender = P.get(hit.how.from)!, l = hit.l!;
    const rel = hit.how.how === 'parent' ? (lender.sex === 'F' ? 'mother' : lender.sex === 'M' ? 'father' : 'parent') : hit.how.how === 'partner' ? (lender.sex === 'F' ? 'wife' : lender.sex === 'M' ? 'husband' : 'partner') : hit.how.how;
    const late = l.from > y + 2;
    const seenWhy = l.waited ? `the first year ${lender.name} is recorded` : hit.when || `the first year ${lender.name} is recorded`;
    round.push({ id: p.id, borrowed: hit.how, ...(late ? { seen: l.from, seenWhy } : {}), stops: [{ y: late ? l.from : y, p: l.p, kind: 'borrowed', why: `no place recorded: shown with ${pron(p)} ${rel}, ${lender.name}${late ? `, from ${l.from}` : ''}`, est: true }] });
  }
  for (const a of round) out.set(a.id, a);

  // ---- a child drawn with a parent goes where that parent is next recorded, until sixteen ----
  for (const a of out.values()) {
    const s0 = a.stops[0];
    const m = s0.kind === 'borrowed' ? /with (?:her|his|their) (mother|father), /.exec(s0.why) : null;
    if (!m) continue;
    const p = P.get(a.id)!;
    const par = p.parents ? F.get(p.parents) : undefined;
    const lender = (par?.partners ?? []).map((id) => P.get(id)!).find((q) => q && !q.living && s0.why.includes(`, ${q.name}`));
    const la = lender ? out.get(lender.id) : undefined;
    if (!lender || !la || la.borrowed) continue;
    const ownFirst = Math.min(Infinity, ...a.stops.filter((s) => s.kind !== 'borrowed').map((s) => s.y));
    const until = Math.min(p.b!.y + 16, p.d!.y, lender.d!.y, ownFirst);
    let at = s0.p;
    for (const st of stay(lender.id)) {
      if (st.stops.every((x) => x.kind === 'borrowed') || st.from <= s0.y || st.from >= until) continue;
      const pl = PLACE.get(st.p)!, here = pl.town ?? pl.id;
      if (here === at) continue;
      at = here;
      a.stops.push({ y: st.from, p: here, kind: 'borrowed', why: `still a child: shown with ${pron(p)} ${m[1]}, ${lender.name}, recorded here from ${st.from}`, est: true });
    }
    a.stops = sortStops(a.stops);
  }
  stays.clear();

  const people = dead.filter((p) => out.has(p.id)).map((p) => out.get(p.id)!);
  for (const a of people) for (const s of a.stops) used.add(s.p);
  const unplaced = dead.filter((p) => !out.has(p.id)).map((p) => p.id);
  const places = PLACES.filter((p) => used.has(p.id));
  const moves = people.reduce((n, a) => n + legsOf(staysOf(a, place0), place0).filter((l) => l.km > 3 && !l.assumed && !l.within).length, 0);
  const { facts, leads } = findings(people, P, F);
  return {
    atlas: {
      meta: { counts: { deceased: dead.length, recorded: people.filter((a) => !a.borrowed).length, borrowed: people.filter((a) => a.borrowed).length, unplaced: unplaced.length, living: river.people.filter((p) => p.living).length, places: places.length, moves } },
      places, people, unplaced, facts, leads,
    },
    unmapped: [...unmapped].sort(),
  };
}

// ---- what the map shows when you count ----

function findings(people: AtlasPerson[], P: Map<string, Person>, F: Map<string, Family>): { facts: Lead[]; leads: Lead[] } {
  const facts: Lead[] = [], leads: Lead[] = [];
  const place = (id: string) => PLACE.get(id)!;
  const own = people.filter((a) => !a.borrowed);
  const name = (id: string) => P.get(id)!.name!;
  const yr = (id: string) => P.get(id)!.b!.y;
  const abt = (on: boolean | undefined, y: number) => `${on ? 'about ' : ''}${y}`;
  // findings count recorded places and recorded moves only, never a borrowed starting place
  const all = own.map((a) => { const every = staysOf(a, place); return { a, st: every.filter((s) => s.stops.some((x) => x.kind !== 'borrowed')), legs: legsOf(every, place).filter((l) => !l.assumed && !l.within) }; });

  // first to reach each country
  const firstIn = new Map<string, { id: string; y: number; born: boolean; approx: boolean }>();
  for (const { a, st } of all) for (const s of st) {
    const c = place(s.p).country, cur = firstIn.get(c);
    if (!cur || s.from < cur.y) firstIn.set(c, { id: a.id, y: s.from, born: s.stops[0].kind === 'birth' || s.stops[0].kind === 'baptism', approx: Boolean(s.stops[0].approx) });
  }
  const crossings = all.flatMap(({ a, legs }) => legs.filter((l) => l.km > 9000).map((l) => ({ id: a.id, l }))).sort((x, y) => x.l.y1 - y.l.y1);
  if (crossings.length) {
    const c = crossings[0], sameYear = crossings.filter((x) => x.l.y1 === c.l.y1);
    facts.push({ id: 'a-first-crossing', kind: 'crossing', y: c.l.y1, people: sameYear.map((x) => x.id),
      title: `The first of the family is in New Zealand by ${abt(c.l.approx1, c.l.y1)}`,
      body: `${sameYear.map((x) => name(x.id)).join(' and ')}: last recorded in ${place(c.l.a).name} in ${abt(c.l.approx0, c.l.y0)}, in ${place(c.l.b).name} by ${abt(c.l.approx1, c.l.y1)}. The tree does not name a ship.` });
    const ids = [...new Set(crossings.map((x) => x.id))];
    facts.push({ id: 'a-crossings', kind: 'crossing', y: crossings[Math.floor(crossings.length / 2)].l.y1, people: ids,
      title: `${ids.length} people are recorded on both sides of the world`,
      body: `Each was recorded in Europe and later in New Zealand. The earliest is there by ${crossings[0].l.y1}, the latest by ${crossings[crossings.length - 1].l.y1}. Many more must have made the voyage: these are the ones whose own records show both ends.` });
  }
  // farthest from birth
  const far = all.filter((x) => x.st.length > 1).map((x) => ({ id: x.a.id, d: km(ll(place(x.st[0].p)), ll(place(x.st[x.st.length - 1].p))), from: x.st[0].p, to: x.st[x.st.length - 1].p })).sort((a, b) => b.d - a.d);
  if (far.length) {
    const f = far[0];
    facts.push({ id: 'a-farthest', kind: 'distance', y: P.get(f.id)!.d!.y, people: [f.id], title: `${name(f.id)} ended ${(Math.round(f.d / 100) * 100).toLocaleString('en')} km from the start`,
      body: `First recorded in ${place(f.from).name}, last in ${place(f.to).name}. No one in the tree is recorded farther from where they began.` });
  }
  // most places in one life
  // a closer place inside a vaguer one is the same place known better, not another place
  const distinct = (st: Stay[]) => new Set(st.filter((s, i) => !st[i + 1]?.within).map((s) => place(s.p).town ?? s.p));
  const busy = [...all].sort((a, b) => distinct(b.st).size - distinct(a.st).size)[0];
  if (busy && distinct(busy.st).size >= 3) {
    const names = [...distinct(busy.st)].map((id) => place(id).name);
    facts.push({ id: 'a-most-places', kind: 'places', y: busy.st[1].from, people: [busy.a.id], title: `${name(busy.a.id)} is recorded in ${names.length} places`,
      body: `${names.join(', then ')}. ${all.filter((x) => distinct(x.st).size === names.length).length > 1 ? 'No one in the tree is recorded in more places' : 'More places than anyone else in the tree'}, counting a county or country only when no town inside it is named, which says as much about how well this life is recorded as about how far it went.` });
  }
  // the place with the most births
  const births = new Map<string, string[]>();
  for (const { a } of all) { const s = a.stops.find((x) => (x.kind === 'birth' || x.kind === 'baptism') && place(x.p).prec !== 'country' && place(x.p).prec !== 'area'); if (s) { const t = place(s.p).town ?? s.p; births.set(t, [...(births.get(t) ?? []), a.id]); } }
  const top = [...births].sort((a, b) => b[1].length - a[1].length)[0];
  if (top) {
    const ys = top[1].map(yr);
    facts.push({ id: 'a-birthplace', kind: 'places', y: Math.min(...ys), people: top[1], title: `${top[1].length} recorded births and baptisms in ${place(top[0]).name.split(',')[0]}`,
      body: `From ${Math.min(...ys)} to ${Math.max(...ys)}. No other place has as many.` });
  }
  // brothers and sisters born in different countries
  let split: { f: Family; cs: string[]; kids: Person[] } | undefined;
  for (const f of F.values()) {
    const kids = f.children.map((id) => P.get(id)!).filter((c) => c && !c.living && c.b?.place && !c.b.est);
    const cs = [...new Set(kids.map((c) => { const h = locate(c.b!.place); return h && h !== 'ignore' ? h.country : ''; }).filter(Boolean))];
    if (cs.length > 1 && (!split || kids.length > split.kids.length)) split = { f, cs, kids };
  }
  if (split) {
    const parents = split.f.partners.map((id) => P.get(id)).filter((q) => q && !q.living).map((q) => q!.name).join(' and ');
    const kids = [...split.kids].sort((a, b) => a.b!.y - b.b!.y);
    const firstAway = kids.find((c) => { const h = locate(c.b!.place); return h && h !== 'ignore' && h.country !== (locate(kids[0].b!.place) as AtlasPlace).country; })!;
    facts.push({ id: 'a-split-family', kind: 'crossing', y: firstAway.b!.y, people: kids.map((c) => c.id), title: `One family, children born in ${split.cs.join(' and ')}`,
      body: `The children of ${parents}. ${first(kids[0])} was born in ${(locate(kids[0].b!.place) as AtlasPlace).name} in ${kids[0].b!.y}; ${first(firstAway)} in ${(locate(firstAway.b!.place) as AtlasPlace).name} in ${firstAway.b!.y}. The voyage falls between those two births.` });
  }
  // on the map only because a child's birth was recorded
  const byChild = own.filter((a) => a.stops.filter((x) => x.kind !== 'borrowed').every((x) => x.kind === 'child'));
  const mothers = byChild.filter((a) => P.get(a.id)!.sex === 'F');
  if (byChild.length > 3) {
    const ys = byChild.flatMap((a) => a.stops.filter((x) => x.kind === 'child').map((x) => x.y));
    facts.push({ id: 'a-by-child', kind: 'places', y: Math.min(...ys), people: byChild.map((a) => a.id), title: `${byChild.length} people are on the map only because a child was born`,
      body: `${mothers.length} of them are women. No record of their own names a place: not a birth, a marriage or a burial. The only thing that says where they were is the entry for a child's birth or baptism.` });
  }
  // began in Europe, ended in New Zealand, and the other way
  const ended = all.filter((x) => x.st.length > 1).map((x) => ({ id: x.a.id, from: place(x.st[0].p).country, to: place(x.st[x.st.length - 1].p).country }));
  const out = ended.filter((e) => e.from !== 'New Zealand' && e.to === 'New Zealand'), home = ended.filter((e) => e.from === 'New Zealand' && e.to !== 'New Zealand');
  if (out.length) {
    facts.push({ id: 'a-one-way', kind: 'crossing', y: Math.max(...out.map((e) => P.get(e.id)!.b!.y)), people: [...out, ...home].map((e) => e.id), title: home.length ? `${out.length} went out to New Zealand. ${home.length} came back` : `${out.length} went out to New Zealand. Nobody is recorded coming back`,
      body: `${out.length} people are first recorded on one side of the world and last recorded in New Zealand. ${home.length ? `${home.map((e) => name(e.id)).join(' and ')} went the other way.` : 'Not one person in the tree is first recorded in New Zealand and last recorded anywhere else.'} For this family the voyage was one way.` });
  }
  // brothers and sisters who ended on different sides of the world
  const lastSide = new Map(all.map((x) => [x.a.id, place(x.st[x.st.length - 1].p).country === 'New Zealand' ? 'nz' : 'eu']));
  const firstSide = new Map(all.map((x) => [x.a.id, place(x.st[0].p).country === 'New Zealand' ? 'nz' : 'eu']));
  const splits: { f: Family; stayed: string[]; went: string[]; when: number }[] = [];
  const arrived = new Map(all.map((x) => [x.a.id, x.st.find((st) => place(st.p).country === 'New Zealand')?.from ?? Infinity]));
  for (const f of F.values()) {
    const kids = f.children.filter((id) => lastSide.has(id) && firstSide.get(id) === 'eu');
    const went = kids.filter((id) => lastSide.get(id) === 'nz');
    if (!went.length) continue;
    const when = Math.min(...went.map((id) => arrived.get(id)!));
    // only those still alive when the first of them is recorded in New Zealand were parted by it
    const stayed = kids.filter((id) => lastSide.get(id) === 'eu' && !P.get(id)!.d!.est && P.get(id)!.d!.y > when);
    if (stayed.length) splits.push({ f, stayed, went, when });
  }
  if (splits.length) {
    const names = (ids: string[]) => ids.map((id) => first(P.get(id)!)).join(' and ');
    const line = (x: (typeof splits)[number]) => {
      const parents = x.f.partners.map((id) => P.get(id)).filter((q) => q && !q.living).map((q) => q!.name).join(' and ');
      return `Of the children of ${parents}, ${names(x.went)} ${x.went.length > 1 ? 'are' : 'is'} in New Zealand by ${x.when}; ${names(x.stayed)}, still living then, ${x.stayed.length > 1 ? 'are' : 'is'} last recorded in ${['England', 'Wales'].includes(place(all.find((y) => y.a.id === x.stayed[0])!.st.slice(-1)[0].p).country) ? 'Britain' : place(all.find((y) => y.a.id === x.stayed[0])!.st.slice(-1)[0].p).country}.`;
    };
    facts.push({ id: 'a-split-siblings', kind: 'crossing', y: Math.min(...splits.map((x) => x.when)), people: splits.flatMap((x) => [...x.stayed, ...x.went]),
      title: `${splits.length === 1 ? 'One family was' : `${splits.length} families were`} split by the voyage`,
      body: `Brothers and sisters, one recorded in New Zealand and another, alive at the time, last recorded on the other side of the world. ${splits.map(line).join(' ')} Whether they met again, the tree does not say.` });
  }
  // the longest silence between two records of one life
  const gaps = all.flatMap((x) => x.legs.map((l) => ({ id: x.a.id, l }))).sort((a, b) => b.l.y1 - b.l.y0 - (a.l.y1 - a.l.y0));
  if (gaps.length && gaps[0].l.y1 - gaps[0].l.y0 >= 30) {
    const g = gaps[0];
    facts.push({ id: 'a-silence', kind: 'places', y: g.l.y1, people: [g.id], title: `${name(g.id)}: ${g.l.approx0 || g.l.approx1 ? 'about ' : ''}${g.l.y1 - g.l.y0} years with no record`,
      body: `Recorded in ${place(g.l.a).name} in ${abt(g.l.approx0, g.l.y0)}, and not again until ${place(g.l.b).name} in ${abt(g.l.approx1, g.l.y1)}. It is the longest silence between two places in the tree. On the map the light waits where it was last seen, growing dim.` });
  }
  for (const [c, f] of firstIn) {
    if (c === 'England' || c === 'New Zealand') continue;
    facts.push({ id: 'a-first-' + c.toLowerCase().replace(/\W+/g, '-'), kind: 'places', y: f.y, people: [f.id], title: `${c === 'United States' ? 'The United States' : c}: first recorded ${f.approx ? 'about' : 'in'} ${f.y}`,
      body: `${name(f.id)} ${f.born ? 'was born' : 'is recorded'} there${f.born ? '' : ''}.` });
  }

  // ---- worth a second look ----
  for (const { a, st } of all) {
    // back and forth across the world, or two far places in the same year
    const far2 = legsOf(st, place).filter((l) => l.km > 9000 && !l.assumed && !l.within);
    if (far2.length >= 2) {
      leads.push({ id: 'a-return-' + a.id, kind: 'return', y: far2[1].y1, people: [a.id], title: `${name(a.id)} is recorded on both sides of the world, then back`,
        body: `${st.map((s) => `${place(s.p).name} ${s.from}`).join(', ')}. Either a return voyage, which is rare, or a record attached to the wrong person. Worth checking which.` });
    }
    for (const l of legsOf(st, place)) {
      if (l.km < 9000 || l.y1 - l.y0 > 0 || l.assumed || l.within) continue;
      const key = `a-same-year-${l.y1}-${l.a}-${l.b}`;
      const had = leads.find((x) => x.id === key);
      if (had) { had.people.push(a.id); had.title = `${had.people.map(name).join(' and ')}: both sides of the world in ${l.y1}`; continue; }
      leads.push({ id: key, kind: 'same-year', y: l.y1, people: [a.id], title: `${name(a.id)}: both sides of the world in ${l.y1}`,
        body: `Recorded in ${place(l.a).name} and in ${place(l.b).name} in the same year. The voyage took two to three months, so it is possible, just. Worth checking both dates.` });
    }
  }
  for (const { a, legs } of all) for (const l of legs) if (l.doubt) {
    leads.push({ id: 'a-doubt-' + a.id, kind: 'doubt', y: l.y1, people: [a.id], title: `The oldest move on the map is the one in doubt`,
      body: `${name(a.id)}: recorded as a child in ${place(l.a).name} in ${l.y0}, a father in ${place(l.b).name} by ${l.y1}. ${Math.round(km(ll(place(l.a)), ll(place(l.b))) / 10) * 10} km, and he would have been about ${l.y1 - yr(a.id)}. The tree itself says: ${l.doubt}. If these are two men, this journey never happened.` });
  }
  return { facts, leads };
}
