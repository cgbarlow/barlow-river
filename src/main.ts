import './style.css';
import type { Family, Person, RiverData } from './model/types.ts';
import { ancestorLabel, buildLayout, LINES, type Layout, type Stream } from './model/layout.ts';
import { LINE_COLOUR, REGION_COLOUR, River, TIER_COLOUR, TIER_LABEL, type Lens } from './river.ts';
import { BEATS, CARDS, CASE, SOFT_BREAKS, STATUS_LABEL, TESTS, type EvidenceCard, type Status } from './casefile.ts';
import { changeRequest, loadDrafts, saveDrafts, type Draft } from './evidence.ts';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => matchMedia('(max-width: 900px)').matches;

let data: RiverData;
let L: Layout;
let river: River;
let P: Map<string, Person>;
let F: Map<string, Family>;

const state = {
  year: 2026,
  playing: false,
  lens: 'surname' as Lens,
  tab: 'case' as 'case' | 'leads' | 'lines',
  selected: null as string | null,
  card: null as string | null,
  lead: null as string | null,
  line: null as string | null,
  composing: null as Draft | null,
  record: null as { kind: 'person' | 'family' | 'compose' | 'rule'; id?: string } | null,
};
let drafts: Draft[] = loadDrafts();
let trackMin = 1590;

// ---------------------------------------------------------------- helpers
const person = (id: string) => P.get(id);
const nameOf = (id: string) => { const p = P.get(id); return !p ? 'unknown' : p.living ? 'a living relative' : p.name!; };
function bornText(p: Person): string {
  if (!p.b) return '';
  if (p.b.est) return `about ${p.b.y}`;
  return (p.b.kind === 'bap' ? 'bapt. ' : '') + p.b.text;
}
function lifeText(p: Person): string {
  const b = p.b?.est ? `c. ${p.b.y}?` : (p.b?.kind === 'bap' ? 'bapt. ' : '') + (p.b?.text ?? '?');
  const d = p.d && !p.d.est ? (p.d.kind === 'bur' ? 'bur. ' : '') + p.d.text : '';
  return d ? `${b} – ${d}` : `${p.b?.est ? '' : 'b. '}${b}`;
}
const shortLife = (p: Person) => `${p.b?.est ? 'c.' : ''}${p.b?.y ?? '?'}${p.d && !p.d.est ? '–' + p.d.y : ''}`;
function chip(id: string): string {
  const p = P.get(id);
  if (!p) return '';
  if (p.living) return `<span class="rel" style="opacity:.6">living</span>`;
  return `<button class="rel" data-go="${esc(id)}">${esc(p.name)} <small style="color:var(--ink-3)">${esc(shortLife(p))}</small></button>`;
}
function chips(ids: string[]): string {
  const dead = ids.filter((id) => P.get(id) && !P.get(id)!.living);
  const living = ids.length - dead.length;
  return dead.map(chip).join('') + (living ? `<span class="rel" style="opacity:.65">${living} living, private</span>` : '');
}
function toast(msg: string) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
function ancestorsOf(id: string, out = new Set<string>()): Set<string> {
  const f = P.get(id)?.parents ? F.get(P.get(id)!.parents!) : undefined;
  if (f) for (const q of f.partners) if (!out.has(q)) { out.add(q); ancestorsOf(q, out); }
  return out;
}
function descendantsOf(id: string, out = new Set<string>()): Set<string> {
  for (const fid of P.get(id)?.fams ?? []) for (const c of F.get(fid)?.children ?? []) if (!out.has(c)) { out.add(c); descendantsOf(c, out); }
  return out;
}
const streamTree = (s: Stream, out: Stream[] = []) => { out.push(s); for (const t of s.tribs) if (!t.cut) streamTree(t, out); return out; };

// ---------------------------------------------------------------- boot
async function boot() {
  data = await (await fetch('./data/river.json')).json();
  P = new Map(data.people.map((p) => [p.id, p]));
  F = new Map(data.families.map((f) => [f.id, f]));
  L = buildLayout(data, new Set(SOFT_BREAKS));
  state.year = data.meta.thisYear;
  let minYear = Infinity;
  for (const s of L.spots.values()) minYear = Math.min(minYear, s.year);
  trackMin = Math.floor(minYear / 10) * 10 - 10;

  const gens = Math.max(...[...L.spots.values()].map((s) => s.gen ?? 0)) + 1;
  const c = data.meta.counts;
  $('#eyebrow').textContent = isSmall() ? `${c.people} people · ${c.families} families · ${gens} generations` : `Barlow family · ${c.people} people · ${c.families} families · ${gens} generations`;

  river = new River($('#river') as unknown as SVGSVGElement, data, L, {
    onSelect: (id) => (state.composing && id ? pickForDraft(id) : select(id)),
    onYear: (y) => { stop(); setYear(y); },
    onHover: hover,
    onStream: (s, frame) => showStream(s, frame),
    onHeadwater: () => { if (!state.composing) openCard('origin'); },
    onOxbow: (s) => { if (state.composing) return; const card = cardForStream(s); if (card) { state.card = null; openCard(card.id); } else focusIds(s.members); },
    onStep: stepPerson,
    onConfluence: (fid) => { if (state.composing) return; stopWalk(); openRecord({ kind: 'family', id: fid }); },
  });

  river.minYear = trackMin;

  // cut-off water and the flag where unbroken evidence ends
  for (const s of L.streams.filter((x) => x.cut)) {
    const group = streamTree(s).flatMap((x) => x.members);
    if (group.every((id) => P.get(id)!.living)) continue;
    const card = cardForStream(s);
    const towards = card?.people.find((id) => L.spots.get(id)?.stream === L.trunk);
    const label = card?.id === 'ranulph' ? 'Cut off by a will, 1640' : card?.id === 'oliva' ? 'Sarah Plantine, detached' : 'Not connected';
    river.markOxbow(s, label, towards);
  }
  const head = proofHeadPerson();
  if (head) river.markProofHead(head.id, `The line holds to here\n${head.name}, ${head.b?.est ? 'c. ' : ''}${head.b?.y}`);

  bindChrome();
  buildSpark();
  renderLegend();
  renderTab();
  $('#app').classList.remove('loading');

  const had = readHash();
  river.setLens(state.lens);
  if (!had && !reduceMotion) intro();
  else {
    setYear(state.year);
    if (!had) { $('#hint').hidden = false; setTimeout(() => { $('#hint').hidden = true; }, 6000); }
    const sel = state.selected, card = state.card, lead = state.lead, line = state.line;
    state.lead = null; state.line = null;
    setTimeout(() => { if (sel) select(sel); else if (card) { state.card = null; openCard(card, true, true); } else if (lead) openLead(lead); else if (line) selectLine(line); }, 60);
  }
  (window as unknown as Record<string, unknown>).__river = { river, state, L, data, select, setYear, play, stop, openCard };
}

/** The oldest person on the trunk reached without crossing a hard break. */
function proofHeadPerson(): Person | undefined {
  const chain = L.trunk.chain;
  const i = L.proofHead ? chain.indexOf(L.proofHead) : 0;
  return P.get(chain[Math.max(0, i)]);
}
function cardForStream(s: Stream): EvidenceCard | undefined {
  const ids = new Set(streamTree(s).flatMap((x) => x.members));
  return CARDS.filter((c) => c.people.some((id) => ids.has(id))).sort((a, b) => Number(b.status === 'ruledout') - Number(a.status === 'ruledout') || b.people.filter((id) => ids.has(id)).length - a.people.filter((id) => ids.has(id)).length)[0];
}

