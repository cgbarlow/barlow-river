// Turns an Iris export_set JSON into the public river.json.
// Privacy is enforced here and nowhere else: what this function returns is
// everything the site ever sees.

import { createHash } from 'node:crypto';
import { parseDate, type ParsedDate } from './dates.ts';
import { regionOf, tidyPlace } from './places.ts';
import { findLeads } from './leads.ts';
import { findFacts } from './facts.ts';
import type { Citation, DateInfo, Family, LifeEvent, Person, RiverData, Tier } from '../src/model/types.ts';

type Any = Record<string, any>;

/** Nobody is older than this, so an undated flag can be settled by a date. */
const MAX_AGE = 120;
/** Free text (notes, descriptions, citation details) ships only for people of this era. */
export const TEXT_BORN_BEFORE = 1900;
export const TEXT_DIED_BEFORE = 1950;

const COMPILED = /familysearch family tree|myheritage|smart match|web site|family site|family tree|ancestry\.com tree|geni\b/i;
const DOUBT = /hypothesis|unverified|unproven|unconfirmed|assumed|probable|may not belong/i;

const EVENT_LABEL: Record<string, string> = {
  BIRT: 'Birth', CHR: 'Christening', BAPM: 'Baptism', DEAT: 'Death', BURI: 'Burial', CENS: 'Census',
  RESI: 'Residence', OCCU: 'Occupation', MARR: 'Marriage', EDUC: 'Education', EMIG: 'Emigration',
  IMMI: 'Immigration', RELI: 'Religion', EVEN: 'Event',
};

const hash = (s: string) => createHash('sha256').update('river:' + s).digest('hex').slice(0, 8);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

function toDate(p: ParsedDate | null, extra: Partial<DateInfo> = {}): DateInfo | undefined {
  if (!p) return undefined;
  const d: DateInfo = { y: p.year, text: p.text, ...extra };
  if (p.approx) d.approx = true;
  return d;
}