// ---------------------------------------------------------------- time
let raf = 0, lastT = 0, playYear = 0;
let captionHold = 0, captionYear = -1;
function setYear(y: number, fromPlay = false) {
  y = Math.max(trackMin, Math.min(data.meta.thisYear, y));
  state.year = Math.round(y);
  river.setYear(state.year, fromPlay);
  $('#year').textContent = String(state.year);
  const alive = river.aliveCount(state.year);
  $('#alive').textContent = state.year >= data.meta.thisYear ? `${data.meta.counts.living} living today` : `${alive} alive`;
  const u = (state.year - trackMin) / (data.meta.thisYear - trackMin);
  $('#track-fill').style.width = u * 100 + '%';
  $('#track-handle').style.left = u * 100 + '%';
  $('#track').setAttribute('aria-valuenow', String(state.year));
  document.querySelectorAll<SVGRectElement>('#spark rect').forEach((r) => r.classList.toggle('past', Number(r.dataset.y) <= state.year));
  caption(fromPlay);
  writeHash();
}
function play(keepHint = false) {
  if (state.playing) return;
  stopWalk();
  river.resumeFollow();
  if (!keepHint) $('#hint').hidden = true;
  river.startAutoCamera();
  if (state.year >= data.meta.thisYear) setYear(trackMin + 20);
  state.playing = true;
  document.body.classList.add('playing');
  $('#play').setAttribute('aria-label', 'Pause the timeline');
  playYear = state.year; lastT = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const births = birthsNear(playYear);
    const speed = playYear < 1690 ? 20 : Math.max(6.5, 13 - births * 0.9);
    playYear += dt * speed;
    if (Math.round(playYear) !== state.year) setYear(playYear, !reduceMotion);
    if (playYear >= data.meta.thisYear) { stop(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function stop() {
  if (!state.playing) return;
  state.playing = false;
  cancelAnimationFrame(raf);
  document.body.classList.remove('playing');
  $('#play').setAttribute('aria-label', 'Play the timeline');
}
let birthBins: number[] = [];
const birthsNear = (y: number) => birthBins[Math.max(0, Math.floor((y - trackMin) / 5))] ?? 0;

function intro() {
  setYear(trackMin + 10);
  const hint = $('#hint');
  hint.hidden = false;
  setTimeout(() => { hint.hidden = true; }, 6000);
  setTimeout(() => { if (state.year < trackMin + 14 && !state.selected && !state.record) play(true); }, 900);
}

// what happened in a year, in a sentence
interface Happening { y: number; w: number; text: string }
let happenings: Map<number, Happening[]> | null = null;
function buildHappenings() {
  const map = new Map<number, Happening[]>();
  const add = (y: number, w: number, text: string) => map.set(y, [...(map.get(y) ?? []), { y, w, text }]);
  const where = (s?: string) => (s ? ` in ${s.split(',')[0].replace(/^St /, 'St ')}` : '');
  for (const p of data.people) {
    if (p.living || !p.b || p.b.est) continue;
    const sp = L.spots.get(p.id)!;
    const w = sp.stream === L.trunk && sp.anc ? 5 : sp.anc ? 3.5 : 1;
    add(p.b.y, w, `${p.name} is ${p.b.kind === 'bap' ? 'baptised' : 'born'}${where(p.b.place)}.`);
  }
  for (const f of data.families) {
    if (!f.m || f.partners.length < 2) continue;
    const [a, b] = f.partners.map((id) => P.get(id)!);
    if (a.living || b.living) continue;
    const anc = L.spots.get(a.id)!.anc && L.spots.get(b.id)!.anc;
    add(f.m.y, anc ? 4 : 1.5, `${a.name} marries ${b.name}${where(f.m.place)}.${anc ? ' Two streams join.' : ''}`);
  }
  for (const b of BEATS) add(b.y, 9, b.text);
  const nz = data.facts.find((f) => f.id === 'fact:first-nz');
  if (nz) add(nz.y, 8.5, `${nameOf(nz.people[0])} is born in New Zealand, the first of the family there.`);
  happenings = map;
}
function caption(fromPlay: boolean) {
  if (!happenings) buildHappenings();
  const el = $('#caption');
  const y = state.year;
  if (y >= data.meta.thisYear) { el.classList.remove('on'); captionYear = -1; return; }
  const now = performance.now();
  let best: Happening | undefined;
  const span = fromPlay ? 1 : 0;
  for (let t = y - span; t <= y; t++) for (const h of happenings!.get(t) ?? []) if (!best || h.w > best.w) best = h;
  if (!best) { if (!fromPlay) el.classList.remove('on'); return; }
  if (fromPlay && now < captionHold && best.w < 8) return;
  if (best.y === captionYear && el.dataset.t === best.text) return;
  captionYear = best.y; el.dataset.t = best.text;
  el.innerHTML = `<b>${best.y}</b>${esc(best.text)}`;
  el.classList.add('on');
  captionHold = now + (best.w >= 8 ? 3400 : best.w >= 3 ? 1700 : 900);
}

function buildSpark() {
  const max = data.meta.thisYear, n = Math.ceil((max - trackMin) / 5);
  birthBins = new Array(n).fill(0);
  for (const s of L.spots.values()) { const i = Math.floor((s.year - trackMin) / 5); if (i >= 0 && i < n) birthBins[i]++; }
  const top = Math.max(...birthBins);
  const svg = $('#spark');
  svg.setAttribute('viewBox', `0 0 ${n} 26`);
  svg.innerHTML = birthBins.map((v, i) => { const h = v ? 2 + (v / top) * 24 : 0; return `<rect data-y="${trackMin + i * 5}" x="${i + 0.12}" y="${26 - h}" width="0.76" height="${h}" rx="0.2"/>`; }).join('');
  const ticks: string[] = [];
  for (let y = Math.ceil(trackMin / 100) * 100; y <= max; y += 100) ticks.push(`<span style="left:${((y - trackMin) / (max - trackMin)) * 100}%">${y}</span>`);
  $('#track-ticks').innerHTML = ticks.join('');
  $('#track').setAttribute('aria-valuemin', String(trackMin));
  $('#track').setAttribute('aria-valuemax', String(max));
}

// ---------------------------------------------------------------- focus and selection
function focusIds(ids: string[] | null, frame = true) {
  river.setFocus(ids);
  document.querySelector('.world')?.classList.toggle('few', Boolean(ids && ids.length <= 14));
  if (ids && frame) river.frameIds(ids, ids.length <= 3 ? 1.8 : 2.4);
}
function select(id: string | null, reveal = true) {
  if (state.composing && id) { pickForDraft(id); return; }
  if (id) stopWalk();
  const hadCard = Boolean(state.card || state.lead);
  state.selected = id;
  river.setSelected(id);
  if (!id) {
    if (state.record?.kind === 'person' || state.record?.kind === 'family') closeRecord();
    if (!state.card && !state.lead) focusIds(null, false);
    writeHash();
    return;
  }
  stop();
  $('#hint').hidden = true;
  const p = P.get(id)!;
  state.card = null; state.lead = null; state.line = null;
  if (hadCard) renderTab();
  const lit = new Set<string>([id, ...ancestorsOf(id), ...descendantsOf(id)]);
  for (const fid of p.fams) for (const q of F.get(fid)!.partners) lit.add(q);
  river.setFocus(lit);
  document.querySelector('.world')?.classList.remove('few');
  const sp = L.spots.get(id)!;
  if (state.year < sp.year) setYear(sp.year);
  openRecord({ kind: 'person', id });
  if (reveal) river.reveal(id);
  writeHash();
}
let birthOrder: string[] = [];
/** Keyboard route to every light: with the river focused, up and down walk people in birth order. */
function stepPerson(dir: number) {
  if (!birthOrder.length) birthOrder = data.people.filter((p) => !p.living).sort((a, b) => a.b!.y - b.b!.y || (a.id < b.id ? -1 : 1)).map((p) => p.id);
  let i = state.selected ? birthOrder.indexOf(state.selected) : -1;
  if (i < 0) i = dir > 0 ? birthOrder.findIndex((id) => P.get(id)!.b!.y >= state.year) - 1 : birthOrder.findIndex((id) => P.get(id)!.b!.y > state.year);
  if (i < -1) i = birthOrder.length - 1;
  const next = birthOrder[Math.max(0, Math.min(birthOrder.length - 1, i + dir))];
  if (next) { select(next); setYear(Math.max(state.year, P.get(next)!.b!.y)); }
}
function selectLine(name: string | null) {
  select(null);
  state.card = null; state.lead = null;
  state.line = name;
  state.tab = 'lines';
  if (state.record) closeRecord();
  renderTab();
  if (name) { focusIds(lineInfo(name).ids); openSheet(false); } else focusIds(null, false);
  writeHash();
}
function hover(id: string | null, x: number, y: number) {
  const tip = $('#tip');
  if (!id || matchMedia('(hover: none)').matches) { tip.hidden = true; return; }
  const p = P.get(id)!;
  tip.innerHTML = p.living ? `<b>A living relative</b><small>Kept private</small>` : `<b>${esc(p.name)}</b><small>${esc(lifeText(p))}</small>`;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth - r.width - 8, x + 14) + 'px';
  tip.style.top = Math.max(8, y - r.height - 12) + 'px';
}
function showStream(s: Stream, frame = false) {
  if (state.composing) return;
  stopWalk();
  select(null);
  const hadCard = Boolean(state.card || state.lead);
  state.card = null; state.lead = null;
  if (hadCard) renderTab();
  const ids = s.minor ? streamTree(s).flatMap((x) => x.members) : lineInfo(s.line).ids;
  focusIds(ids, frame);
  const first = s.chain.map((id) => P.get(id)!).find((p) => !p.living);
  toast(`${s.name || 'This'} stream: ${ids.length} people${first ? `, from ${first.name}` : ''}`);
}

// ---------------------------------------------------------------- panel: tabs
function allCards(): EvidenceCard[] {
  return [...drafts.map((d) => ({ ...d, draft: true as const })), ...CARDS];
}
function renderTab() {
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  const body = $('#panel-body');
  if (state.tab === 'case') body.innerHTML = caseHtml();
  else if (state.tab === 'leads') body.innerHTML = leadsHtml();
  else body.innerHTML = linesHtml();
  body.scrollTop = 0;
}
function cardHtml(c: EvidenceCard): string {
  const on = state.card === c.id;
  return `<div class="card${on ? ' on' : ''}" data-card="${esc(c.id)}" role="button" tabindex="0" aria-expanded="${on}">
    <span class="chip ${c.status}">${STATUS_LABEL[c.status]}</span>${c.draft ? '<span class="chip draft">Your draft, not in Iris</span>' : ''}
    <span class="t">${esc(c.title)}</span>
    <span class="b clip">${esc(c.body)}</span>
    <span class="more">${c.source ? `<b style="color:var(--ink-2);font-weight:500">Rests on:</b> ${esc(c.source)}` : ''}
      <span class="who">${chips(c.people)}</span>
      ${c.draft ? `<span class="actions"><button class="btn" data-copy="${esc(c.id)}">Copy the change request</button><button class="btn quiet" data-edit="${esc(c.id)}">Edit</button><button class="btn quiet" data-del="${esc(c.id)}">Delete</button></span>` : ''}
    </span>
  </div>`;
}
function caseHtml(): string {
  const head = proofHeadPerson();
  const hard = L.breaks.filter((b) => !SOFT_BREAKS.includes(b.child));
  const gens = head ? (L.spots.get(head.id)?.gen ?? 0) : 0;
  const oldest = P.get(L.trunk.chain[0]);
  const below = L.trunk.chain.slice(head ? L.trunk.chain.indexOf(head.id) : 0).map((id) => P.get(id)!).filter((p) => !p.living);
  const bare = below.filter((p) => p.sourced === 'none').length;
  return `
    <div class="kicker">Open case</div>
    <h2>${esc(CASE.question)}</h2>
    <p class="lede">${esc(CASE.summary)}</p>
    <div class="proofline">Following the Barlow stream upriver, no link is in doubt for <b>${gens} generations</b>, back to <b>${esc(head?.name)}</b>${head?.b ? ` (${esc(bornText(head))})` : ''}. Above that there ${hard.length === 1 ? 'is <b>1 break</b>' : `are <b>${hard.length} breaks</b>`} before ${esc(oldest?.name)}, ${esc(oldest?.b?.text)}. Broken water is drawn dashed or dotted.${bare ? ` Not in doubt is not the same as proven: ${bare} of the named ancestors on that stretch cite no source yet. The certainty lens shows which.` : ''}${SOFT_BREAKS.length ? ' One finely scored stretch lies below the flag: there the doubt is which of two brothers is the ancestor, and either answer keeps the line.' : ''}
      <div class="actions" style="margin-top:10px"><button class="btn" data-act="walk">${walking ? 'Stop the walk' : 'Walk the evidence'}</button></div></div>
    <div class="cards">${allCards().map(cardHtml).join('')}</div>
    <h3>How to test it</h3>
    <ul class="tests">${TESTS.map((t) => `<li class="${t.done ? 'done' : ''}"><span>${esc(t.text)}</span></li>`).join('')}</ul>
    <button class="btn wide" data-act="compose">Add a piece of evidence</button>
    <h3>How certainty is worked out</h3>
    ${ruleHtml()}
    <p class="fine">Case file taken from the Iris document “Hypothesis: the original Barlow village”, last reviewed ${esc(CASE.reviewed)}. Tree data exported from Iris on ${esc(data.meta.exportedAt)}. ${data.meta.counts.living} living people are in the tree and are shown only as unnamed lights.</p>`;
}
function ruleHtml(): string {
  const row = (k: keyof typeof TIER_COLOUR, text: string) => `<div><i style="background:${TIER_COLOUR[k]}"></i><span><b>${TIER_LABEL[k]}.</b> ${text}</span></div>`;
  return `<div class="rule">Each link from a child up to their parents gets one of these, by rule, from what is written in the tree.
    ${row('record', 'The person cites a parish register, will, census or similar. This shows a record exists. It is not proof of the link unless a card above says so.')}
    ${row('compiled', 'The only source is someone else’s tree (FamilySearch, MyHeritage).')}
    ${row('none', 'Nothing is cited.')}
    ${row('doubt', 'The tree itself says hypothesis, probable, unverified, unproven or unconfirmed.')}
    ${row('disputed', 'The tree marks the link disputed.')}
    ${row('known', 'Living people. Not assessed.')}
  </div>`;
}
const LEAD_KIND: Record<string, string> = {
  'young-parent': 'Impossible age', 'after-death': 'Dates collide', duplicate: 'Possible duplicate', 'old-parent': 'Unlikely age',
  'young-marriage': 'Unlikely age', 'long-life': 'Very long life', 'name-reuse': 'A name used twice', flag: 'Living or not?', unsourced: 'No sources', undated: 'No dates',
};
function leadsHtml(): string {
  const list = (items: typeof data.leads, fact: boolean) => items.map((l) => {
      const on = state.lead === l.id;
      const few = l.people.length <= 8;
      return `<div class="card${on ? ' on' : ''}" data-lead="${esc(l.id)}" role="button" tabindex="0" aria-expanded="${on}">
        <span class="chip ${fact ? 'fact' : 'lead'}">${esc(fact ? 'The tree shows' : LEAD_KIND[l.kind] ?? 'Lead')}</span>
        <span class="t">${esc(l.title)}</span>
        <span class="b clip">${esc(l.body)}</span>
        <span class="more">${few ? `<span class="who">${chips(l.people)}</span>` : `<span class="who">${chips(l.people.filter((id) => !P.get(id)!.living).slice(0, 6))}</span>${l.people.length} people are lit on the river. These are the first few.`}</span>
      </div>`;
    }).join('');
  return `
    <div class="kicker">Findings</div>
    <h2>What the river shows</h2>
    <p class="lede">Counted from the tree by rule, not written by a person. Recorded dates only, and only the dead.</p>
    <div class="cards">${list(data.facts, true)}</div>
    <h3>Worth a second look</h3>
    <p class="lede">Places where one record could change the picture. Some will turn out to be nothing.</p>
    <div class="cards">${list(data.leads, false)}</div>
    <button class="btn wide quiet" data-act="surprise">Surprise me</button>`;
}
function lineInfo(name: string) {
  const main = L.streams.filter((s) => !s.minor && s.line === name && s.kind !== 'oxbow');
  const all = L.streams.filter((s) => s.line === name && s.kind !== 'oxbow' && !s.cut);
  const ids = [...new Set(all.flatMap((s) => s.members))];
  const dead = ids.map((id) => P.get(id)!).filter((p) => !p.living);
  const head = main.flatMap((s) => s.chain).map((id) => P.get(id)!).filter((p) => !p.living).sort((a, b) => a.b!.y - b.b!.y)[0];
  const regs = new Map<string, number>();
  for (const p of dead) if (p.region && !p.regionInferred) regs.set(p.region, (regs.get(p.region) ?? 0) + 1);
  const places = [...regs].sort((a, b) => b[1] - a[1]).slice(0, 3).map((r) => r[0]);
  const join = main.filter((s) => s.into).sort((a, b) => b.joinX - a.joinX)[0];
  return { main, ids, dead, head, places, join, minors: all.filter((s) => s.minor && s.name && s.members.length > 1) };
}
/** When a stream joins. Marriages of living people are never dated, even by estimate. */
function joinWhen(s: Stream): string {
  const f = s.joinFam ? F.get(s.joinFam) : undefined;
  if (!f || f.partners.some((id) => P.get(id)!.living)) return 'within living memory';
  return f.m ? `in ${f.m.y}` : `around ${Math.round(s.joinX)}`;
}
function linesHtml(): string {
  return `
    <div class="kicker">The seven lines</div>
    <h2>Where the water comes from</h2>
    <p class="lede">Each named line is a stream. It starts at its earliest known person and joins the next stream at a marriage. Smaller springs that feed a line take its colour.</p>
    <div class="cards">${LINES.map((name) => {
      const i = lineInfo(name);
      if (!i.ids.length) return '';
      const into = i.join?.into;
      return `<button class="linecard${state.line === name ? ' on' : ''}" data-line="${name}" aria-pressed="${state.line === name}"><i style="background:${LINE_COLOUR[name]}"></i><span>
        <span class="t">${name}</span>
        <span class="m">${i.ids.length} people${i.ids.length - i.dead.length ? `, ${i.ids.length - i.dead.length} living` : ''}. ${i.head ? `Earliest: ${esc(i.head.name)}, ${esc(bornText(i.head))}.` : ''}
        ${i.places.length ? esc(i.places.join(', ')) + '.' : ''}
        ${name === 'Barlow' ? 'The trunk.' : into && i.join ? `Joins ${esc(into.line === name ? 'the main stream' : 'the ' + into.line + ' stream')} ${joinWhen(i.join)}.` : ''}
        ${i.minors.length ? `<br>Fed by ${esc(i.minors.slice(0, 7).map((s) => s.name).join(', '))}${i.minors.length > 7 ? ' and others' : ''}.` : ''}</span>
      </span></button>`;
    }).join('')}</div>
    <p class="fine">Streams are drawn from the tree itself: the river is the ancestry of the youngest generation, and every joining of two streams is a real marriage placed at its year. Where the year is not recorded it is estimated from the first child.</p>`;
}

// ---------------------------------------------------------------- panel: record
function openRecord(r: NonNullable<typeof state.record>) {
  state.record = r;
  const el = $('#record');
  el.hidden = false;
  if (r.kind === 'person') el.innerHTML = personHtml(P.get(r.id!)!);
  else if (r.kind === 'family') el.innerHTML = familyHtml(F.get(r.id!)!);
  else if (r.kind === 'compose') el.innerHTML = composeHtml();
  el.scrollTop = 0;
  // restart the slide-in
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  openSheet(true);
  $('#panel-body').inert = true;
  (document.querySelector('.tabs') as HTMLElement).inert = !isSmall();
  if (document.activeElement && document.activeElement !== document.body && !el.contains(document.activeElement) && !(document.activeElement as HTMLElement).matches('#search, #river')) (el.querySelector('.back') as HTMLElement | null)?.focus({ preventScroll: true });
  if (r.kind === 'family') {
    const f = F.get(r.id!)!;
    focusIds([...f.partners, ...f.children]);
  }
}
function closeRecord() {
  state.record = null;
  $('#record').hidden = true;
  $('#panel-body').inert = false;
  (document.querySelector('.tabs') as HTMLElement).inert = false;
  if (state.composing) {
    // keep what was typed so an accidental exit does not lose it
    readCompose();
    const d = state.composing;
    if (d.title.trim() || d.body.trim() || d.source.trim()) { stash = d; toast('Draft kept. Open “Add a piece of evidence” to carry on.'); }
    state.composing = null;
    document.body.classList.remove('picking');
    river.setFocus(null);
  }
}
let stash: Draft | null = null;
function relationHtml(p: Person): string {
  const sp = L.spots.get(p.id)!;
  const colour = LINE_COLOUR[sp.stream.line];
  const where = sp.stream.cut || sp.stream.kind === 'oxbow' ? 'Cut-off water' : `${sp.stream.name || sp.stream.line} stream`;
  const rel = sp.anc && sp.gen ? `${ancestorLabel(sp.gen, p.sex)} of the youngest generation` : sp.stream.kind === 'oxbow' ? 'Not connected to the river' : 'Not a direct ancestor';
  return `<span class="badge"><i style="background:${colour}"></i>${esc(where)}</span><span class="badge">${esc(rel)}</span>`;
}
function personHtml(p: Person): string {
  if (p.living) {
    return `<button class="back" data-act="back">← Back</button>
      <div class="rec"><div class="rec-head"><div class="avatar">◆</div><div><h2>A living relative</h2><div class="life">Kept private</div></div></div>
      <p>The tree holds ${data.meta.counts.living} living people. They are drawn as unnamed lights so the river reaches the present, and nothing about them is stored in this page: no name, no dates, no places.</p></div>`;
  }
  const par = p.parents ? F.get(p.parents) : undefined;
  const tier = p.tier;
  const initial = (p.given ?? p.name ?? '?')[0];
  const fams = p.fams.map((fid) => F.get(fid)!);
  const kv: string[] = [];
  if (p.b) kv.push(`<dt>${p.b.kind === 'bap' ? 'Baptised' : 'Born'}</dt><dd>${p.b.est ? `About ${p.b.y}<small>Not recorded. Estimated from relatives.</small>` : esc(p.b.text)}${p.b.place ? `<small>${esc(p.b.place)}</small>` : ''}</dd>`);
  if (p.d && !p.d.est) kv.push(`<dt>${p.d.kind === 'bur' ? 'Buried' : 'Died'}</dt><dd>${esc(p.d.text)}${p.d.place ? `<small>${esc(p.d.place)}</small>` : ''}${p.b && !p.b.est && p.d.y >= p.b.y ? `<small>Aged about ${p.d.y - p.b.y}</small>` : ''}</dd>`);
  else kv.push(`<dt>Died</dt><dd><small>Not recorded</small></dd>`);
  if (p.occupation) kv.push(`<dt>Work</dt><dd>${esc(p.occupation)}</dd>`);
  if (p.married?.length) kv.push(`<dt>Married name</dt><dd>${esc(p.married.join(', '))}</dd>`);
  if (p.variants?.length) kv.push(`<dt>Also written</dt><dd>${esc(p.variants.join('; '))}</dd>`);
  if (p.region) kv.push(`<dt>Place</dt><dd>${esc(p.region)}${p.regionInferred ? '<small>Inferred from close relatives</small>' : ''}</dd>`);
  const events = (p.events ?? []).filter((e) => !(e.tag === 'OCCU' && e.value === p.occupation)).sort((a, b) => (a.y ?? 9999) - (b.y ?? 9999));
  return `<button class="back" data-act="back">← Back</button>
  <div class="rec">
    <div class="rec-head">
      ${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;avatar&quot;>${esc(initial)}</div>'">` : `<div class="avatar">${esc(initial)}</div>`}
      <div><h2>${esc(p.name)}</h2><div class="life">${esc(lifeText(p))}</div></div>
    </div>
    <div class="badges">${relationHtml(p)}</div>
    ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
    <div class="actions">
      ${L.route(p.id).length > 1 ? '<button class="btn solid" data-act="follow">Follow the water</button>' : '<span class="badge">This water does not reach the river</span>'}
      <button class="btn quiet" data-act="goyear" data-y="${p.b?.y}">Go to ${p.b?.y}</button>
    </div>
    <h3>Record</h3>
    <dl class="kv">${kv.join('')}</dl>
    <h3>Family</h3>
    <div class="fam">
      ${par ? `<div class="row"><span>Parents</span>${chips(par.partners) || '<span>not recorded</span>'}</div>
        <div class="row"><span>Link</span><span class="chip t-${tier ?? 'none'}">${TIER_LABEL[tier ?? 'none']}</span>${p.tierWhy ? `<span style="flex-basis:100%;padding-left:68px;color:var(--ink-2)">“${esc(p.tierWhy)}”</span>` : ''}</div>`
      : `<div class="row"><span>Parents</span><span>Not known. This is where a stream rises.</span></div>`}
      ${fams.map((f) => {
        const others = f.partners.filter((x) => x !== p.id);
        return `<div class="row"><span>Partner</span>${chips(others) || '<span>not recorded</span>'}${f.m ? `<span>m. ${esc(f.m.text)}${f.m.place ? ', ' + esc(f.m.place.split(',')[0]) : ''}</span>` : ''}</div>
        ${f.children.length ? `<div class="row"><span>Children</span>${chips(f.children)}</div>` : ''}`;
      }).join('')}
    </div>
    ${events.length ? `<h3>Life</h3><dl class="kv">${events.map((e) => `<dt>${esc(e.date ?? e.label)}</dt><dd>${e.date ? esc(e.label) : ''}${e.value ? `${e.date ? ': ' : ''}${esc(e.value)}` : ''}${e.place ? `<small>${esc(e.place)}</small>` : ''}${e.note ? `<small>${esc(e.note)}</small>` : ''}</dd>`).join('')}</dl>` : ''}
    <h3>Sources</h3>
    ${p.cites?.length ? `<ul class="cites">${p.cites.map((c) => `<li><b>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source)}</a>` : esc(c.source)}</b>${c.detail ? esc(c.detail) : ''}</li>`).join('')}</ul>` : `<p style="margin:0">Nothing is cited for this person yet.</p>`}
    ${p.notes?.length ? `<h3>Research notes</h3><ul class="notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <div class="actions">
      <button class="btn quiet" data-act="compose" data-about="${esc(p.id)}">Add evidence about ${esc((p.given ?? p.name ?? '').split(' ')[0])}</button>
      ${p.iris ? `<a class="btn quiet" href="https://iris-uat.chrisbarlow.nz/elements/${esc(p.iris)}" target="_blank" rel="noopener">Open in Iris</a>` : ''}
    </div>
  </div>`;
}
function familyHtml(f: Family): string {
  const s = L.streams.find((x) => x.joinFam === f.id);
  const people = f.partners.map((id) => P.get(id)!);
  const anyLiving = people.some((p) => p.living);
  const named = people.filter((p) => !p.living).map((p) => p.name!);
  const title = named.length === 2 ? named.join(' and ') : named.length === 1 ? `${named[0]} and a living partner` : 'A living couple';
  return `<button class="back" data-act="back">← Back</button>
  <div class="rec">
    <div class="kicker">Where two streams join</div>
    <h2>${esc(title)}</h2>
    <div class="life">${anyLiving ? 'Within living memory. Details are kept private.' : f.m ? `Married ${esc(f.m.text)}${f.m.place ? ', ' + esc(f.m.place) : ''}` : `Marriage not recorded. Placed around ${f.estY}, from the first child.`}</div>
    ${s && s.into ? `<p>${(s.name || s.line) === (s.into.name || s.into.line) ? `A second ${esc(s.name || s.line)} stream joins the first here.` : `The ${esc(s.name || s.line)} stream joins the ${esc(s.into.name || s.into.line)} stream here.`}</p>` : ''}
    ${named.length ? `<h3>The couple</h3><div class="fam"><div class="row">${chips(f.partners)}</div></div>` : ''}
    ${f.children.length ? `<h3>Children</h3><div class="fam"><div class="row">${chips(f.children)}</div></div>` : ''}
    ${f.note ? `<h3>Research notes</h3><p>${esc(f.note)}</p>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- evidence composer
function startCompose(about?: string) {
  if (!stash) { try { const saved = JSON.parse(localStorage.getItem(COMPOSE_KEY) ?? 'null'); if (saved?.id) stash = { ...saved, people: (saved.people ?? []).filter((id: string) => P.has(id) && !P.get(id)!.living) }; } catch { /* nothing saved */ } }
  state.composing = stash ?? { id: 'draft-' + Date.now().toString(36), status: 'doubt', title: '', body: '', source: '', url: '', people: [], link: 'none', year: about ? L.spots.get(about)!.year : state.year };
  stash = null;
  if (about && !state.composing.people.includes(about)) state.composing.people.push(about);
  state.selected = null; river.setSelected(null);
  river.setFocus(state.composing.people.length ? state.composing.people : null);
  document.body.classList.add('picking');
  openRecord({ kind: 'compose' });
}
function pickForDraft(id: string) {
  const d = state.composing!;
  if (P.get(id)!.living) { toast('Living people cannot be attached to evidence here'); return; }
  d.people = d.people.includes(id) ? d.people.filter((x) => x !== id) : [...d.people, id];
  syncCompose();
}
const COMPOSE_KEY = 'river.compose.v1';
function keepCompose() { try { if (state.composing) localStorage.setItem(COMPOSE_KEY, JSON.stringify(state.composing)); else localStorage.removeItem(COMPOSE_KEY); } catch { /* private mode */ } }
function readCompose() {
  const d = state.composing!;
  const form = $('#record');
  const read = (n: string) => (form.querySelector(`[name="${n}"]`) as HTMLInputElement | null)?.value ?? '';
  if (form.querySelector('[name="title"]')) { d.title = read('title'); d.body = read('body'); d.source = read('source'); d.url = read('url'); d.link = read('link') as Draft['link']; }
}
function syncCompose() {
  const d = state.composing!;
  const form = $('#record');
  readCompose();
  form.innerHTML = composeHtml();
  keepCompose();
  river.setFocus(d.people.length ? d.people : null);
}
function composeHtml(): string {
  const d = state.composing!;
  const st = (s: Status, label: string) => `<button type="button" data-status="${s}" aria-pressed="${d.status === s}">${label}</button>`;
  const firstChild = d.people.find((id) => P.get(id)?.parents);
  return `<button class="back" data-act="back">← Back to the case</button>
  <div class="kicker">New evidence</div>
  <h2>Add a piece of evidence</h2>
  <p class="lede">This page only reads the tree. Your card is kept in this browser as a draft, and you can copy a change request to apply in Iris.</p>
  <div class="form">
    <label>What does it show?<input name="title" maxlength="90" placeholder="Francis Barlow made a freeman of Norwich, 1651" value="${esc(d.title)}"></label>
    <div class="seg3" role="group" aria-label="Status">${st('proven', 'Proven')}${st('doubt', 'In doubt')}${st('ruledout', 'Ruled out')}</div>
    <label>What the record says<textarea name="body" placeholder="Quote or describe the record, and what follows from it.">${esc(d.body)}</textarea></label>
    <label>Source<input name="source" placeholder="Norwich freemen rolls, Norfolk Record Office" value="${esc(d.source)}"></label>
    <label>Link to the source, if there is one<input name="url" type="url" placeholder="https://" value="${esc(d.url)}"></label>
    <label style="gap:7px">Who it bears on
      <span class="picked">${d.people.length ? d.people.map((id) => `<button type="button" data-unpick="${esc(id)}">${esc(nameOf(id))} ×</button>`).join('') : 'Tap people on the river to attach them.'}</span>
    </label>
    <label>What should change in the tree?
      <select name="link">
        ${[['none', 'Nothing. Add the citation only'], ['confirm', 'Mark a link to parents as proven'], ['doubt', 'Mark a link to parents as in doubt'], ['dispute', 'Mark a link to parents as disputed'], ['remove', 'Remove a link to parents']].map(([v, t]) => `<option value="${v}"${d.link === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
    </label>
    ${d.link !== 'none' ? `<p class="fine" style="margin:0">${firstChild ? `The link is ${esc(nameOf(firstChild))} to ${esc(F.get(P.get(firstChild)!.parents!)!.partners.map(nameOf).join(' and ') || 'their parents')}. Attach the child first to change which link.` : 'Attach the child whose link to their parents this changes.'}</p>` : ''}
    <button class="btn solid" data-act="savedraft">Save as a draft card</button>
  </div>`;
}
function saveDraft() {
  syncCompose();
  const d = state.composing!;
  if (!d.title.trim()) { toast('Give the evidence a title first'); return; }
  drafts = [d, ...drafts.filter((x) => x.id !== d.id)];
  saveDrafts(drafts);
  state.composing = null; stash = null; keepCompose();
  document.body.classList.remove('picking');
  closeRecord();
  state.tab = 'case';
  openCard(d.id);
  toast('Saved as a draft in this browser');
}
function draftRequest(id: string): string {
  const d = drafts.find((x) => x.id === id)!;
  return changeRequest(d, {
    name: nameOf,
    iris: (pid) => P.get(pid)?.iris,
    parents: (pid) => { const f = P.get(pid)?.parents ? F.get(P.get(pid)!.parents!) : undefined; return f ? { id: f.id, names: f.partners.map(nameOf) } : undefined; },
    line: (pid) => L.spots.get(pid)?.stream.line ?? 'Barlow',
  });
}

// ---------------------------------------------------------------- cards
function openCard(id: string, frame = true, keepYear = false) {
  const card = allCards().find((c) => c.id === id);
  if (!card || state.composing) return;
  stop();
  if (state.record) closeRecord();
  state.selected = null; river.setSelected(null);
  state.card = state.card === id && frame ? null : id;
  state.lead = null; state.line = null;
  state.tab = 'case';
  renderTab();
  openSheet(true);
  if (state.card) {
    const ids = card.people.filter((x) => L.spots.has(x));
    if (state.year < card.year && !keepYear) setYear(Math.min(data.meta.thisYear, card.year + 30));
    focusIds(ids.length ? ids : null, frame);
    document.querySelector(`[data-card="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  } else focusIds(null, false);
  writeHash();
}
function openLead(id: string) {
  const lead = [...data.facts, ...data.leads].find((l) => l.id === id);
  if (!lead || state.composing) return;
  stop();
  state.selected = null; river.setSelected(null);
  state.lead = state.lead === id ? null : id;
  state.card = null; state.line = null;
  if (state.record) closeRecord();
  writeHash();
  state.tab = 'leads';
  const top = $('#panel-body').scrollTop;
  renderTab();
  $('#panel-body').scrollTop = top;
  if (state.lead) {
    if (state.year < lead.y + 10) setYear(Math.min(data.meta.thisYear, lead.y + 40));
    focusIds(lead.people, lead.people.length <= 40);
    if (lead.people.length > 40) river.fit();
  } else focusIds(null, false);
}
/** Step up the trunk from the head of proof through each break, one card at a time. */
function walkEvidence() {
  const order = ['weaver', 'which-peter', 'noah-john', 'noah', 'staffordshire', 'ranulph', 'origin'];
  let i = 0;
  const next = () => {
    if (!walking) return;
    if (i >= order.length) { walking = false; if (state.tab === 'case' && !state.record) { const top = $('#panel-body').scrollTop; renderTab(); $('#panel-body').scrollTop = top; } return; }
    state.card = null;
    openCard(order[i++]);
    if (i === 1) { const top = $('#panel-body').scrollTop; renderTab(); $('#panel-body').scrollTop = top; document.querySelector('.card.on')?.scrollIntoView({ block: 'nearest' }); }
    walkTimer = window.setTimeout(next, 5600);
  };
  walking = true;
  next();
}
let walking = false, walkTimer = 0;
function stopWalk() {
  if (!walking) return;
  walking = false; clearTimeout(walkTimer);
  const b = document.querySelector('[data-act="walk"]'); if (b) b.textContent = 'Walk the evidence';
}

// ---------------------------------------------------------------- legend
let legendBound = false;
function syncLegendPad() {
  if (!river) return;
  const pad = isSmall() ? 64 : $('#legend').offsetHeight + 46;
  if (Math.abs(pad - river.padBottom) < 2) return;
  const wasFit = river.isFit;
  river.padBottom = pad;
  if (wasFit) river.fit(false);
}
function renderLegend() {
  const sw = (c: string, t: string, attr = '') => `<span ${attr}><i style="background:${c}"></i>${esc(t)}</span>`;
  let html = '';
  if (state.lens === 'surname') html = LINES.map((l) => sw(LINE_COLOUR[l], l)).join('');
  else if (state.lens === 'place') {
    const used = new Set(data.people.map((p) => p.region).filter(Boolean));
    html = Object.entries(REGION_COLOUR).filter(([r]) => used.has(r)).map(([r, c]) => sw(c, r)).join('') + `<span class="opt"><i class="ring"></i>place inferred</span>`;
    if (data.people.some((p) => !p.living && !p.region)) html += sw('#5B6B83', 'Not known');
  } else html = (['record', 'compiled', 'none', 'doubt', 'disputed', 'known'] as const).map((t) => sw(TIER_COLOUR[t], TIER_LABEL[t])).join('') + `<button data-act="rule">How is this worked out?</button>`;
  html += `<span class="opt"><i class="dia"></i>living, private</span><span class="opt"><i class="ring"></i>date estimated</span><span class="opt"><i class="water" style="background:repeating-linear-gradient(90deg,#9FB0C6 0 5px,transparent 5px 9px)"></i>in doubt</span><span class="opt"><i class="water" style="background:repeating-linear-gradient(90deg,#9FB0C6 0 2px,transparent 2px 5px)"></i>disputed</span><span class="opt"><i class="water" style="background:repeating-linear-gradient(90deg,#9FB0C6 0 6px,transparent 6px 7px)"></i>which of two</span>`;
  $('#legend').innerHTML = html;
  requestAnimationFrame(syncLegendPad);
  if (!legendBound) { legendBound = true; if (isSmall()) $('#legend').classList.add('collapsed'); $('#legend').addEventListener('click', (e) => { if (isSmall() && !(e.target as HTMLElement).closest('button')) $('#legend').classList.toggle('collapsed'); }); }
}

// ---------------------------------------------------------------- search
function bindSearch() {
  const input = $<HTMLInputElement>('#search'), list = $('#results');
  const index = data.people.filter((p) => !p.living).map((p) => ({ p, key: fold([p.name, ...(p.married ?? []), ...(p.variants ?? [])].join(' ')) }));
  let hits: Person[] = [], cur = 0;
  const draw = () => {
    list.hidden = !input.value.trim();
    input.setAttribute('aria-expanded', String(!list.hidden));
    list.innerHTML = hits.length
      ? hits.map((p, i) => `<li role="option" id="opt-${i}" data-id="${esc(p.id)}" aria-selected="${i === cur}"><span>${esc(p.name)}</span><small>${esc(shortLife(p))}</small></li>`).join('')
      : `<li class="none">No one of that name among the ${data.meta.counts.deceased} people shown. Living people cannot be searched.</li>`;
  };
  input.addEventListener('input', () => {
    const q = fold(input.value.trim()).split(/\s+/).filter(Boolean);
    hits = q.length ? index.filter((x) => q.every((w) => x.key.includes(w))).map((x) => x.p).sort((a, b) => Number(L.spots.get(b.id)!.anc) - Number(L.spots.get(a.id)!.anc) || a.b!.y - b.b!.y).slice(0, 30) : [];
    cur = 0; draw();
  });
  const choose = (id: string) => { input.value = ''; list.hidden = true; input.blur(); select(id); };
  const showCur = () => { const li = list.querySelector('[aria-selected="true"]') as HTMLElement | null; li?.scrollIntoView({ block: 'nearest' }); if (li) input.setAttribute('aria-activedescendant', li.id); else input.removeAttribute('aria-activedescendant'); };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { cur = Math.min(hits.length - 1, cur + 1); draw(); showCur(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); draw(); showCur(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[cur]) choose(hits[cur].id);
    else if (e.key === 'Escape') { input.value = ''; list.hidden = true; input.blur(); }
    e.stopPropagation();
  });
  list.addEventListener('pointerdown', (e) => { const li = (e.target as Element).closest('li[data-id]') as HTMLElement | null; if (li) { e.preventDefault(); choose(li.dataset.id!); } });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  input.parentElement!.addEventListener('click', () => input.focus());
}

// ---------------------------------------------------------------- chrome
function openSheet(open: boolean) { if (isSmall()) { $('#panel').classList.toggle('open', open); syncInset(); } }
function syncInset() {
  const small = isSmall();
  const open = $('#panel').classList.contains('open');
  const stage = $('#stage').getBoundingClientRect();
  const panel = $('#panel').getBoundingClientRect();
  river.inset.bottom = small && open ? Math.max(0, stage.bottom - (innerHeight - panel.height)) : 0;
}
function bindChrome() {
  const lensBtns = [...document.querySelectorAll<HTMLElement>('.lens button')];
  lensBtns.forEach((b, i) => {
    b.addEventListener('click', () => setLens(b.dataset.lens as Lens));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const n = lensBtns[(i + d + lensBtns.length) % lensBtns.length];
      n.focus(); setLens(n.dataset.lens as Lens);
    });
  });
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.addEventListener('click', () => {
    stopWalk();
    const same = state.tab === b.dataset.tab && $('#panel').classList.contains('open');
    state.tab = b.dataset.tab as typeof state.tab;
    if (state.record) closeRecord();
    renderTab();
    openSheet(!same);
  }));
  $('#grab').addEventListener('click', () => openSheet(!$('#panel').classList.contains('open')));
  $('#play').addEventListener('click', () => { stopWalk(); state.playing ? stop() : play(); });
  $('#zin').addEventListener('click', () => river.zoomBy(1.5));
  $('#zout').addEventListener('click', () => river.zoomBy(1 / 1.5));
  $('#zfit').addEventListener('click', () => river.fit());

  // timeline track
  const track = $('#track');
  const at = (e: PointerEvent) => { const r = track.getBoundingClientRect(); return trackMin + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (data.meta.thisYear - trackMin); };
  let dragging = false;
  track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); stop(); stopWalk(); $('#hint').hidden = true; river.resumeFollow(); setYear(at(e)); });
  track.addEventListener('pointermove', (e) => { if (dragging) setYear(at(e)); });
  track.addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('pointercancel', () => { dragging = false; });
  track.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { stop(); setYear(state.year - step); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowRight') { stop(); setYear(state.year + step); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowDown') { stop(); setYear(state.year - step); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowUp') { stop(); setYear(state.year + step); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'PageDown') { stop(); setYear(state.year - 25); e.preventDefault(); }
    if (e.key === 'PageUp') { stop(); setYear(state.year + 25); e.preventDefault(); }
  });

  // delegated clicks in the panel and legend
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const go = t.closest<HTMLElement>('[data-go]');
    if (go) { stopWalk(); if (state.composing) pickForDraft(go.dataset.go!); else select(go.dataset.go!); return; }
    const copy = t.closest<HTMLElement>('[data-copy]');
    if (copy) { e.stopPropagation(); const text = draftRequest(copy.dataset.copy!); navigator.clipboard?.writeText(text).then(() => toast('Change request copied'), () => showRequest(text)) ?? showRequest(text); return; }
    const del = t.closest<HTMLElement>('[data-del]');
    if (del) { drafts = drafts.filter((d) => d.id !== del.dataset.del); saveDrafts(drafts); state.card = null; focusIds(null, false); renderTab(); return; }
    const edit = t.closest<HTMLElement>('[data-edit]');
    if (edit) { const d = drafts.find((x) => x.id === edit.dataset.edit); if (d) { stash = { ...d, people: [...d.people] }; state.card = null; startCompose(); } return; }
    const card = t.closest<HTMLElement>('[data-card]');
    if (card && !t.closest('a')) { stopWalk(); openCard(card.dataset.card!); return; }
    const lead = t.closest<HTMLElement>('[data-lead]');
    if (lead) { openLead(lead.dataset.lead!); return; }
    const line = t.closest<HTMLElement>('[data-line]');
    if (line) { selectLine(state.line === line.dataset.line ? null : line.dataset.line!); return; }
    const status = t.closest<HTMLElement>('[data-status]');
    if (status && state.composing) { syncCompose(); state.composing.status = status.dataset.status as Status; syncCompose(); return; }
    const unpick = t.closest<HTMLElement>('[data-unpick]');
    if (unpick && state.composing) { pickForDraft(unpick.dataset.unpick!); return; }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'back') { stopWalk(); const kind = state.record?.kind; closeRecord(); if (kind === 'person') select(null); else focusIds(null, false); if (kind === 'person' || kind === 'family') openSheet(false); }
    else if (act === 'follow' && state.selected) { river.fit(); setTimeout(() => river.followWater(state.selected!), reduceMotion ? 0 : 500); if (state.year < data.meta.thisYear) play(); openSheet(false); }
    else if (act === 'goyear') { stop(); setYear(Number(t.closest<HTMLElement>('[data-y]')!.dataset.y)); openSheet(false); }
    else if (act === 'compose') { stopWalk(); startCompose(t.closest<HTMLElement>('[data-about]')?.dataset.about); }
    else if (act === 'savedraft') saveDraft();
    else if (act === 'walk') { if (walking) stopWalk(); else walkEvidence(); }
    else if (act === 'rule') { state.tab = 'case'; if (state.record) closeRecord(); renderTab(); openSheet(true); document.querySelector('.rule')?.scrollIntoView({ block: 'center' }); }
    else if (act === 'help') { stopWalk(); showHelp(); }
    else if (act === 'surprise') { const pool = [...data.facts, ...data.leads].filter((l) => l.id !== state.lead); state.lead = null; openLead(pool[Math.floor(Math.random() * pool.length)].id); document.querySelector('.card.on')?.scrollIntoView({ block: 'nearest' }); }
  });
  $('#record').addEventListener('input', () => { if (state.composing) { readCompose(); keepCompose(); } });
  $('#record').addEventListener('change', (e) => { if (state.composing && (e.target as HTMLElement).matches('select')) syncCompose(); });
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('.card')) { t.click(); e.preventDefault(); return; }
    if (t.matches?.('input, textarea, select')) return;
    if ((e.key === ' ' || e.key === 'Enter') && t.closest?.('button, a, [role="button"]')) return;
    if (e.key === 'Home') { stop(); setYear(trackMin); e.preventDefault(); return; }
    if (e.key === 'End') { stop(); setYear(data.meta.thisYear); e.preventDefault(); return; }
    if (e.key === ' ') { state.playing ? stop() : play(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { stop(); setYear(state.year - (e.shiftKey ? 10 : 1)); }
    else if (e.key === 'ArrowRight') { stop(); setYear(state.year + (e.shiftKey ? 10 : 1)); }
    else if (e.key === '/') { $('#search').focus(); e.preventDefault(); }
    else if (e.key === '?') showHelp();
    else if (e.key === 'Escape') { stopWalk(); if (state.record) { closeRecord(); select(null); } else if (state.card || state.lead) { state.card = null; state.lead = null; focusIds(null, false); renderTab(); writeHash(); } else { focusIds(null, false); if (state.line) { state.line = null; renderTab(); writeHash(); } river.fit(); } }
    else if (e.key === '+' || e.key === '=') river.zoomBy(1.5);
    else if (e.key === '-') river.zoomBy(1 / 1.5);
    else if (e.key === '0') river.fit();
    else if (e.key === '1') setLens('surname');
    else if (e.key === '2') setLens('place');
    else if (e.key === '3') setLens('certainty');
  });
  addEventListener('hashchange', applyHash);
  addEventListener('resize', () => { syncInset(); syncLegendPad(); });
  bindSearch();
}
function showHelp() {
  if (state.composing) return;
  if (state.selected) select(null);
  state.record = { kind: 'rule' };
  const el = $('#record');
  el.hidden = false;
  const c = data.meta.counts;
  el.innerHTML = `<button class="back" data-act="back">← Back</button>
  <div class="kicker">A short guide</div>
  <h2>How to read the river</h2>
  <div class="rec guide">
    <p><b>Time runs left to right.</b> Drag the year, or press play. What lies ahead of the year is shown faintly. Before 1700, where people are few, a year is drawn half as wide.</p>
    <p><b>Each stream is a family line.</b> It starts with its earliest known person. Where two streams join, two people married. The Barlow stream is the trunk, and the river ends at the youngest generation alive today.</p>
    <p><b>Each light is a person.</b> Bright while they are alive, dark once they have died. Ringed lights are direct ancestors. A dashed ring means the birth year is an estimate.</p>
    <p><b>Diamonds are the living.</b> ${c.living} of the ${c.people} people in the tree are alive. They have no name, date or place here.</p>
    <p><b>Broken water is doubt.</b> Solid water is a link nobody questions. Whether it cites a source is what the certainty lens shows. Dashed water is a link the tree itself calls a hypothesis. Dotted water is disputed. Finely scored water is a doubt that does not break the line. The flag marks how far up the Barlow stream the evidence runs without a break.</p>
    <p><b>The lake is a dead end.</b> A family once thought to be ancestors, cut off when a will ruled them out. The three dotted springs at the far left are guesses at where the name came from.</p>
    <p><b>Some dates are guesses.</b> ${data.people.filter((p) => !p.living && p.d?.est).length} people have no recorded death. Their light goes out seventy years after birth. Their record says “not recorded”.</p>
    <h3>Things to try</h3>
    <p>Tap any light for the person’s record, then “Follow the water”. Switch the lens to see where people lived, or how well each link is sourced. Open a card in the case file. Zoom in to see names.</p>
    <h3>Keys</h3>
    <dl class="kv"><dt>Space</dt><dd>Play or pause</dd><dt>← →</dt><dd>One year. With Shift, ten</dd><dt>1 2 3</dt><dd>Surname, place, certainty</dd><dt>↑ ↓</dt><dd>With the river focused, step through people in birth order</dd><dt>/</dt><dd>Find a person</dd><dt>+ − 0</dt><dd>Zoom in, out, whole river</dd><dt>Esc</dt><dd>Close, clear</dd></dl>
    <p class="fine">Best in a browser from 2023 or later.</p>
  </div>`;
  el.scrollTop = 0;
  openSheet(true);
  $('#panel-body').inert = true;
}
function showRequest(text: string) {
  state.record = { kind: 'rule' };
  const el = $('#record');
  el.hidden = false;
  el.innerHTML = `<button class="back" data-act="back">← Back</button><div class="kicker">Change request</div><h2>Copy this into Iris</h2><pre class="req">${esc(text)}</pre>`;
}
function setLens(lens: Lens) {
  state.lens = lens;
  river.setLens(lens);
  document.querySelectorAll<HTMLElement>('.lens button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === lens)));
  renderLegend();
  writeHash();
}

// ---------------------------------------------------------------- url
/** The address bar was edited by hand, or back/forward was used. */
function applyHash() {
  stop(); stopWalk();
  if (state.record) closeRecord();
  state.year = data.meta.thisYear; state.lens = 'surname'; state.card = null; state.lead = null; state.line = null; state.selected = null;
  readHash();
  const sel = state.selected, card = state.card, lead = state.lead, line = state.line;
  state.card = null; state.lead = null; state.line = null;
  setLens(state.lens);
  river.setSelected(null); focusIds(null, false);
  setYear(state.year);
  renderTab();
  if (sel) select(sel); else if (card) openCard(card, true, true); else if (lead) openLead(lead); else if (line) selectLine(line); else river.fit();
}
let hashTimer = 0;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => {
    const q = new URLSearchParams();
    if (state.year < data.meta.thisYear) q.set('y', String(state.year));
    if (state.selected && !P.get(state.selected)?.living) q.set('p', state.selected);
    if (state.lens !== 'surname') q.set('lens', state.lens);
    if (state.card && !state.card.startsWith('draft-')) q.set('c', state.card);
    if (state.lead) q.set('f', state.lead);
    if (state.line) q.set('line', state.line);
    const s = q.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }, 250);
}
function readHash(): boolean {
  const q = new URLSearchParams(location.hash.slice(1));
  if (![...q.keys()].length) return false;
  const y = Number(q.get('y'));
  if (y) state.year = y;
  const lens = q.get('lens');
  if (lens === 'place' || lens === 'certainty' || lens === 'surname') { state.lens = lens; document.querySelectorAll<HTMLElement>('.lens button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === lens))); renderLegend(); }
  const p = q.get('p');
  state.selected = p && P.has(p) && !P.get(p)!.living ? p : null;
  const c = q.get('c');
  state.card = c && CARDS.some((x) => x.id === c) ? c : null;
  const f = q.get('f');
  state.lead = f && [...data.facts, ...data.leads].some((x) => x.id === f) ? f : null;
  const ln = q.get('line');
  state.line = ln && (LINES as readonly string[]).includes(ln) ? ln : null;
  return true;
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<p style="padding:40px;font:16px system-ui;color:#EAF0F7">The river could not be loaded. ${esc(String(err?.message ?? err))}</p>`;
});