function properCase(s: string): string {
  // The GEDCOM shouts some surnames (WATKINS). Leave mixed case alone.
  return s.split(' ').map((w) => ((w === w.toUpperCase() || (w === s && w === w.toLowerCase())) && /\p{L}{3}/u.test(w)
    ? w.toLowerCase().replace(/(^|['-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
    : w)).join(' ');
}

export interface BuildOptions { thisYear?: number }

export function buildRiver(exp: Any, opts: BuildOptions = {}): RiverData {
  const thisYear = opts.thisYear ?? Number(String(exp.exported_at).slice(0, 4));
  const elements: Any[] = exp.elements;
  const isPerson = (e: Any) => e.element_type === 'object' && e.data?.type !== 'model'
    && e.data?.classifier !== 'Family' && e.data?.classifier !== 'Source';
  const rawPeople = elements.filter(isPerson);
  const rawFamilies = elements.filter((e) => e.data?.classifier === 'Family');
  const rawSources = elements.filter((e) => e.data?.classifier === 'Source');

  // ---- resolve references (GEDCOM id, FamilySearch id, or diagram node id) ----
  const ref = new Map<string, string>();
  const byElement = new Map<string, Any>(elements.map((e) => [e.id, e]));
  for (const e of rawPeople) for (const k of ['gedcom_id', 'familysearch_id']) if (e.data[k]) ref.set(e.data[k], e.id);
  const edgeLabel = new Map<string, string>(); // child element id -> label on the link from its family
  for (const g of exp.diagrams ?? []) {
    const nodeEl = new Map<string, string>();
    for (const n of g.data?.nodes ?? []) {
      const eid = n.data?.entityId;
      if (!eid) continue;
      nodeEl.set(n.id, eid);
      if (n.id.startsWith('P_') && byElement.has(eid) && isPerson(byElement.get(eid)!) && !ref.has(n.id.slice(2))) ref.set(n.id.slice(2), eid);
    }
    for (const ed of g.data?.edges ?? []) {
      const label = ed.data?.label;
      if (!label || label === 'cites') continue;
      const child = nodeEl.get(ed.target);
      if (child && String(ed.source).startsWith('F_')) edgeLabel.set(child, label);
    }
  }
  const sourceTitle = new Map<string, string>();
  for (const s of rawSources) if (s.data.gedcom_id) sourceTitle.set(String(s.data.gedcom_id), String(s.data.title || s.name));
  const byName = new Map<string, string>();
  for (const e of rawPeople) if (!e.data.gedcom_id && !e.data.familysearch_id) byName.set(e.name, e.id);

  // ---- who is living ----
  const firstYear = (e: Any): number | null => {
    const D = e.data;
    const cands = [D.birth?.date, D.christening?.date, D.death?.date, D.burial?.date, ...(D.events ?? []).map((v: Any) => v?.date)];
    let min: number | null = null;
    for (const c of cands) { const p = parseDate(c); if (p && (min === null || p.year < min)) min = p.year; }
    if (min === null) { const m = /\b(1[5-9]\d\d)\b/.exec(e.description ?? ''); if (m) min = Number(m[1]); }
    return min;
  };
  const unflagged: string[] = [];
  const deceased = new Set<string>();
  for (const e of rawPeople) {
    const flag = e.data.is_deceased;
    if (flag === true) deceased.add(e.id);
    else if (flag !== false) {
      // No flag at all. Only a recorded date older than any living person settles it.
      const y = firstYear(e);
      if (y !== null && y < thisYear - MAX_AGE) { deceased.add(e.id); unflagged.push(e.id); }
    }
  }

  // ---- ids ----
  const pid = new Map<string, string>();
  for (const e of rawPeople) {
    const key = e.data.gedcom_id || e.data.familysearch_id || [...ref].find(([, v]) => v === e.id)?.[0];
    pid.set(e.id, deceased.has(e.id) && key ? String(key) : 'x' + hash(e.id));
  }

  // ---- families ----
  const families: Family[] = [];
  const famRaw = new Map<string, Any>();
  const parentsOf = new Map<string, string>(); // element id -> family id
  const famsOf = new Map<string, string[]>();
  for (const f of rawFamilies) {
    const D = f.data;
    let partnerRefs: (string | undefined)[] = (D.partners ?? []).map((p: Any) => p.gedcom_id || p.familysearch_id);
    if ('husband_gedcom_id' in D || 'wife_gedcom_id' in D) partnerRefs = [D.husband_gedcom_id, D.wife_gedcom_id];
    const childRefs: Any[] = D.children ?? D.children_gedcom_ids ?? [];
    const partners = partnerRefs.filter(Boolean).map((r) => ref.get(r!)).filter(Boolean) as string[];
    const children = childRefs
      .map((c) => (typeof c === 'string' ? ref.get(c) : ref.get(c.gedcom_id || c.familysearch_id) ?? byName.get(c.name)))
      .filter(Boolean) as string[];
    const id = D.gedcom_id ? String(D.gedcom_id) : 'f' + hash(f.id);
    famRaw.set(id, f);
    for (const c of children) parentsOf.set(c, id);
    for (const p of partners) famsOf.set(p, [...(famsOf.get(p) ?? []), id]);
    const allDead = partners.every((p) => deceased.has(p));
    const fam: Family = { id, partners: partners.map((p) => pid.get(p)!), children: children.map((c) => pid.get(c)!), estY: 0 };
    if (allDead) {
      const m = toDate(parseDate(D.marriage?.date), D.marriage?.place ? { place: tidyPlace(D.marriage.place)! } : {});
      if (m) fam.m = m;
    }
    families.push(fam);
  }
  const famById = new Map(families.map((f) => [f.id, f]));

  // ---- people ----
  const people: Person[] = [];
  const P = new Map<string, Person>();
  for (const e of rawPeople) {
    const D = e.data;
    const id = pid.get(e.id)!;
    const p: Person = { id, living: !deceased.has(e.id), fams: famsOf.get(e.id) ?? [] };
    const par = parentsOf.get(e.id);
    if (par) p.parents = par;
    people.push(p);
    P.set(id, p);
    if (p.living) continue; // nothing else is ever read for the living

    p.name = properCase(D.full_name || e.name);
    if (D.given_names) p.given = D.given_names;
    const sur = D.surname ? properCase(D.surname) : guessSurname(p.name);
    if (sur) p.surname = sur;
    if (D.married_surnames?.length) p.married = D.married_surnames.map(properCase);
    p.sex = D.sex === 'M' || D.sex === 'F' ? D.sex : 'U';
    p.iris = e.id;
    if (D.name_variants?.length) p.variants = D.name_variants;

    const events: Any[] = (D.events ?? []).filter((v: Any) => v && typeof v === 'object');
    const ev = (tags: string[]) => events.find((v) => tags.includes(v.tag) && parseDate(v.date));
    const place = (o: Any) => (o?.place ? { place: tidyPlace(o.place)! } : {});
    const bap = D.christening?.date ? D.christening : ev(['CHR', 'BAPM']);
    const descBorn = /Born (?:about |c\.? ?)?(\d{4})/.exec(e.description ?? '');
    p.b = toDate(parseDate(D.birth?.date), place(D.birth))
      ?? toDate(parseDate(bap?.date), { kind: 'bap', ...place(bap) })
      ?? (descBorn ? { y: Number(descBorn[1]), text: 'c. ' + descBorn[1], approx: true } : undefined);
    if (p.b && !p.b.place && D.birth?.place) p.b.place = tidyPlace(D.birth.place)!;
    const bur = D.burial?.date ? D.burial : ev(['BURI']);
    const isBurial = /burial/i.test(D.death?.note ?? '');
    p.d = toDate(parseDate(D.death?.date), { ...(isBurial ? { kind: 'bur' as const } : {}), ...place(D.death) })
      ?? toDate(parseDate(bur?.date), { kind: 'bur', ...place(bur) });
    const marr = !p.b ? parseDate(events.find((v) => v.tag === 'MARR' && parseDate(v.date))?.date) : null;
    if (marr) p.b = { y: marr.year - 24, text: 'c. ' + (marr.year - 24), est: true };
    if (!p.b) delete p.b;
    if (!p.d) delete p.d;

    const anyPlace = D.birth?.place || bap?.place || events.find((v) => v.place)?.place || D.death?.place || D.burial?.place;
    const region = regionOf(anyPlace);
    if (region) p.region = region;

    const occ = D.occupation ?? events.find((v) => v.tag === 'OCCU')?.value;
    if (occ) p.occupation = typeof occ === 'string' ? occ : occ.value ?? occ.title;
    const thumb = D.primary_photo?.thumbnail_url;
    if (thumb && /^https:\/\//.test(thumb)) p.photo = thumb;

    // sourcing
    const cites: Citation[] = (D.citations ?? []).map((c: Any) => (typeof c === 'string' ? { source: c } : c)).filter((c: Any) => c?.source)
      .map((c: Any) => ({ source: sourceTitle.get(String(c.source)) ?? String(c.source), ...(c.detail ? { detail: String(c.detail) } : {}), ...(c.url && /^https?:\/\//.test(c.url) ? { url: c.url } : {}) }));
    const conf: string = D.research?.confidence ?? '';
    const hasRecord = cites.some((c) => !COMPILED.test(c.source)) || /^documented/i.test(conf);
    const hasCompiled = cites.length > 0 || Boolean(D.source);
    p.sourced = hasRecord ? 'record' : hasCompiled ? 'compiled' : 'none';
    if (!cites.length && D.source) cites.push({ source: String(D.source) + (D.familysearch_id ? ` (${D.familysearch_id})` : ''), ...(D.familysearch_id ? { url: `https://ancestors.familysearch.org/en/${D.familysearch_id}` } : {}) });

    // certainty of the link up to the parents
    if (par) {
      const label = edgeLabel.get(e.id) ?? '';
      const famConf: string = famRaw.get(par)?.data?.research?.confidence ?? '';
      let tier: Tier = p.sourced;
      let why = '';
      if (/disputed/i.test(label) || /^disputed/i.test(conf)) { tier = 'disputed'; why = conf || label; }
      else if (label) { tier = 'doubt'; why = label; }
      else if (DOUBT.test(conf)) { tier = 'doubt'; why = conf; }
      else if (/^(hypothesis|unverified)/i.test(famConf)) { tier = 'doubt'; why = 'family: ' + famConf; }
      p.tier = tier;
      if (why) p.tierWhy = why;
    }

    // free text: by era only
    const textOk = (p.b && p.b.y < TEXT_BORN_BEFORE) || (p.d && p.d.y < TEXT_DIED_BEFORE);
    if (textOk) {
      if (e.description) p.desc = e.description;
      if (D.notes?.length) p.notes = D.notes.filter((n: unknown) => typeof n === 'string' && n.trim());
      if (cites.length) p.cites = cites;
      const life: LifeEvent[] = [];
      for (const v of events) {
        if (['BIRT', 'DEAT'].includes(v.tag)) continue;
        const pd = parseDate(v.date);
        const le: LifeEvent = { tag: v.tag, label: v.tag === 'EVEN' && v.type ? String(v.type) : EVENT_LABEL[v.tag] ?? v.tag };
        if (pd) { le.date = pd.text; le.y = pd.year; }
        if (v.place) le.place = tidyPlace(v.place)!;
        if (v.value) le.value = String(v.value);
        if (v.note) le.note = String(v.note);
        if (le.date || le.place || le.value) life.push(le);
      }
      if (life.length) p.events = life;
    } else if (cites.length) {
      p.cites = cites.map((c) => ({ source: c.source, ...(c.url ? { url: c.url } : {}) }));
    }
  }

  for (const f of families) {
    const note = famRaw.get(f.id)?.data?.notes;
    const olds = f.partners.map((id) => P.get(id)!).every((q) => !q.living && ((q.b && q.b.y < TEXT_BORN_BEFORE) || (q.d && q.d.y < TEXT_DIED_BEFORE)));
    if (olds && f.partners.length && Array.isArray(note) && note.length) f.note = note.filter((n: unknown) => typeof n === 'string').join(' ');
  }

  estimateYears(people, famById, P, thisYear);
  inferRegions(people, famById, P);
  scrubLivingNames(people, families, rawPeople, deceased);

  people.sort((a, b) => (a.id < b.id ? -1 : 1));
  families.sort((a, b) => (a.id < b.id ? -1 : 1));
  const leads = findLeads(people, families, unflagged.map((id) => pid.get(id)!), thisYear);

  return {
    meta: {
      exportedAt: String(exp.exported_at).slice(0, 10),
      set: exp.set?.name ?? 'Barlow Family Tree',
      counts: { people: people.length, living: people.filter((p) => p.living).length, deceased: people.filter((p) => !p.living).length, families: families.length, sources: rawSources.length },
      thisYear,
    },
    people, families, leads, facts: findFacts(people, [...families], thisYear),
  };
}

function guessSurname(name: string): string | undefined {
  const clean = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return clean.length > 1 ? clean[clean.length - 1] : undefined;
}

/**
 * Fill in a year for everyone who lacks one, so they can be placed on the river.
 * Deceased people get an estimated birth (flagged est). Living people get estY
 * only, and it is derived from the positions of relatives, never from their own record.
 */
function estimateYears(people: Person[], F: Map<string, Family>, P: Map<string, Person>, thisYear: number) {
  const GEN = 29;
  const yr = (p: Person): number | undefined => (p.living ? p.estY : p.b?.y);
  const set = (p: Person, y: number) => {
    y = Math.round(Math.min(y, thisYear - 1));
    // the living are placed to the nearest decade only, so a position is never a birth year
    if (p.living) p.estY = Math.min(Math.floor(y / 10) * 10 + 5, thisYear - 1);
    else p.b = { y, text: 'c. ' + y, est: true };
  };
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (const p of people) {
      if (yr(p) !== undefined) continue;
      const cands: number[] = [];
      const pf = p.parents ? F.get(p.parents) : undefined;
      if (pf) {
        const ps = pf.partners.map((id) => yr(P.get(id)!)).filter((v): v is number => v !== undefined);
        if (ps.length) cands.push(ps.reduce((a, b) => a + b, 0) / ps.length + GEN + 1 + 2 * pf.children.indexOf(p.id));
        else {
          const sib = pf.children.map((id) => yr(P.get(id)!)).filter((v): v is number => v !== undefined);
          if (sib.length) cands.push(sib.reduce((a, b) => a + b, 0) / sib.length);
        }
      }
      if (!cands.length) {
        for (const fid of p.fams) {
          const f = F.get(fid)!;
          if (f.m) cands.push(f.m.y - 25);
          const kids = f.children.map((id) => yr(P.get(id)!)).filter((v): v is number => v !== undefined);
          if (kids.length) cands.push(Math.min(...kids) - GEN + 2);
          const sp = f.partners.filter((id) => id !== p.id).map((id) => yr(P.get(id)!)).filter((v): v is number => v !== undefined);
          if (!kids.length && !f.m && sp.length) cands.push(sp[0]);
        }
      }
      if (!cands.length && !p.living && p.d) cands.push(p.d.y - 62);
      if (cands.length) { set(p, Math.min(...cands)); changed = true; }
    }
    if (!changed) break;
  }
  for (const p of people) if (yr(p) === undefined) set(p, thisYear - 40);
  for (const p of people) {
    if (p.living || p.d) continue;
    const y = Math.min(p.b!.y + 70, thisYear - 1);
    p.d = { y, text: '', est: true };
  }
  for (const f of F.values()) {
    const kids = f.children.map((id) => yr(P.get(id)!)!).filter((v) => v !== undefined);
    const ps = f.partners.map((id) => yr(P.get(id)!)!).filter((v) => v !== undefined);
    const floor = ps.length ? Math.max(...ps) + 16 : -Infinity;
    if (f.m) f.estY = f.m.y;
    else if (kids.length) f.estY = Math.max(Math.min(...kids) - 1, floor);
    else if (ps.length) f.estY = Math.max(...ps) + 26;
    else f.estY = thisYear - 40;
    f.estY = Math.min(Math.round(f.estY), thisYear - 1);
  }
}

function inferRegions(people: Person[], F: Map<string, Family>, P: Map<string, Person>) {
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const p of people) {
      if (p.living || p.region) continue;
      const near: (Person | undefined)[] = [];
      const pf = p.parents ? F.get(p.parents) : undefined;
      if (pf) near.push(...pf.partners.map((id) => P.get(id)), ...pf.children.map((id) => P.get(id)));
      for (const fid of p.fams) { const f = F.get(fid)!; near.push(...f.children.map((id) => P.get(id)), ...f.partners.map((id) => P.get(id))); }
      const hit = near.find((q) => q && q !== p && !q.living && q.region && (pass > 0 || !q.regionInferred));
      if (hit) { p.region = hit.region; p.regionInferred = true; changed = true; }
    }
    if (!changed) break;
  }
}

/**
 * Second net. Any shipped string that carries a living person's full name
 * (given name plus surname, in either the birth or a married surname) is removed.
 */
function scrubLivingNames(people: Person[], families: Family[], rawPeople: Any[], deceased: Set<string>) {
  const needles = livingNeedles(rawPeople, deceased);
  const dirty = (s: string | undefined) => { if (!s) return false; const f = fold(s); return needles.some((n) => f.includes(n)); };
  // The author's own prose also uses first names alone ("supplied by Chris"). A first name that
  // belongs only to living people removes the note it appears in. Church dedications are spared.
  const deadWords = new Set<string>();
  for (const e of rawPeople) if (deceased.has(e.id)) for (const w of fold(String(e.data.full_name || e.name)).split(/[^a-z]+/)) deadWords.add(w);
  const firsts = new Set<string>();
  for (const e of rawPeople) {
    if (deceased.has(e.id)) continue;
    for (const w of [fold(String(e.data.given_names || e.data.full_name || e.name || '')).split(/[^a-z]+/)[0], fold(String(e.data.nickname ?? ''))]) {
      if (w && w.length >= 3 && !deadWords.has(w)) firsts.add(w);
    }
    const short = /\(([^)]+)\)/.exec(String(e.data.full_name ?? ''))?.[1];
    if (short && short.length >= 3 && !deadWords.has(fold(short))) firsts.add(fold(short));
  }
  const firstRe = firsts.size ? new RegExp(`(?<!\\bst\\.? )\\b(${[...firsts].map((w) => w.replace(/[^a-z]/g, '')).filter(Boolean).join('|')})\\b`) : null;
  const prose = (s: string | undefined) => dirty(s) || Boolean(s && firstRe?.test(fold(s)));
  for (const p of people) {
    if (p.living) continue;
    if (prose(p.desc)) delete p.desc;
    if (p.notes) { p.notes = p.notes.filter((n) => !prose(n)); if (!p.notes.length) delete p.notes; }
    if (p.cites) p.cites = p.cites.map((c) => (prose(c.detail) ? { source: c.source, ...(c.url ? { url: c.url } : {}) } : c)).filter((c) => !dirty(c.source));
    if (p.events) p.events = p.events.filter((e) => !prose(e.note) && !dirty(e.value));
    if (dirty(p.occupation)) delete p.occupation;
  }
  for (const f of families) if (prose(f.note)) delete f.note;
}

export function livingNeedles(rawPeople: Any[], deceased: Set<string>): string[] {
  // A living person can share a full name with an ancestor (there are two Hugh Barlows).
  // Those names stay usable for the dead, so they are not needles.
  const deadNames = new Set(rawPeople.filter((e) => deceased.has(e.id)).map((e) => fold(String(e.data.full_name || e.name)).replace(/\(.*?\)/g, '').trim()));
  const out = new Set<string>();
  for (const e of rawPeople) {
    if (deceased.has(e.id)) continue;
    const D = e.data;
    const full = fold(String(D.full_name || e.name || '')).replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
    const given = fold(String(D.given_names || full.split(' ')[0] || '')).split(' ')[0];
    const surnames = [D.surname, ...(D.married_surnames ?? [])].filter(Boolean).map((s: string) => fold(s));
    const add = (s: string) => { s = s.trim(); if (s.includes(' ') && s.length > 6 && !deadNames.has(s)) out.add(s); };
    add(full);
    for (const s of surnames) add(`${given} ${s}`);
  }
  return [...out];
}
