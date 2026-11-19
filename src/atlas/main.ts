// The Atlas page: the River's timelapse, drawn on the Earth.

import '../style.css';
import '../atlas.css';
import type { GeoPermissibleObjects } from 'd3-geo';
import land from './land.json';
import type { Family, Lead, Person, RiverData } from '../model/types.ts';
import type { AtlasData, AtlasPlace } from '../model/atlas-types.ts';
import { buildLayout, LINES, type Layout, type LineName } from '../model/layout.ts';
import { ageBetween, lifeLines } from '../model/kin.ts';
import { ROUTE_LABEL, type LonLat } from '../model/geo.ts';
import { whereAt, windowText, type Leg } from '../model/journey.ts';
import { BEATS, SOFT_BREAKS } from '../casefile.ts';
import { LINE_COLOUR, REGION_COLOUR } from '../river.ts';
import { World, type Actor, type Scene } from './scene.ts';
import { Stage, type Lands, type Pointer, type Star, type ViewKind } from './stage.ts';

type Lens = 'surname' | 'place' | 'certainty';
type View = ViewKind | 'both';
type Tab = 'journeys' | 'places' | 'people';
const CERT = { record: '#7BE0B5', borrowed: '#8FA3C2', vague: '#F2C14E', disputed: '#FF8A7A' };

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
const isSmall = () => matchMedia('(max-width: 900px) and (max-aspect-ratio: 13/10)').matches;
/** two maps side by side need this much width */
const tooNarrowForBoth = () => innerWidth < 1100;
const isSideways = () => matchMedia('(max-height: 520px) and (min-aspect-ratio: 13/10)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let river: RiverData, atlas: AtlasData, world: World, L: Layout;
let P: Map<string, Person>, F: Map<string, Family>;
let stages: Stage[] = [];
const lands: Lands = { coarse: land as unknown as GeoPermissibleObjects };
let trackMin = 1590, thisYear = 2026, peakYear = 1880;
/** records opened one from another, so Back returns to the one before */
const trail: { kind: 'person' | 'place' | 'country'; id: string }[] = [];
let lastScene: Scene | null = null;

const state = {
  year: 2026, playing: false, view: 'globe' as View, lens: 'surname' as Lens, tab: 'journeys' as Tab,
  selected: null as string | null, place: null as string | null, finding: null as string | null,
  country: null as string | null,
  /** a line, region or kind picked in the Key: only those people are lit */
  group: null as string | null,
  focus: null as Set<string> | null, follow: null as string | null,
  /** keep the selected person in view as the year moves, until the user takes the camera */
  track: null as string | null, record: null as 'person' | 'place' | 'country' | 'help' | null,
};

// ---------------------------------------------------------------- words
const lifeText = (p: Person) => {
  const b = p.b?.est ? `c. ${p.b.y}?` : (p.b?.kind === 'bap' || /\(baptism\b/i.test(p.b?.place ?? '') ? 'bapt. ' : '') + (p.b?.text ?? '?');
  const d = p.d && !p.d.est ? (p.d.kind === 'bur' ? 'bur. ' : '') + p.d.text : '';
  return d ? `${b} – ${d}` : `${p.b?.est || b.startsWith('bapt.') ? '' : 'b. '}${b}`;
};
const shortLife = (p: Person) => `${p.b?.est || p.b?.approx ? 'c.' : ''}${p.b?.y ?? '?'}${p.d && !p.d.est ? '–' + (/^after/i.test(p.d.text) ? 'after ' : p.d.approx ? 'c.' : '') + p.d.y : ''}`;
const lineOf = (id: string): LineName => L.spots.get(id)?.stream.line ?? 'Barlow';
const placeName = (id: string) => world.places.get(id)!.name;
const shortPlace = (id: string) => placeName(id).split(',')[0].replace(' (then Alexandra)', '');
const PREC: Record<string, string> = { parish: 'Known to the parish.', town: 'Known to the town or village.', area: 'Known only to the county or region. Drawn as a haze at its centre, not as a point.', country: 'Known only to the country. Drawn as a haze just offshore, marked “somewhere in”, so it cannot be mistaken for a town.' };

function colourOf(a: Actor): string {
  if (state.lens === 'place') return REGION_COLOUR[world.places.get(a.stays[0].p)!.region] ?? '#A9B7CB';
  if (state.lens === 'certainty') { const g = groupOf(a); return g === 'disputed' ? CERT.disputed : g === 'borrowed' ? CERT.borrowed : g === 'vague' ? CERT.vague : CERT.record; }
  return LINE_COLOUR[lineOf(a.id)];
}
/** For someone using the keyboard, put focus where the action went, so they do not start again from the top of the page. */
function refocus(sel: string) {
  if (!document.body.classList.contains('kbd')) return;
  setTimeout(() => (document.querySelector(sel) as HTMLElement | null)?.focus(), 30);
}
function toast(msg: string, ms = 3200) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
/** a message about a selection goes when the selection does */
function clearToast() { document.querySelector('.toast')?.remove(); }
/** the control a record was opened from, so Esc can put the keyboard back there */
let opener: string | null = null;
/** a household lit together: the camera keeps the side of the world most of them are on */
let family: Set<string> | null = null, familySide = false;
function frameFamily(): number {
  if (!family || state.focus !== family) { family = null; return 0; }
  const lls: LonLat[] = [];
  for (const id of family) { const a = world.byId.get(id); const ll = a && world.lightOf(a, state.year >= thisYear ? thisYear : state.year + 0.5); if (ll) lls.push(ll); }
  if (!lls.length) return 0;
  const far = lls.filter((ll) => ll[0] > 100), near = lls.filter((ll) => ll[0] <= 100);
  // most of them; when it is even, stay where the camera already is
  if (far.length !== near.length) familySide = far.length > near.length;
  const mine = familySide ? far : near;
  for (const s of stages) s.frame(mine.length ? mine : lls);
  return mine.length ? lls.length - mine.length : 0;
}

// ---------------------------------------------------------------- boot
async function boot() {
  [river, atlas] = await Promise.all([fetch('./data/river.json').then((r) => r.json()), fetch('./data/atlas.json').then((r) => r.json())]);
  P = new Map(river.people.map((p) => [p.id, p]));
  F = new Map(river.families.map((f) => [f.id, f]));
  L = buildLayout(river, new Set(SOFT_BREAKS));
  world = new World(river, atlas);
  thisYear = river.meta.thisYear; state.year = thisYear;
  trackMin = Math.floor((Math.min(...world.actors.map((a) => a.on)) - 2) / 5) * 5;
  // with no year asked for, open on the year with the most lights, not on an empty present
  { let best = 0; for (let y = trackMin; y <= thisYear; y += 5) { const n = world.actors.filter((a) => a.on <= y && y < a.d).length; if (n > best) { best = n; peakYear = y; } } }
  const c = atlas.meta.counts;
  $('#eyebrow').textContent = isSmall() ? `${c.recorded + c.borrowed} people · ${world.atSite.size} places · ${c.moves} moves` : `Barlow family · ${c.recorded + c.borrowed} people · ${world.atSite.size} places · ${c.moves} moves`;
  const ev = {
    onPick: (person: string | null, site: string | null) => { if (person) select(person); else if (site) openPlace(site); else if (state.selected || state.focus || state.place) clearAll(); },
    onHover: hover,
    onCountry: (name: string) => openCountry(name),
    onFinding: (id: string) => { if (state.finding !== id) openFinding(id); openSheet(true); },
    onUser: () => { state.follow = null; state.track = null; },
  };
  stages = [new Stage($<HTMLCanvasElement>('#view-a'), 'globe', world, lands, colourOf, ev), new Stage($<HTMLCanvasElement>('#view-b'), 'shores', world, lands, colourOf, ev)];

  // The globe's camera crosses the world once. It goes when New Zealand holds more
  // lights than Europe for good; if a dated voyage sails in the years just before
  // that, it goes with the ship instead.
  const nzLeads = (y: number) => { let eu = 0, nz = 0; for (const a of world.actors) { const ll = world.lightOf(a, y); if (ll && ll[0] > -30) ll[0] > 100 ? nz++ : eu++; } return nz > eu; };
  let turn = thisYear + 1;
  for (let y = trackMin; y <= thisYear; y++) { let held = true; for (let z = y; z < y + 15 && held; z++) held = nzLeads(z); if (held) { turn = y; break; } }
  let ride: [number, number] | null = null;
  for (const a of world.actors) for (const l of a.legs) if (l.sail && l.km > 9000 && l.y1 <= turn && l.y1 >= turn - 40 && (!ride || l.y1 < ride[0])) ride = l.y1 === l.y0 ? [l.y1, l.y1 + 1] : [l.y1 - Math.max(1, l.y1 - l.y0), l.y1];
  if (ride) turn = ride[0];
  for (const s of stages) s.plan = { turn, ride };

  countries = world.countries();
  buildStars();
  buildBeats();
  bindChrome();
  bindSearch();
  buildSpark();
  renderLegend();
  renderTab();
  $('#app').classList.remove('loading');
  const had = readHash();
  setView(state.view, true);
  setLens(state.lens);
  if (!had && !reduceMotion) intro();
  else {
    restore(!hashYear);
    if (!had) { $('#hint').hidden = false; setTimeout(() => { $('#hint').hidden = true; }, 6000); }
  }
  draw(true);
  (window as unknown as Record<string, unknown>).__atlas = { state, world, stages, openCountry, openFinding, beats: () => beats, counts: () => Object.fromEntries(counts), plan: stages[0].plan, atlas, setYear, play, stop, select, openPlace, setView, setLens, scene: () => { draw(); return lastScene; }, settle: () => { draw(true); draw(true); } };
}

// ---------------------------------------------------------------- drawing loop
let frames = 0, raf = 0, lastT = 0, playYear = 0;
function kick(n = 160) { frames = Math.max(frames, n); if (!raf) raf = requestAnimationFrame(loop); }
function loop(now: number) {
  raf = 0;
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (state.playing) {
    const fol = state.follow ? world.byId.get(state.follow) : null;
    // following one person, only their own voyage slows the play
    const sailing = fol ? Boolean(lastScene?.lights.some((l) => l.actor === fol && l.moving)) : Boolean(lastScene?.ship);
    const reading = !fol && now < captionUntil;
    const reading2 = now < captionUntil;
    // a caption still being read just before a voyage: wait for it, so the voyage does not cut it short
    const shipSoon = !fol && reading2 && allBeats.some((b) => b.sail && b.y - playYear > 0 && b.y - playYear < 0.6);
    const speed = shipSoon ? 0.05 : sailing ? 0.18 : pendingBeat && reading2 ? 0.15 : reading ? 0.9 : fol ? (reading2 ? 2.5 : 6) : playYear < 1650 ? 20 : playYear > 1900 ? 5.5 : 8;
    playYear += dt * speed;
    const end = fol ? Math.min(thisYear, fol.stays[fol.stays.length - 1].to + 2) : thisYear;
    if (playYear >= end) { playYear = end; setYear(playYear, true); stop(); } else setYear(playYear, true);
  }
  draw();
  // setYear() above may already have asked for the next frame: never ask twice
  if ((state.playing || --frames > 0) && !raf) raf = requestAnimationFrame(loop);
}
function draw(snap = false) {
  // paused on a whole year, show the middle of it: a voyage that falls inside one year is then on the water
  const y = state.playing ? playYear : state.year >= thisYear ? thisYear : state.year + 0.5;
  const sc = world.scene(y, state.focus, state.selected, y >= thisYear);
  lastScene = sc;
  if (state.playing) { renderCountries(y); caption(true); }
  const fol = world.byId.get(state.follow ?? state.track ?? '') ?? null;
  // when the light followed has gone out the camera stays where it was last drawn
  const follow: LonLat | null = fol ? world.lightOf(fol, y) ?? (state.follow && y >= fol.d && fol.on < fol.d ? world.lightOf(fol, fol.d - 0.01) : null) : null;
  // at the present day no light is lit: the rim then names where the embers are
  const emberBy = new Map<string, number>();
  if (!sc.lights.length) for (const e of [...sc.embers, ...sc.rests]) { const c = world.places.get(e.site)!.country; emberBy.set(c, (emberBy.get(c) ?? 0) + 1); }
  const pointers: Pointer[] = countries.map((c) => (emberBy.size ? { name: c.name, ll: c.ll, n: emberBy.get(c.name) ?? 0, unit: 'remembered', on: state.country === c.name } : { name: c.name, ll: c.ll, n: counts.get(c.name) ?? 0, on: state.country === c.name }));
  // which shore a phone should show when its sheet is open: the one the selection is on
  const where: LonLat | null = follow ?? (state.place ? world.ll(state.place) : state.country ? countries.find((c) => c.name === state.country)?.ll ?? null : null);
  if (where) for (const s of stages) s.focusSide = where[0] > 100 || where[0] < -30 ? 'nz' : 'gb';
  for (const st of stars) st.on = state.finding === st.id;
  for (const s of stages) if (!s.canvas.hidden) s.draw(sc, state.selected, { follow, snap: snap || reduceMotion, pointers, stars });
}

// ---------------------------------------------------------------- stars
/** Findings that belong to one place are starred on the map itself, from the year they happen. */
let stars: Star[] = [];
const STARRED = /^a-(first-crossing|farthest|birthplace|silence|split-siblings|first-|same-year|doubt)/;
function buildStars() {
  for (const f of [...atlas.facts, ...atlas.leads]) {
    if (!STARRED.test(f.id)) continue;
    const a = f.people.map((id) => world.byId.get(id)).find(Boolean);
    if (!a) continue;
    // where that person is in the finding's year, or where they were last recorded by then
    const y = Math.min(a.d - 0.01, Math.max(a.on, f.y + 0.5));
    // a voyage's star sits where it ends, not in mid-ocean
    const w = whereAt(a.stays, y);
    const ll = w ? world.ll(w.b && w.sail ? w.b : w.a) : world.ll(a.stays[a.stays.length - 1].p);
    stars.push({ id: f.id, ll, y: f.y });
  }
}

// ---------------------------------------------------------------- countries
let countries: ReturnType<World['countries']> = [];
let counts = new Map<string, number>();
/** One chip per country the records name, with how many lights are lit there this year. */
let chipsHtml = '';
const SHORT: Record<string, string> = { England: 'Eng', 'New Zealand': 'NZ', Wales: 'Wal', Poland: 'Pol', 'United States': 'US', Ireland: 'Ire' };
/** full country names when they fit, short ones when the row would run off the edge */
function fitChips() { const el = $('#countries'); el.classList.remove('tight'); if (el.scrollWidth > el.clientWidth + 1) el.classList.add('tight'); }
function renderCountries(year: number) {
  counts = new Map();
  // counted at the very moment the map is drawn, so a voyage on the water is at sea in the count too
  const at = state.playing ? playYear : year >= thisYear ? thisYear : Math.floor(year) + 0.5;
  for (const a of world.actors) { const c = world.countryOf(a, at); if (c) counts.set(c, (counts.get(c) ?? 0) + 1); }
  // at the present day nobody named is lit: the chips count what each country remembers, embers and rings together
  const finale = year >= thisYear;
  const kept = new Map<string, number>();
  if (finale) for (const a of world.actors) if (a.on < a.d || a.ember) { const c = world.places.get(a.stays[a.stays.length - 1].p)!.country; kept.set(c, (kept.get(c) ?? 0) + 1); }
  const sea = counts.get('sea') ?? 0;
  const html = (finale ? `<span class="sea">Remembered</span>` : '') + (sea ? `<span class="sea"><span class="full">At sea</span><span class="short" aria-hidden="true">Sea</span> <b>${sea}</b></span>` : '') + countries.map((c) => { const n = finale ? kept.get(c.name) ?? 0 : counts.get(c.name) ?? 0; return `<button data-country="${esc(c.name)}" aria-pressed="${state.country === c.name}" class="${n ? '' : 'none'}" aria-label="${esc(c.name)}: ${n} ${finale ? 'remembered' : 'lit'}" title="${esc(c.name)}: ${n} ${finale ? 'remembered' : 'lit'} in ${Math.floor(year)}, ${c.people.length} ${c.people.length === 1 ? 'person' : 'people'} in all"><span class="full">${esc(c.name)}</span><span class="short" aria-hidden="true">${SHORT[c.name] ?? esc(c.name)}</span> <b>${n}</b></button>`; }).join('');
  if (html !== chipsHtml) { chipsHtml = html; $('#countries').innerHTML = html; fitChips(); }
}
function openCountry(name: string, moveYear = true) {
  const c = countries.find((x) => x.name === name); if (!c) return;
  stop(); clearToast(); family = null;
  if (state.country === name && state.record === 'country') { clearAll(); return; }
  if (state.group) { state.group = null; renderLegend(); }
  state.country = name; state.selected = null; state.place = null; state.finding = null; state.follow = null; state.track = null;
  remember('country', name);
  state.focus = new Set(c.people.map((a) => a.id));
  if (moveYear && !(counts.get(name) ?? 0)) {
    // the first year someone is actually lit here: a record and a departure can share a year
    let y = c.first;
    for (let k = 0; k < 20; k++) if (world.actors.some((a) => world.countryOf(a, c.first + k + 0.5) === name)) { y = c.first + k; break; }
    setYear(y);
  }
  renderCountries(state.year);
  for (const s of stages) s.frame(c.sites.map((id) => world.ll(id)));
  openRecord('country', countryHtml(c));
  writeHash(); kick();
}
function countryHtml(c: (typeof countries)[number]): string {
  const here = (id: string) => world.places.get(id)!.country === c.name;
  const recorded = (a: Actor) => a.a.stops.filter((s) => s.kind !== 'borrowed' && here(s.p));
  // by a record: a record of their own names a place in this country. Everyone else here is here with a relative.
  const own = c.people.filter((a) => recorded(a).length), lent = c.people.filter((a) => !recorded(a).length);
  // everyone counted is listed once, by how they first appear here
  const born = own.filter((a) => recorded(a).some((s) => s.kind === 'birth' || s.kind === 'baptism'));
  // came here: a record of their own somewhere else first. A borrowed place elsewhere does not count.
  const came = own.filter((a) => !born.includes(a) && recorded(a).length && a.a.stops.some((s) => s.kind !== 'borrowed' && !here(s.p) && s.y <= Math.min(...recorded(a).map((x) => x.y))));
  const rest = own.filter((a) => !born.includes(a) && !came.includes(a));
  const died = own.filter((a) => recorded(a).some((s) => s.kind === 'death' || s.kind === 'burial'));
  const ys = own.flatMap((a) => recorded(a).map((s) => s.y));
  const first = ys.length ? Math.min(...ys) : null, last = ys.length ? Math.max(...ys) : null;
  // a loose year stays loose here too
  const loose = (y: number | null) => (y != null && own.some((a) => recorded(a).some((s) => s.y === y && s.approx)) && !own.some((a) => recorded(a).some((s) => s.y === y && !s.approx)) ? 'about ' : '');
  const list = (title: string, as: Actor[]) => (as.length ? `<h3>${title} (${as.length})</h3><div class="who">${[...as].sort((x, y) => x.b - y.b).slice(0, 60).map((a) => chip(a.id)).join('')}${as.length > 60 ? `<span class="rel">and ${as.length - 60} more: see the People tab</span>` : ''}</div>` : '');
  return `<button class="back" data-act="back">← Back</button><div class="rec"><div class="kicker">Country</div><h2>${esc(c.name)}</h2>
  <div class="life">${first == null ? 'Lights here are drawn with relatives only' : first === last ? `Recorded in ${loose(first)}${first}` : `Recorded from ${loose(first)}${first} to ${loose(last)}${last}`} · ${counts.get(c.name) ?? 0} lit in ${Math.round(state.year)}</div>
  <p>${c.people.length} ${c.people.length === 1 ? 'person is' : 'people are'} placed here at some time, in ${c.sites.length} ${c.sites.length === 1 ? 'place' : 'places'}${lent.length ? `: ${own.length} by a record, ${lent.length} drawn with a relative` : ''}.${c.name === 'Poland' ? ' Most of the Polish lines are living, or have no dated, placed record of the kind the map reads, so Poland is nearly dark on this map. That is a gap in what the map can use, not in the family.' : ''}</p>
  <h3>Places (${c.sites.length})</h3><div class="who">${c.sites.map((id) => `<button data-place="${esc(id)}">${esc(shortPlace(id))}</button>`).join('')}</div>
  ${list('Born or baptised here', born)}${list('Came here from another country', came)}${list('Recorded here, with no placed birth record', rest)}${list('Drawn here with a relative', lent)}
  ${died.length ? `<h3>Of those, died or buried here (${died.length})</h3><div class="who">${[...died].sort((x, y) => x.d - y.d).slice(0, 60).map((a) => chip(a.id)).join('')}${died.length > 60 ? `<span class="rel">and ${died.length - 60} more</span>` : ''}</div>` : ''}
  ${first != null ? `<div class="actions"><button class="btn quiet" data-act="goyear" data-y="${first}">Go to ${loose(first)}${first}</button></div>` : ''}</div>`;
}

// ---------------------------------------------------------------- time
function setYear(y: number, fromPlay = false) {
  $('#tip').hidden = true;
  y = Math.max(trackMin, Math.min(thisYear, y));
  if (!fromPlay) playYear = y;
  // during play the year shown is the year we are in, not the nearest one
  const shown = fromPlay ? Math.floor(y) : Math.round(y);
  const changed = shown !== state.year;
  state.year = fromPlay ? shown : y === shown ? shown : y;
  if (changed || !fromPlay) {
    state.year = shown;
    $('#year').textContent = String(shown);
    if (!fromPlay && family) frameFamily();
    const alive = world.actors.filter((a) => world.lightOf(a, shown >= thisYear ? thisYear : shown + 0.5)).length;
    $('#alive').textContent = shown >= thisYear ? (isSmall() ? `${atlas.meta.counts.living} living` : `${atlas.meta.counts.living} living, not shown`) : `${alive} lit`;
    const u = (shown - trackMin) / (thisYear - trackMin);
    $('#track-fill').style.width = u * 100 + '%'; $('#track-handle').style.left = u * 100 + '%';
    $('#track').setAttribute('aria-valuenow', String(shown));
    document.querySelectorAll<SVGRectElement>('#spark rect').forEach((r) => r.classList.toggle('past', Number(r.dataset.y) <= shown));
    renderCountries(shown);
    caption(fromPlay);
    writeHash();
  }
  kick();
}
function play(follow: string | null = null) {
  if (state.playing) return;
  $('#hint').hidden = true;
  state.follow = follow;
  for (const s of stages) s.resume();
  if (!follow && state.year >= thisYear) setYear(trackMin + 20);
  state.playing = true; playYear = state.year; lastT = performance.now();
  // captions already behind us are not replayed
  followBeats = follow ? beatsFor(world.byId.get(follow)!) : null;
  { const bs = followBeats ?? beats; beatIdx = -1; for (let i = 0; i < bs.length; i++) if (bs[i].y < playYear - 0.5) beatIdx = i; }
  showBeat(null); captionUntil = 0;
  pendingBeat = false;
  document.body.classList.add('playing');
  $('#play').setAttribute('aria-label', 'Pause the timeline');
  kick();
}
/** a follow that was paused part-way picks up as a follow */
function resumeFollow(): string | null { const a = state.follow ? world.byId.get(state.follow) : null; return a && state.selected === a.id && state.year < a.d ? a.id : null; }
function stop() {
  if (!state.playing) return;
  state.playing = false; state.year = Math.floor(playYear);
  document.body.classList.remove('playing');
  $('#play').setAttribute('aria-label', 'Play the timeline');
  kick();
}
function intro() {
  setYear(trackMin + 2);
  draw(true);
  const hint = $('#hint'); hint.hidden = false;
  setTimeout(() => { hint.hidden = true; }, 6000);
  setTimeout(() => { if (state.year < trackMin + 6 && !state.selected && !state.record) play(); }, 900);
}

// captions: the moves themselves, in a sentence, as the year reaches them
/** what a crossing meant for a family: the children born before it and after it, by their recorded birthplaces */
function childrenLine(ids: string[], y1: number, dest: string): string {
  const kids = new Set<string>();
  for (const id of ids) for (const fid of P.get(id)!.fams) for (const c of F.get(fid)?.children ?? []) kids.add(c);
  const country = world.places.get(dest)!.country;
  let before = 0, after = 0;
  for (const c of kids) {
    const s = world.byId.get(c)?.a.stops.find((x) => x.kind === 'birth' || x.kind === 'baptism');
    if (!s) continue;
    if (s.y < y1) before++; else if (world.places.get(s.p)!.country === country) after++;
  }
  const the = country === 'United States' ? 'the ' : '';
  if (before && after) return ` ${before} ${before === 1 ? 'child was' : 'children were'} born before the voyage and ${after} in ${the}${country} after it.`;
  if (after > 1) return ` ${after} children are born in ${the}${country}.`;
  return '';
}
interface Beat { y: number; /** the year to print, when it is not the year the caption is due */ label?: number; text: string; end?: boolean; sail?: boolean; ids?: string[]; they?: string }
let beats: Beat[] = [];
let allBeats: Beat[] = [];
function buildBeats() {
  // One caption per arrival: everyone who turns up in the same place in the same year is told together.
  interface Group { y0: number; y1: number; a0?: boolean; a1?: boolean; from: string; to: string; dest: string; sail: boolean; doubt?: string; assumed: boolean; dies: boolean; sameFrom: boolean; ids: string[] }
  const groups = new Map<string, Group>();
  for (const a of world.actors) a.legs.forEach((l, i) => {
    // a child drawn with a parent has no record of their own to announce
    if ((l.km < 1500 && !l.doubt) || l.within || l.follows) return;
    const from = shortPlace(world.siteId(l.a)), to = shortPlace(world.siteId(l.b));
    const dies = a.stays[i + 1].stops.every((x) => x.kind === 'death' || x.kind === 'burial');
    const kind = l.doubt ? 'doubt' : l.sail ? 'sail' : dies ? 'dies' : 'by';
    const key = [kind, kind === 'sail' ? l.y0 : l.y1, world.places.get(l.b)!.country === 'New Zealand' && kind === 'by' ? 'New Zealand' : to].join('|');
    const g = groups.get(key) ?? { y0: l.y0, y1: l.y1, a0: l.approx0, a1: l.approx1, from, to, dest: l.b, sail: l.sail, doubt: l.doubt, assumed: Boolean(l.assumed), dies, sameFrom: true, ids: [] };
    if (g.ids.length && (g.from !== from || g.y0 !== l.y0 || g.to !== to)) { g.sameFrom = g.sameFrom && g.from === from && g.y0 === l.y0; if (g.to !== to) g.to = world.places.get(l.b)!.country; }
    g.assumed = g.assumed && Boolean(l.assumed);
    g.ids.push(a.id); groups.set(key, g);
  });
  const yr = (on: boolean | undefined, y: number) => `${on ? 'about ' : ''}${y}`;
  // a record that names only the country: "somewhere in New Zealand", not a town called New Zealand
  const vague = (name: string) => (name === 'New Zealand' || name === 'England' || name === 'Poland' ? `@@${name}` : name);
  const tidy = (t: string) => t.replace(/\bin @@/g, 'somewhere in ').replace(/@@/g, '');
  // an age only where the birth is a firm date
  // an age only where the birth is a full date: from a bare year it could be a year out
  const age = (id: string, y: number) => { const a = world.byId.get(id)!, b = a.p.b!; if (b.est || b.approx || !/[A-Za-z]/.test(b.text)) return ''; const dated = a.a.stops.find((x) => x.y === y && x.date); return `, ${dated ? ageBetween(b, { y, text: dated.date! }) : `${y - a.b - 1} or ${y - a.b}`},`; };
  for (const g of groups.values()) {
    // oldest first, so parents are named before their children
    g.ids.sort((x, y) => world.byId.get(x)!.b - world.byId.get(y)!.b);
    const names = g.ids.map((id) => world.byId.get(id)!.p.name!);
    const who = names.length > 3 ? `${names[0]}, ${names[1]} and ${names.length - 2} others` : names.length === 3 ? `${names[0]}, ${names[1]} and ${names[2]}` : names.join(' and ');
    const to = vague(g.to), from = vague(g.from), many = names.length > 1, are = many ? 'are' : 'is';
    const sex = world.byId.get(g.ids[0])!.p.sex;
    const their = many ? 'their' : sex === 'F' ? 'her' : sex === 'M' ? 'his' : 'their', them = many ? 'them' : sex === 'F' ? 'her' : sex === 'M' ? 'him' : 'them', they = many ? 'they' : sex === 'F' ? 'she' : sex === 'M' ? 'he' : 'they';
    const last = g.sameFrom && !g.assumed ? ` Last recorded in ${from} in ${yr(g.a0, g.y0)}.` : '';
    let text: string;
    if (g.doubt) text = `A Francis Barlow is a father in ${to}. If he is the boy baptised at ${from}, he came 250 km and was about fifteen. The tree doubts it.`;
    else if (g.sail) text = `${who}: in ${from} in ${g.y0}, in ${to} by ${g.y1}. The voyage falls in ${g.y1 === g.y0 ? 'that year' : 'those years'}.`;
    else if (g.dies) text = `${who} ${many ? 'die' : 'dies'} in ${to} in ${yr(g.a1, g.y1)}.${last}`;
    else if (g.assumed) text = `${who} ${are} first recorded in ${yr(g.a1, g.y1)}, in ${to}.`;
    else {
      // children with no record of their own who are drawn arriving with them
      const dsite = world.siteId(g.dest);
      const kids = world.actors.filter((a) => a.a.stops[0].kind === 'borrowed' && names.some((n) => a.a.stops[0].why.includes(`, ${n}`)) && a.legs.some((l) => l.follows && l.y1 === g.y1 && world.siteId(l.b) === dsite)).length;
      const withKids = kids ? ` ${kids === 1 ? `One of ${their} children` : `${kids} of ${their} children`}, with no placed record yet of ${kids === 1 ? 'the child’s' : 'their'} own, ${kids === 1 ? 'is' : 'are'} drawn with ${them}.` : '';
      text = `By ${yr(g.a1, g.y1)} ${many ? who : names[0] + age(g.ids[0], g.y1)} ${are} in ${to}.${last}${withKids}${childrenLine(g.ids, g.y1, g.dest)}`;
    }
    beats.push({ y: g.sail ? g.y0 : g.y1, sail: g.sail && !g.doubt, ids: g.ids, text: tidy(text), they });
  }
  // the first record in each other country
  for (const f of atlas.facts) if (/^a-first-(wales|ireland|united-states|poland)$/.test(f.id)) beats.push({ y: f.y, ids: f.people, text: `${f.title}. ${f.body}` });
  // two findings that belong to a year are told when the year comes
  for (const f of atlas.facts) if (f.id === 'a-split-siblings' || f.id === 'a-silence') beats.push({ y: f.id === 'a-silence' ? f.y : f.y + 1, ids: f.people, text: f.id === 'a-silence' ? `${f.title}. ${f.body.split('. ').slice(0, 1).join('. ')}.` : f.body.split('. ').slice(1, -1).join('. ') + '.' });
  // the quiet centuries have their own moments: the River's captions that belong to a place
  for (const b of BEATS) if (b.y >= 1700 && !beats.some((x) => Math.abs(x.y - b.y) < 2)) beats.push({ y: b.y, text: b.text });
  // when the balance tips, and when the last light this side goes out
  const side = (a: Actor, y: number) => { const ll = world.lightOf(a, y); return ll ? (ll[0] > 100 ? 'nz' : 'eu') : null; };
  const tally = (y: number) => { let eu = 0, nz = 0; for (const a of world.actors) { const sd = side(a, y); if (sd === 'nz') nz++; else if (sd === 'eu') eu++; } return [eu, nz]; };
  for (let y = trackMin; y <= thisYear; y++) { let held = true; for (let z = y; z < y + 15 && held; z++) { const [eu, nz] = tally(z + 0.5); held = nz > eu; } if (held) { const [eu, nz] = tally(y + 0.5); beats.push({ y, text: `From ${y} more of the family’s lights are in New Zealand than on the other side of the world: ${nz} to ${eu}, hollow lights included. That is among those named here; the living are not counted.` }); break; }
  }
  const lastEu = [...world.actors].filter((a) => a.on < a.d && side(a, a.d - 0.5) === 'eu').sort((x, y) => y.d - x.d)[0];
  if (lastEu && !lastEu.p.d!.est) { const where = shortPlace(world.siteId(lastEu.stays[lastEu.stays.length - 1].p)); const wl = whereAt(lastEu.stays, lastEu.d - 0.5); const whereLit = wl ? shortPlace(world.siteId(wl.a)) : where; beats.push({ y: lastEu.d, ids: [lastEu.id], text: `${lastEu.p.name} dies in ${lastEu.d}, in ${world.places.get(lastEu.stays[lastEu.stays.length - 1].p)!.country}, far from where this view is looking. ${whereLit && !/^(England|New Zealand|Poland)$/.test(whereLit) ? `The light at ${whereLit}` : 'Hers'} is the last named light on the map.`.replace('Hers is', lastEu.p.sex === 'M' ? 'His is' : 'Hers is') }); }
  // the last of those who made the crossing, and the year New Zealand's lights are mostly its own
  const crossers = world.actors.filter((a) => a.legs.some((l) => l.km > 9000 && !l.assumed && !l.within) && !a.p.d!.est).sort((x, y) => y.d - x.d);
  if (crossers[0]) {
    const c = crossers[0], said = beats.find((b) => b.y === c.d && b.ids?.includes(c.id));
    const line = ` ${c.p.sex === 'F' ? 'She' : c.p.sex === 'M' ? 'He' : 'They'} ${c.p.sex === 'F' || c.p.sex === 'M' ? 'is' : 'are'} the last of those recorded on both sides of the world.`;
    if (said) said.text += line; else beats.push({ y: c.d, ids: [c.id], text: `${c.p.name} dies in ${c.d}.${line}` });
  }
  // the year New Zealand holds the most lights it ever will
  { let best = 0, at = 0; for (let y = 1855; y <= thisYear; y++) { const n = tally(y + 0.5)[1]; if (n > best) { best = n; at = y; } }
    // how many of those are hollow, and what the peak is by records alone
    const solidNZ = (y: number) => world.actors.filter((a) => side(a, y) === 'nz' && !a.stays[whereAt(a.stays, y)!.i].stops.every((x) => x.kind === 'borrowed')).length;
    let sBest = 0, sAt = 0; for (let y = 1855; y <= thisYear; y++) { const n = solidNZ(y + 0.5); if (n > sBest) { sBest = n; sAt = y; } }
    const hollowThen = best - solidNZ(at + 0.5);
    if (best && !beats.some((b) => Math.abs(b.y - at) < 3)) beats.push({ y: at, text: `In ${at} New Zealand holds ${best} of the family’s lights, the most it ever will on this map. ${hollowThen} of them are hollow, drawn there with a relative. Counting only lights a record of their own places there, the most is ${sBest}, in ${sAt}.` }); }
  // the year the last light in Britain goes out, by what is drawn: solid, haze or hollow alike, and said which
  {
    const gb = (a: Actor, y: number) => { const c = world.countryOf(a, y); return c === 'England' || c === 'Wales'; };
    let lastY = 0; for (let y = thisYear; y >= trackMin && !lastY; y--) if (world.actors.some((a) => gb(a, y + 0.5))) lastY = y;
    const who = world.actors.filter((a) => gb(a, lastY + 0.5));
    if (lastY && who.length) {
      const a = who.sort((x, y) => y.d - x.d)[0], st = a.stays[whereAt(a.stays, lastY + 0.5)!.i], lent = st.stops.every((x) => x.kind === 'borrowed');
      const how = lent ? 'a hollow one, drawn there with a relative' : `placed there by a record of ${Math.max(...st.stops.filter((x) => x.kind !== 'borrowed' && x.y <= lastY).map((x) => x.y))}, and by nothing since`;
      const line = `After ${lastY} no light is left in Britain on this map. The last is ${a.p.name}’s: ${how}. The family there goes on among the living, who are not shown.`;
      const said = beats.find((b) => Math.abs(b.y - (lastY + 1)) <= 1 && b.ids?.includes(a.id));
      if (said) said.text += ` ${line}`; else beats.push({ y: lastY + 1, ids: [a.id], text: line });
    }
  }
  // the last death that a record of its own places in New Zealand
  const nzDeath = (a: Actor) => a.a.stops.find((x) => (x.kind === 'death' || x.kind === 'burial') && world.places.get(x.p)!.country === 'New Zealand');
  const lastNZ = [...world.actors].filter((a) => !a.p.d!.est && nzDeath(a)).sort((x, y) => y.d - x.d)[0];
  if (lastNZ && !beats.some((b) => Math.abs(b.y - lastNZ.d) < 3)) {
    const pl = world.places.get(nzDeath(lastNZ)!.p)!;
    beats.push({ y: lastNZ.d, ids: [lastNZ.id], text: `${lastNZ.p.name} dies ${pl.prec === 'country' ? 'in New Zealand' : `in ${shortPlace(world.siteId(pl.id))}`} in ${lastNZ.d}: the last death the records place in New Zealand on this map. The family there goes on among the living, who are not shown.` });
  }
  beats.sort((a, b) => a.y - b.y || Number(Boolean(b.sail)) - Number(Boolean(a.sail)));
  // say once what every later "by" means, on the first long gap
  const firstGap = beats.find((b) => /^By /.test(b.text));
  if (firstGap) firstGap.text += ` The map reads no record of when ${firstGap.they ?? 'they'} went, or on what ship. It shows only what its records say.`;
  const lastDeath = Math.max(...world.actors.map((a) => a.d));
  allBeats = beats;
  beats.push({ y: Math.min(thisYear, lastDeath), end: true, text: `The map goes dark here, but the family does not. ${atlas.meta.counts.living} living relatives carry on. They are not shown.` });
}
let shownBeat: Beat | null = null;
/** when the caption on screen went up */
let shownAt = 0;
/** while a caption is new, play slows so it can be read */
let captionUntil = 0;
/** a caption waiting for the one on screen to be read */
let pendingBeat = false;
/** during play every caption gets its turn, in order: this is how far through them we are */
let beatIdx = -1;
/** when following one person, the captions are that person's own records in order */
let followBeats: Beat[] | null = null;
function beatsFor(a: Actor): Beat[] {
  // in the order things happened: each place, then the voyage that leaves it
  const out: Beat[] = [];
  a.stays.forEach((st, i) => {
    const lent = st.stops.every((x) => x.kind === 'borrowed');
    // the place as the records here name it: a parish only when every record names the parish
    const recs = st.stops.filter((x) => x.kind !== 'borrowed'), where = recs.every((x) => x.p === st.p) ? placeName(st.p) : placeName(world.siteId(st.p)), leg = a.legs[i];
    const sails = Boolean(leg && leg.sail && leg.km > 1500);
    // a record that names only the county or country is said to: the light stays at the closer place
    const all = [...new Set(st.stops.filter((x) => x.kind !== 'borrowed').map((x) => `${x.approx || x.est ? 'about ' : ''}${x.y} ${x.why}${x.p !== st.p && ['area', 'country'].includes(world.places.get(x.p)!.prec) ? ` (the record says only ${placeName(x.p)})` : x.p !== st.p || where === placeName(st.p) ? '' : `, at ${shortPlace(x.p)}`}`))];
    const what = all.slice(0, 4).join('; ') + (all.length > 4 ? `; and ${all.length - 4} more ${all.length - 4 === 1 ? 'record' : 'records'} here, to ${st.to}` : '');
    // a place left in the same year it is recorded is told just before the voyage, not after it
    out.push({ y: sails && leg.y0 === st.from ? st.from - 0.9 : st.from, label: st.from, ids: [a.id], text: lent ? `${where}: no placed record of ${a.p.given ? a.p.given.split(' ')[0] + '’s' : 'their'} own. Drawn here with a relative.` : `${where}: ${what}.` });
    if (sails) out.push({ y: leg.y0, sail: true, ids: [a.id], text: `${shortPlace(world.siteId(leg.a))} to ${shortPlace(world.siteId(leg.b))}: ${windowText(leg, (id) => shortPlace(world.siteId(id)))}` });
  });
  return out;
}

function showBeat(b: Beat | null) {
  shownBeat = b;
  const el = $('#caption'); el.classList.toggle('on', Boolean(b));
  if (b) { el.innerHTML = `${b.end ? '' : `<b>${b.label ?? b.y}</b>`}${esc(b.text)}`; shownAt = performance.now(); captionUntil = performance.now() + Math.min(7000, 1600 + b.text.split(' ').length * 190); }
}
function caption(fromPlay: boolean) {
  if (!fromPlay || !state.playing) {
    // not playing: only the closing line, at the present day
    pendingBeat = false;
    const end = state.year >= thisYear ? allBeats.find((x) => x.end) ?? null : null;
    if (end !== shownBeat) showBeat(end);
    return;
  }
  const y = playYear;
  const beats = followBeats ?? allBeats;
  const mine = (_b: Beat) => true;
  const now = performance.now();
  // a voyage under way is told while it is under way, whatever else is waiting
  const sailing = lastScene?.ship ? beats.findIndex((b) => Boolean(b.sail) && mine(b) && b.y <= y && y < b.y + 1.2) : -1;
  if (sailing >= 0) { if (beats[sailing] !== shownBeat) {
    // the place being left is on screen: let it be read before the voyage takes over
    if (followBeats && shownBeat && !shownBeat.sail && now < Math.min(captionUntil, shownAt + 3000)) { pendingBeat = true; return; } beatIdx = Math.max(beatIdx, sailing); pendingBeat = false; showBeat(beats[sailing]); } return; }
  let next = -1;
  for (let i = beatIdx + 1; i < beats.length && beats[i].y <= y; i++) if (mine(beats[i]) && beats[i] !== shownBeat && (beats[i].end || !beats[i].sail || y < beats[i].y + 1.2)) { next = i; break; }
  if (next < 0) { pendingBeat = false; if (shownBeat && !shownBeat.end && now > captionUntil + 2500) showBeat(null); return; }
  if (shownBeat && now < captionUntil) { pendingBeat = true; return; }
  pendingBeat = false; beatIdx = next; showBeat(beats[next]);
}

function buildSpark() {
  // how many lights are lit, and on which side of the world, every five years
  const n = Math.ceil((thisYear - trackMin) / 5), eu = new Array(n).fill(0), nz = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { const y = trackMin + i * 5 + 2; for (const a of world.actors) { const ll = world.lightOf(a, y); if (ll) (ll[0] > 100 ? nz : eu)[i]++; } }
  const top = Math.max(...eu.map((v, i) => v + nz[i]));
  const svg = $('#spark'); svg.setAttribute('viewBox', `0 0 ${n} 26`);
  svg.innerHTML = eu.map((v, i) => { const h1 = (v / top) * 24, h2 = (nz[i] / top) * 24; return `<rect data-y="${trackMin + i * 5}" x="${i + 0.12}" y="${26 - h1}" width="0.76" height="${h1}" rx="0.2"/><rect class="nz" data-y="${trackMin + i * 5}" x="${i + 0.12}" y="${26 - h1 - h2}" width="0.76" height="${h2}" rx="0.2" style="fill:#B5DE7A"/>`; }).join('');
  const ticks: string[] = [];
  for (let y = Math.ceil(trackMin / 100) * 100; y <= thisYear; y += 100) ticks.push(`<span style="left:${((y - trackMin) / (thisYear - trackMin)) * 100}%">${y}</span>`);
  $('#track-ticks').innerHTML = ticks.join('');
  $('#track').setAttribute('aria-valuemin', String(trackMin)); $('#track').setAttribute('aria-valuemax', String(thisYear));
}

// ---------------------------------------------------------------- selection
function hover(person: string | null, site: string | null, x: number, y: number) {
  const tip = $('#tip');
  if (!person && !site) { tip.hidden = true; return; }
  if (site?.startsWith('star:')) { const f = [...atlas.facts, ...atlas.leads].find((x) => x.id === site.slice(5)); tip.innerHTML = `<b>${esc(f?.title)}</b><small>A finding. Tap to read it.</small>`; }
  else if (person) { const a = world.byId.get(person)!; tip.innerHTML = `${a.p.photo ? `<img class="face" src="${esc(a.p.photo)}" alt="" onerror="this.remove()">` : ''}<b>${esc(a.p.name)}</b><small>${esc(shortLife(a.p))}${a.hollow ? ' · no place of their own' : ''}</small>`; }
  else tip.innerHTML = `<b>${esc(placeName(site!))}</b><small>${world.atSite.get(site!)?.length ?? 0} people</small>`;
  tip.hidden = false; tip.style.left = Math.min(innerWidth - 270, x + 14) + 'px'; tip.style.top = y + 14 + 'px';
}
function frameIds(ids: string[]) {
  const lls: LonLat[] = [];
  for (const id of ids) { const a = world.byId.get(id); if (!a) continue; const y = Math.max(a.on, Math.min(a.d - 1, state.year)); const ll = world.lightOf(a, y) ?? world.ll(a.stays[0].p); lls.push(ll); }
  for (const s of stages) s.frame(lls);
}
function clearAll() {
  stop(); state.selected = null; state.place = null; state.finding = null; state.focus = null; state.follow = null; state.track = null; state.country = null; state.group = null; trail.length = 0;
  family = null; clearToast(); showBeat(null);
  closeRecord(); renderLegend(); renderTab(); renderCountries(state.year); openSheet(false); writeHash(); kick();
}
function select(id: string | null, _moveYear = true) {
  const moveYear = _moveYear;
  if (!id || !world.byId.has(id)) { if (id && P.get(id) && !P.get(id)!.living) { toast(`${P.get(id)!.name} is not on the map: none of the dated, placed records it reads places them`); openPeopleAt(id); } return; }
  stop(); clearToast(); family = null;
  // a caption from following someone else does not stay over this person
  if (shownBeat && !shownBeat.end) showBeat(null);
  const a = world.byId.get(id)!;
  if (state.group) { state.group = null; renderLegend(); }
  state.selected = id; state.place = null; state.focus = null; state.finding = null; state.follow = null; state.country = null; renderCountries(state.year);
  // a person not alive in the chosen year is shown in the year they are first recorded
  // someone placed only by a death or burial has no light, only an ember: go to the year it appears
  // no light to follow: the ember, or the place of the one record, is brought into view below
  const noLight = a.on >= a.d;
  if (noLight) { if (moveYear || state.year < a.d) setYear(Math.min(thisYear, a.d)); }
  else if (state.year < a.on || state.year >= a.d) setYear(Math.min(a.d - 1, Math.max(a.on, a.stays[0].from)));
  // the camera stays with them as the year moves, until the user drags it away
  state.track = id; for (const s of stages) s.resume();
  if (noLight) for (const s of stages) s.frame([world.ll(a.stays[a.stays.length - 1].p)]);
  remember('person', id);
  openRecord('person', personHtml(a));
  writeHash(); kick();
}
function openPlace(site: string, moveYear = true) {
  if (!world.places.has(site)) return;
  stop(); clearToast(); family = null;
  const people = world.atSite.get(site) ?? [];
  if (state.group) { state.group = null; renderLegend(); }
  state.place = site; state.selected = null; state.finding = null; state.follow = null; state.track = null; state.country = null; renderCountries(state.year);
  remember('place', site);
  state.focus = new Set(people.map((a) => a.id));
  const first = Math.min(...people.flatMap((a) => a.stays.filter((s) => world.siteId(s.p) === site).map((s) => s.from)));
  if (moveYear && !people.some((a) => { const ll = world.lightOf(a, state.year); const p = world.site(site); return ll && ll[0] === p.lon && ll[1] === p.lat; }) && isFinite(first)) setYear(first);
  const p = world.places.get(site)!;
  for (const s of stages) s.frame([[p.lon, p.lat], [p.lon + 1.2, p.lat + 0.8], [p.lon - 1.2, p.lat - 0.8]]);
  openRecord('place', placeHtml(site));
  writeHash(); kick();
}
function openFinding(id: string, moveYear = true) {
  const f = [...atlas.facts, ...atlas.leads].find((x) => x.id === id); if (!f) return;
  stop(); clearToast(); family = null;
  if (state.finding === id) { const top = $('#panel-body').scrollTop; state.finding = null; state.focus = null; renderTab(); $('#panel-body').scrollTop = top; writeHash(); kick(); refocus(`[data-finding="${id}"]`); return; }
  if (state.group) { state.group = null; renderLegend(); }
  state.finding = id; state.selected = null; state.place = null; state.follow = null; state.track = null; state.country = null; trail.length = 0; renderCountries(state.year);
  state.focus = new Set(f.people);
  if (moveYear) {
    // land on a year when someone it is about is lit: a finding dated to a death would open on a light already out
    const lit = (yy: number) => f.people.some((id) => { const a = world.byId.get(id); return Boolean(a && world.lightOf(a, yy + 0.5)); });
    let y = f.y;
    for (let k = 0; k <= 4; k++) if (lit(f.y - k)) { y = f.y - k; break; }
    setYear(y);
  }
  frameIds(f.people.filter((p) => world.byId.has(p)));
  if (state.record) closeRecord();
  state.tab = 'journeys'; renderTab(); writeHash(); kick();
  document.querySelector('#panel-body .card.on')?.scrollIntoView({ block: 'nearest' });
  if (isSmall()) openSheet(false);
  refocus(`[data-finding="${id}"]`);
}
/** note a record being opened, so Back can return to the one it was opened from */
function remember(kind: 'person' | 'place' | 'country', id: string) {
  const last = trail[trail.length - 1];
  if (last && last.kind === kind && last.id === id) return;
  if (!state.record) trail.length = 0;
  trail.push({ kind, id });
  pushed = true;
}
function goBack() {
  trail.pop();
  const prev = trail.pop();
  stop();
  if (prev) { if (prev.kind === 'person') select(prev.id, false); else if (prev.kind === 'place') openPlace(prev.id, false); else { state.country = null; openCountry(prev.id, false); } return; }
  const k = state.record;
  closeRecord(); state.selected = null; state.place = null; state.focus = null; state.follow = null; state.track = null; state.country = null;
  renderCountries(state.year); renderTab(); writeHash(); kick();
  void k; openSheet(false);
  refocus('.tabs [aria-selected="true"]');
}
function openPeopleAt(id: string) { state.tab = 'people'; if (state.record) closeRecord(); renderTab(); openSheet(true); document.querySelector(`[data-go="${id}"], [data-none="${id}"]`)?.scrollIntoView({ block: 'center' }); }
let birthOrder: string[] = [];
function stepPerson(dir: number) {
  if (!birthOrder.length) birthOrder = [...world.actors].sort((a, b) => a.on - b.on).map((a) => a.id);
  let i = state.selected ? birthOrder.indexOf(state.selected) : -1;
  if (i < 0) { i = birthOrder.findIndex((id) => world.byId.get(id)!.on >= state.year); if (i < 0) i = birthOrder.length - 1; i -= dir > 0 ? 1 : 0; }
  i = Math.max(0, Math.min(birthOrder.length - 1, i + dir));
  select(birthOrder[i]);
  // the keyboard stays on the map, so the next arrow steps again
  opener = '#views'; refocus('#views');
}

// ---------------------------------------------------------------- panel
function openSheet(open: boolean) { if (isSmall()) { $('#panel').classList.toggle('open', open); if (!open) $('#record').scrollTop = 0; syncInset(); } }
function syncInset() {
  const open = $('#panel').classList.contains('open');
  const stage = $('#stage').getBoundingClientRect(), panel = $('#panel').getBoundingClientRect();
  const b = isSmall() && open ? Math.max(0, stage.bottom - (innerHeight - panel.height)) : 0;
  for (const s of stages) s.inset.bottom = b;
  kick();
}
function openRecord(kind: NonNullable<typeof state.record>, html: string) {
  state.record = kind;
  const el = $('#record'); el.hidden = false; el.innerHTML = html; el.scrollTop = 0;
  $('#panel-body').inert = true;
  (document.querySelector('.tabs') as HTMLElement).inert = !isSmall();
  openSheet(true);
  refocus('#record .back');
}
function closeRecord() {
  state.record = null;
  $('#record').hidden = true; $('#record').innerHTML = '';
  $('#panel-body').inert = false; (document.querySelector('.tabs') as HTMLElement).inert = false;
}
const dot = (a: Actor) => `<i class="${a.hollow ? 'hollow' : ''}" style="background:${colourOf(a)};border-color:${colourOf(a)}"></i>`;
const chip = (id: string) => { const p = P.get(id); return p && !p.living ? `<button data-go="${esc(id)}">${esc(p.name)} <span style="opacity:.6">${esc(shortLife(p))}</span></button>` : ''; };

function renderTab() {
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  const body = $('#panel-body');
  body.innerHTML = state.tab === 'journeys' ? journeysHtml() : state.tab === 'places' ? placesHtml() : peopleHtml();
  body.scrollTop = 0;
}
function findingCard(f: Lead, kind: 'fact' | 'lead'): string {
  const on = state.finding === f.id;
  const who = f.people.filter((id) => world.byId.has(id) || (P.get(id) && !P.get(id)!.living));
  // a finding about a dated voyage can be ridden
  const ride = f.people.map((id) => world.byId.get(id)).find((a) => a?.legs.some((l) => l.sail && l.km > 9000)) ?? null;
  return `<button class="card${on ? ' on' : ''}" data-finding="${esc(f.id)}" aria-pressed="${on}"><span class="chip ${kind}">${kind === 'fact' ? 'Counted from the records' : 'Worth a second look'}</span><span class="t">${esc(f.title)}</span><span class="b${on ? '' : ' clip'}">${esc(f.body)}</span></button>${on ? `<div class="who">${who.slice(0, 8).map(chip).join('')}${who.length > 8 ? `<span class="rel">and ${who.length - 8} more</span>` : ''}</div>${ride ? `<div class="actions" style="margin:8px 0 4px"><button class="btn solid" data-ride="${esc(ride.id)}">Sail with ${esc((ride.p.given ?? ride.p.name ?? '').split(' ')[0])}</button></div>` : ''}` : ''}`;
}
function journeysHtml(): string {
  const c = atlas.meta.counts;
  return `<div class="kicker">Where the family was</div><h2>Births, deaths and the moves between</h2>
  <p class="lede">Every light is a person, shown where the records put them in the chosen year. Press play and watch four centuries pass.</p>
  <div class="counts"><div><b>${c.recorded}</b>people placed by a record of their own, or of their child’s birth or their marriage</div><div><b>${c.borrowed}</b>with no placed record of the kind the map reads: drawn hollow, where a close relative was</div><div><b>${c.unplaced}</b>with no such record and no one to borrow from: <button class="inline" data-act="unplaced">not on the map</button></div><div><b>${c.living}</b>living relatives: not shown at all</div></div>
  <div class="proofline"><b>What the map cannot know.</b> The records say where someone was in a given year. They almost never say when a move happened. A solid line is a move known to within three years. A dashed line is a move that happened some time in a longer gap: the light stays where it was last recorded, dimming, and appears at the new place only in the year a record finds it there. No solid light is drawn anywhere before a record puts the person there, and it dims the longer it is since the last one. Where no death is recorded the light goes out seventy years after birth. A hollow light is drawn with a relative, from the year that relative is recorded.</div>
  <h3>What the map shows</h3><div class="cards">${atlas.facts.map((f) => findingCard(f, 'fact')).join('')}</div>
  <h3>Worth a second look</h3><div class="cards">${atlas.leads.map((f) => findingCard(f, 'lead')).join('')}</div>
  <p class="fine">Places were set by hand from the place names in the tree. No address or map service was used, so nothing about the family left this page’s build. Voyages between Europe and New Zealand are drawn along the usual sea route of their time, not the course of any one ship.</p>`;
}
function siteStats(site: string) {
  const people = world.atSite.get(site) ?? [];
  const born: Actor[] = [], died: Actor[] = [], here: Actor[] = [], lent: Actor[] = [];
  let y0 = Infinity, y1 = -Infinity;
  const looseY = new Set<number>(), firmY = new Set<number>();
  for (const a of people) {
    const st = a.a.stops.filter((s) => world.siteId(s.p) === site && s.kind !== 'borrowed');
    // here only because a relative was: no record of their own names this place
    if (!st.length) { lent.push(a); continue; }
    for (const s of st) { y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); if (s.approx || s.est) looseY.add(s.y); else firmY.add(s.y); }
    if (st.some((s) => s.kind === 'birth' || s.kind === 'baptism')) born.push(a);
    if (st.some((s) => s.kind === 'death' || s.kind === 'burial')) died.push(a);
    if (!st.some((s) => ['birth', 'baptism', 'death', 'burial'].includes(s.kind))) here.push(a);
  }
  // a year only ever given as "c." stays "about"
  const abt = (y: number) => (looseY.has(y) && !firmY.has(y) ? 'about ' : '');
  return { people, born, died, here, lent, y0, y1, abt };
}
function placesHtml(): string {
  const rows = [...world.atSite.keys()].map((site) => ({ site, s: siteStats(site) })).sort((a, b) => (b.s.people.length - b.s.lent.length) - (a.s.people.length - a.s.lent.length) || b.s.people.length - a.s.people.length);
  return `<div class="kicker">${rows.length} places</div><h2>Where the records point</h2><p class="lede">Busiest first. Tap one to go there.</p>
  <ul class="plist">${rows.map(({ site, s }) => `<li><button data-place="${esc(site)}"><i style="background:${REGION_COLOUR[world.places.get(site)!.region] ?? '#A9B7CB'}"></i><span>${esc(placeName(site))}<small>${s.born.length ? `${s.born.length} born · ` : ''}${s.died.length ? `${s.died.length} died · ` : ''}${s.people.length} ${s.people.length === 1 ? 'person' : 'people'}${s.lent.length ? `, ${s.lent.length} of them placed here with a relative` : ''}</small></span><small>${isFinite(s.y0) ? (s.y0 === s.y1 ? s.y0 : `${s.y0}–${s.y1}`) : ''}</small></button></li>`).join('')}</ul>`;
}
function peopleHtml(): string {
  const rows = [...world.actors].sort((a, b) => a.b - b.b);
  const none = atlas.unplaced.map((id) => P.get(id)!).filter(Boolean);
  const unlit = rows.filter((a) => a.on >= a.d), embersOnly = unlit.filter((a) => a.ember).length, neither = unlit.length - embersOnly;
  return `<div class="kicker">${rows.length - unlit.length} people with a light${embersOnly ? `, ${embersOnly} with only an ember` : ''}${neither ? `, ${neither} recorded within a single year with neither` : ''}</div><h2>Everyone, in order of birth</h2>
  <input class="filter" id="pfilter" type="search" placeholder="Filter by name or place" aria-label="Filter the list by name or place">
  <p class="fine" id="pnone" hidden>No one on the map matches. Living people are not listed.</p><ul class="plist" id="plist">${rows.map((a) => `<li data-key="${esc(fold(a.p.name + ' ' + a.stays.map((s) => placeName(s.p)).join(' ')))}"><button data-go="${esc(a.id)}">${dot(a)}<span>${esc(a.p.name)}<small>${esc(a.stays.map((s) => shortPlace(world.siteId(s.p))).filter((v, i, arr) => v !== arr[i - 1]).join(' → '))}${a.hollow ? ' (with a relative)' : ''}</small></span><small>${esc(shortLife(a.p))}</small></button></li>`).join('')}</ul>
  <h3 id="unplaced">Not on the map</h3><p class="lede">${none.length} people have no placed record and no close relative with one. They are not drawn anywhere.</p>
  <ul class="plist">${none.map((p) => `<li><button data-none="${esc(p.id)}" disabled><i style="background:#5B6B83"></i><span>${esc(p.name)}</span><small>${esc(shortLife(p))}</small></button></li>`).join('')}</ul>
  <p class="fine">${atlas.meta.counts.living} living relatives are in the tree. Nothing about them is in this page: no light, no place, no name.</p>`;
}
function personHtml(a: Actor): string {
  const p = a.p, line = lineOf(a.id);
  // an age worked out from a "c." birth is not an age: leave those sentences out
  // an age is only an age from a fully dated birth; from a bare year it could be a year out
  const loose = Boolean(p.b?.est);
  const lines = lifeLines({ P, F }, p).flatMap((t) => t.split(/(?<=\.)\s+/)).filter((t) => !/at (about )?0\b/.test(t)).filter((t) => !loose || !/\bat \d+|\bat about \d+|\baged\b|\bby \d+ years\b/.test(t));
  const lender = a.a.borrowed ? P.get(a.a.borrowed.from) : null;
  const firstRec = Math.min(...a.a.stops.filter((x) => x.kind !== 'borrowed').map((x) => x.y), Infinity);
  const about = (y: number) => (a.a.stops.some((x) => x.y === y && x.approx) && !a.a.stops.some((x) => x.y === y && x.kind !== 'borrowed' && !x.approx) ? 'about ' : '');
  const moved = a.stays.length > 1;
  const given = (p.given ?? p.name ?? '').split(' ')[0].replace(/\.$/, '');
  const vagueDeath = a.a.stops.find((x) => (x.kind === 'death' || x.kind === 'burial') && ['area', 'country'].includes(world.places.get(x.p)!.prec));
  const how = a.hollow ? `<span class="badge"><i style="border:1.5px solid ${CERT.borrowed}"></i>No place of their own</span>` : a.vague ? `<span class="badge"><i style="background:${CERT.vague}"></i>Place known only roughly</span>` : `<span class="badge"><i style="background:${CERT.record}"></i>Placed by a record${firstRec > a.b + 2 || a.a.stops.some((x) => x.kind === 'borrowed' && x.y < firstRec) ? ` from ${about(firstRec)}${firstRec}` : ''}</span>`;
  const stops = a.a.stops.map((s) => `<li class="${s.kind === 'borrowed' ? 'coarse' : ''}"><b>${(s.kind === 'death' || s.kind === 'burial') && /^after/i.test(p.d?.text ?? '') && s.y === p.d!.y ? 'after ' : (s.kind === 'borrowed' ? p.b?.est && s.y === p.b.y : s.est || s.approx) ? 'c. ' : ''}${s.y}</b><span><button data-place="${esc(world.siteId(s.p))}">${esc(placeName(s.p))}</button><small>${esc(s.why)}${s.kind !== 'borrowed' && ['area', 'country'].includes(world.places.get(s.p)!.prec) ? (s.named ? ` · the record names ${esc(s.named)}, which is not placed on this map: drawn as a haze over the county` : ' · no closer place is given: drawn as a haze') : ''}${s.doubt ? ` · in doubt: ${esc(s.doubt)}` : ''}</small></span></li>`).join('');
  const kmText = (k: number) => (k >= 1000 ? (Math.round(k / 100) * 100).toLocaleString('en') : k >= 100 ? String(Math.round(k / 10) * 10) : String(Math.round(k)));
  // a country or a county is not a point: no distance is given to or from one
  const noKm = (l: Leg) => [l.a, l.b].some((id) => ['country', 'area'].includes(world.places.get(id)!.prec));
  const moves = a.legs.filter((l) => l.km > 3 && !l.within).map((l) => `<div class="move${l.doubt ? ' doubt' : l.sail ? ' sail' : ''}"><b>${esc(shortPlace(world.siteId(l.a)))} to ${esc(shortPlace(world.siteId(l.b)))}${noKm(l) ? '' : `, ${kmText(l.km)} km`}.</b> ${esc(windowText(l, (id) => shortPlace(world.siteId(id))))}${l.kind !== 'direct' && !l.assumed ? ' ' + esc(l.sail ? ROUTE_LABEL[l.kind] : `Drawn along a sea route usual in those years, not the course of one ship.${a.a.stops.some((x) => x.y === l.y1 && x.p === l.rb && /arrival|emigrated/.test(x.why)) ? ` The tree dates the arrival: ${l.d1 ?? l.y1}.` : ''} Anything the tree’s notes say of the voyage is in the River.`) : ''}${l.doubt ? ` <b style="color:#FFB4A8">The tree doubts this: ${esc(l.doubt)}. If the two records are two people, this move never happened.</b>` : ''}</div>`).join('');
  return `<button class="back" data-act="back">← Back</button>
  <div class="rec"><div class="rec-head">${p.photo ? `<img src="${esc(p.photo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar',textContent:'${esc((p.given ?? p.name ?? '?')[0])}'}))">` : `<div class="avatar">${esc((p.given ?? p.name ?? '?')[0])}</div>`}<div><h2>${esc(p.name)}</h2><div class="life">${esc(lifeText(p))}</div></div></div>
  <div class="badges"><span class="badge"><i style="background:${LINE_COLOUR[line]}"></i>${line} line</span>${how}</div>
  ${lines.length ? `<p class="lifelines">${esc(lines.join(' '))}</p>` : ''}
  ${a.hollow ? `<p>None of the dated, placed records the map reads gives a place for ${esc((p.given ?? p.name ?? '').replace(/\.$/, ''))}. The hollow light is drawn in ${esc(placeName(a.stays[0].p))}, where ${lender ? `<button class="inline" data-go="${esc(lender.id)}">${esc(lender.name)}</button>` : 'a close relative'} was. ${moved ? `While a child it goes where that parent is next recorded, and after that it stays put, because nothing says where ${esc(given)} went.` : `It does not move, because nothing says where ${esc(given)} went.`}${a.a.seen ? ` It is not drawn before ${a.a.seen}, ${esc(a.a.seenWhy ?? 'the first year that relative is recorded')}.` : ''}</p>` : ''}
  <h3>${a.hollow ? 'Why the light is here' : 'Where ' + esc((p.given ?? p.name ?? '').split(' ')[0]) + ' is placed, and why'}</h3><ol class="stops">${stops}</ol>
  ${a.a.stops.some((x) => x.kind === 'baptism' && a.a.stops.some((z) => z.kind === 'birth' && z.y === x.y + 1)) ? `<p class="fine">The baptism is listed a year before the birth because the record uses the old calendar, in which the year began on 25 March. A baptism early in ${p.b?.y} by our reckoning was still ${(p.b?.y ?? 0) - 1} by theirs.</p>` : ''}
  ${moves ? `<h3>Moves</h3>${moves}` : ''}
  ${a.on >= a.d ? (a.a.stops.filter((x) => x.kind !== 'borrowed').every((x) => x.kind === 'death' || x.kind === 'burial') ? `<p class="fine">The only record that places ${esc(given)} is a death or burial. There is no light on the map${a.ember ? `, only the ember left from ${about(a.d)}${a.d}` : ''}.</p>` : `<p class="fine">${esc(given)} is recorded within a single year, ${about(a.d)}${a.d}. A life that short leaves no lasting light on the map${a.ember ? ', only an ember' : ''}.</p>`) : a.a.seen ? `<p class="fine">The map reads no placed record of ${esc(given)} before ${about(a.a.seen)}${a.a.seen}, so no light is drawn until then.</p>` : ''}
  ${a.on >= a.d ? '' : p.d?.est ? `<p class="fine">The map reads no dated death. The light goes out seventy years after birth. No ember is left, only a faint ring at the last place the map has for them.</p>` : !a.ember ? (vagueDeath ? `<p class="fine">${esc(given)} died in ${esc(placeName(vagueDeath.p))}. The map reads no closer place, so no ember is left on the map, only a faint ring at the last place the map has for them.</p>` : `<p class="fine">The map reads no place for ${esc(given)}’s death, so no ember is left on the map, only a faint ring at the last place the map has for them.</p>`) : ''}
  <div class="actions">${a.legs.some((l) => l.km > 3 && !l.within) ? `<button class="btn solid" data-act="follow">Follow the journey</button>` : ''}<button class="btn quiet" data-act="family">Light the family</button><a class="btn quiet" id="open-river" href="./index.html#p=${encodeURIComponent(a.id)}&y=${Math.round(state.year)}">Open in the River</a></div></div>`;
}
function placeHtml(site: string): string {
  const pl = world.places.get(site)!, s = siteStats(site);
  const parishes = [...world.places.values()].filter((q) => q.town === site).map((q) => q.name.split(',')[0]);
  const list = (title: string, as: Actor[]) => (as.length ? `<h3>${title} (${as.length})</h3><div class="who">${as.sort((x, y) => x.b - y.b).map((a) => chip(a.id)).join('')}</div>` : '');
  return `<button class="back" data-act="back">← Back</button><div class="rec"><div class="kicker">${esc(pl.country)}</div><h2>${esc(pl.name)}</h2>
  <div class="life">${isFinite(s.y0) ? (s.y0 === s.y1 ? `Recorded in ${s.abt(s.y0)}${s.y0}` : `Recorded from ${s.abt(s.y0)}${s.y0} to ${s.abt(s.y1)}${s.y1}`) : 'Lights here are drawn with relatives only'}</div>
  <p>${PREC[pl.prec]}${(() => { const v = [...new Set(s.people.flatMap((a) => a.a.stops.filter((x) => x.p === site && x.named).map((x) => x.named!)))]; return v.length ? ` Some records here name a village that is not placed on this map (${esc(v.join(', '))}); they are drawn here too.` : ''; })()}${parishes.length ? ` Includes ${esc(parishes.join(', '))}.` : ''}</p>
  ${list('Born or baptised here', s.born)}${list('Died or buried here', s.died)}${list('Recorded here', s.here)}${list('Drawn here with a relative', s.lent)}
  <div class="actions">${isFinite(s.y0) ? `<button class="btn quiet" data-act="goyear" data-y="${s.y0}">Go to ${s.abt(s.y0)}${s.y0}</button>` : ''}</div></div>`;
}
function helpHtml(): string {
  const c = atlas.meta.counts;
  return `<button class="back" data-act="back">← Back</button><div class="kicker">A short guide</div><h2>How to read the atlas</h2><div class="rec guide">
  <p><b>Each light is a person.</b> It comes on at birth where a birth or baptism is recorded, and goes out when they die. ${world.actors.filter((a) => a.p.d!.est).length} of the ${world.actors.length} have no dated death among the records the map reads: their light goes out seventy years after birth, and leaves no ember, only the ring. ${world.actors.filter((a) => a.p.b!.est).length} people have no dated birth among them: their birth years are estimated from the family around them. The counts in the captions include these lights. Where a death or burial record names a town or parish, a small ember stays. Otherwise a fainter open ring stays at the last place the map has for them: it does not say they died there. Someone whose first record comes later in life is drawn hollow with a parent until then, or, with no parent to borrow from, not drawn until that record. A solid light dims as the years pass since a record last placed the person there.</p>
  <p><b>A solid light has a record behind it.</b> A birth, baptism, marriage, census, burial, or the recorded birth of a child, which places both parents. ${c.recorded} people are placed this way.</p>
  <p><b>A hollow light is borrowed.</b> ${c.borrowed} people have no placed record of the kind the map reads. They are drawn where a parent, partner, brother, sister or child was last recorded, never earlier than that relative’s own first record. A child drawn with a parent goes where that parent is next recorded, until sixteen. Otherwise a hollow light does not move.</p>
  <p><b>A haze is a place known only roughly.</b> “Derbyshire” or “New Zealand” and nothing closer. A county is drawn at its middle. A whole country is drawn just offshore, marked “somewhere in”, so that it cannot be mistaken for a town.</p>
  <p><b>Lines are moves.</b> Solid: both ends are recorded within three years of each other, and the light travels. Dashed: the records leave a longer gap, so the light waits where it was last recorded, dimming, and appears at the new place in the year a record finds it there. Dotted red: the tree itself doubts the two records are the same person.</p>
  <p><b>What the map reads.</b> The tree’s dated, placed records: births, baptisms, censuses, marriages, the births of children, deaths, burials, an occupation, residence or achievement the tree gives a year and a place, and an arrival, emigration or baptism the tree’s description of a person states with a date and a place. When this page says the map reads no record, it means none of those. A person’s notes in the tree may say more: they are in that person’s record in the River.</p>
  <p><b>Sea routes are custom, not record.</b> A voyage between Europe and New Zealand is drawn the way ships usually went: out round the Cape of Good Hope, and through Panama once the canal had opened in 1914. The line is not the course of any one ship. Where a note in the tree names a ship, it is in that person’s record in the River.</p>
  <p><b>Two ways to draw the Earth.</b> The globe stays with the family in Europe, crosses to New Zealand once, and stays there; drag it to look anywhere. Two shores is the flat map: Britain and New Zealand drawn large, with the ocean between them folded away. On a wide screen you can have both.</p>
  <p><b>Stars are findings.</b> A star on the map marks something the records show when you count: the first of the family in New Zealand, the move that is in doubt, the longest silence. It appears in the year it happens. Tap it to read it.</p>
  <p><b>Tap the Key.</b> Each colour in the Key is a button: tap a family line, a region or a kind of certainty to light only those people.</p>
  <p><b>Every country is named.</b> The row of countries above the map counts the lights lit in each this year. On the globe, a country out of view is named at the rim, in the direction it lies. Tap either to go there and see who it was.</p>
  <p><b>Who is missing.</b> ${c.living} living relatives are not shown at all. ${c.unplaced} people have no such record and no relative to borrow from. Most of the Polish lines are living or undated, which is why Poland is nearly dark.</p>
  <h3>Keys</h3><dl class="kv"><dt>Space</dt><dd>Play or pause</dd><dt>← →</dt><dd>One year. With Shift, ten. Home and End for the first and last year</dd><dt>↑ ↓</dt><dd>With the map focused, step through people in birth order</dd><dt>G S B</dt><dd>Globe, two shores, both</dd><dt>1 2 3</dt><dd>Surname, first place, certainty</dd><dt>/</dt><dd>Find a person or place</dd><dt>+ − 0</dt><dd>Zoom in, out, follow the family</dd><dt>Esc</dt><dd>Close, clear</dd></dl></div>`;
}

function renderLegend() {
  const el = $('#legend');
  // each swatch is a button: tap it to light just those people
  const sw1 = (key: string, colour: string, label: string) => `<button class="swatch" data-group="${esc(key)}" aria-pressed="${state.group === key}"><i style="background:${colour}"></i>${esc(label)}</button>`;
  const sw = state.lens === 'surname' ? LINES.filter((l) => world.actors.some((a) => lineOf(a.id) === l)).map((l) => sw1(l, LINE_COLOUR[l], l)).join('')
    : state.lens === 'place' ? [...new Set(world.actors.map((a) => world.places.get(a.stays[0].p)!.region))].map((r) => sw1(r, REGION_COLOUR[r] ?? '#A9B7CB', r)).join('')
    : sw1('record', CERT.record, 'Placed by a record') + sw1('borrowed', CERT.borrowed, 'With a relative') + sw1('vague', CERT.vague, 'County or country only') + sw1('disputed', CERT.disputed, 'Identity disputed');
  el.innerHTML = `<button class="key-toggle" aria-expanded="${!el.classList.contains('collapsed')}">Key</button>${sw}<span><i class="ring"></i>Hollow: no place of their own</span><span><i class="haze"></i>Known only roughly</span><span><i class="em"></i>Died here</span><span><i class="rest"></i>Last placed here</span><span><i class="ln"></i>Move, known to within three years</span><span><i class="ln d"></i>Move, some time in a window</span><span><i class="ln q"></i>Move in doubt</span><button data-act="help">How to read this</button>`;
}
function groupOf(a: Actor): string {
  if (state.lens === 'place') return world.places.get(a.stays[0].p)!.region;
  // someone whose only record of their own is a death or burial is drawn hollow all their life
  const hollowLife = a.hollow || (a.a.stops.some((x) => x.kind === 'borrowed') && a.a.stops.filter((x) => x.kind !== 'borrowed').every((x) => x.kind === 'death' || x.kind === 'burial'));
  if (state.lens === 'certainty') return a.disputed ? 'disputed' : hollowLife ? 'borrowed' : a.vague ? 'vague' : 'record';
  return lineOf(a.id);
}
function pickGroup(key: string) {
  stop();
  if (state.record) closeRecord();
  state.selected = null; state.place = null; state.finding = null; state.country = null; state.track = null; state.follow = null; trail.length = 0;
  state.group = state.group === key ? null : key;
  const ids = state.group ? world.actors.filter((a) => groupOf(a) === key).map((a) => a.id) : [];
  state.focus = state.group ? new Set(ids) : null;
  if (state.group) toast(`${ids.length} ${ids.length === 1 ? 'person' : 'people'}: ${key === 'record' ? 'placed by a record' : key === 'borrowed' ? 'drawn with a relative' : key === 'vague' ? 'known only to a county or country' : key === 'disputed' ? 'identity disputed' : key}. Tap again to clear.`);
  if (!state.group) document.querySelector('.toast')?.remove();
  renderCountries(state.year); renderLegend(); renderTab(); writeHash(); kick();
  refocus(`#legend [data-group="${key}"]`);
}
function setLens(lens: Lens) {
  if (state.group) { state.group = null; state.focus = null; }
  state.lens = lens;
  document.querySelectorAll<HTMLElement>('#lens button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === lens)));
  renderLegend(); if (!state.record) renderTab(); writeHash(); kick();
}
let legendSet = false;
function setView(view: View, quiet = false) {
  if (view === 'both' && (isSmall() || isSideways() || tooNarrowForBoth())) view = 'globe';
  state.view = view; $('#tip').hidden = true; document.body.dataset.view = view;
  document.querySelectorAll<HTMLElement>('.view button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === view)));
  const both = view === 'both';
  $('#views').classList.toggle('both', both);
  stages[1].canvas.hidden = !both;
  stages[0].setKind(view === 'both' ? 'globe' : view);
  stages[1].setKind('shores');
  if (!legendSet) { legendSet = true; $('#legend').classList.add('collapsed'); }
  document.querySelectorAll<HTMLButtonElement>('#zin, #zout').forEach((b) => { b.disabled = view === 'shores'; });
  renderLegend();
  for (const s of stages) s.resize();
  draw(true);
  if (!quiet) writeHash();
  kick();
}

// ---------------------------------------------------------------- chrome
function bindSearch() {
  const input = $<HTMLInputElement>('#search'), list = $('#results');
  type Hit = { kind: 'p' | 's' | 'c'; id: string; label: string; meta: string };
  const index: (Hit & { key: string })[] = [
    ...countries.map((c) => ({ kind: 'c' as const, id: c.name, label: c.name, meta: 'country', key: fold(c.name) })),
    ...[...world.atSite.keys()].map((s) => ({ kind: 's' as const, id: s, label: placeName(s), meta: 'place', key: fold(placeName(s) + ' ' + [...world.places.values()].filter((q) => q.town === s).map((q) => q.name).join(' ')) })),
    ...river.people.filter((p) => !p.living).map((p) => ({ kind: 'p' as const, id: p.id, label: p.name!, meta: shortLife(p), key: fold([p.name, ...(p.married ?? []), ...(p.variants ?? []), p.b && !p.b.est ? p.b.y : '', p.d && !p.d.est ? p.d.y : ''].join(' ')) })),
  ];
  let hits: Hit[] = [], cur = 0;
  const drawList = () => {
    list.hidden = !input.value.trim(); input.setAttribute('aria-expanded', String(!list.hidden));
    list.innerHTML = hits.length ? hits.map((h, i) => `<li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === cur}"><span>${esc(h.label)}</span><small>${esc(h.meta)}</small></li>`).join('') : `<li class="none">No person or place of that name. Living people cannot be searched.</li>`;
  };
  input.addEventListener('input', () => { const q = fold(input.value.trim()).split(/\s+/).filter(Boolean); hits = q.length ? index.filter((x) => q.every((w) => x.key.includes(w))).slice(0, 30) : []; cur = 0; drawList(); });
  const choose = (h: Hit) => {
    input.value = ''; list.hidden = true; input.blur();
    if (h.kind === 's') openPlace(h.id); else if (h.kind === 'c') { state.country = null; openCountry(h.id); } else select(h.id);
    // keyboard users land in the record they asked for, not back at the top of the page
    // (after this key press is over: a button focused mid-press would be pressed by it)
    setTimeout(() => (document.querySelector('#record:not([hidden]) .back') as HTMLElement | null)?.focus(), 60);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { cur = Math.min(hits.length - 1, cur + 1); drawList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); drawList(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[cur]) { e.preventDefault(); choose(hits[cur]); }
    else if (e.key === 'Escape') { input.value = ''; list.hidden = true; }
    const li = list.querySelector('[aria-selected="true"]') as HTMLElement | null; li?.scrollIntoView({ block: 'nearest' }); if (li) input.setAttribute('aria-activedescendant', li.id);
    e.stopPropagation();
  });
  list.addEventListener('pointerdown', (e) => { const li = (e.target as Element).closest('li[data-i]') as HTMLElement | null; if (li) { e.preventDefault(); choose(hits[Number(li.dataset.i)]); } });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  input.parentElement!.addEventListener('click', () => input.focus());
}
function radio(sel: string, pick: (b: HTMLElement) => void) {
  const btns = [...document.querySelectorAll<HTMLElement>(sel)];
  for (const b of btns) {
    b.addEventListener('click', () => pick(b));
    b.addEventListener('keydown', (e) => {
      const live = btns.filter((x) => x.offsetParent !== null), i = live.indexOf(b);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = live[(i + (e.key === 'ArrowRight' ? 1 : -1) + live.length) % live.length]; n.focus(); pick(n); e.preventDefault(); e.stopPropagation(); }
    });
  }
}
function bindChrome() {
  radio('#lens button', (b) => setLens(b.dataset.lens as Lens));
  radio('.view button', (b) => setView(b.dataset.view as View));
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab as Tab; renderTab(); openSheet(true); }));
  // left and right move between the tabs, not the year
  (document.querySelector('.tabs') as HTMLElement).addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const bs = [...document.querySelectorAll<HTMLElement>('.tabs button')], i = bs.indexOf(document.activeElement as HTMLElement); if (i < 0) return;
    e.preventDefault(); e.stopPropagation(); const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click();
  });
  $('#play').addEventListener('click', () => (state.playing ? stop() : play(resumeFollow())));
  $('#zin').addEventListener('click', () => { for (const s of stages) s.zoomBy(1.5); kick(); });
  $('#zout').addEventListener('click', () => { for (const s of stages) s.zoomBy(1 / 1.5); kick(); });
  $('#zfit').addEventListener('click', () => { state.follow = null; for (const s of stages) s.resume(); kick(); });
  $('#grab').addEventListener('click', () => openSheet(!$('#panel').classList.contains('open')));

  const track = $('#track');
  const at = (e: PointerEvent) => { const r = track.getBoundingClientRect(); return Math.round(trackMin + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (thisYear - trackMin)); };
  let dragging = false;
  track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); stop(); $('#hint').hidden = true; setYear(at(e)); });
  track.addEventListener('pointermove', (e) => { if (dragging) setYear(at(e)); });
  track.addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('pointercancel', () => { dragging = false; });
  track.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'PageDown' ? -25 : e.key === 'PageUp' ? 25 : 0;
    if (d) { stop(); setYear(state.year + d); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'Home') { stop(); setYear(trackMin); e.preventDefault(); }
    if (e.key === 'End') { stop(); setYear(thisYear); e.preventDefault(); }
  });
  $('#views').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { stepPerson(1); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowUp') { stepPerson(-1); e.preventDefault(); e.stopPropagation(); }
  });

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const key = t.closest('.key-toggle');
    if (key) { $('#legend').classList.toggle('collapsed'); key.setAttribute('aria-expanded', String(!$('#legend').classList.contains('collapsed'))); return; }
    const grp = t.closest<HTMLElement>('[data-group]');
    if (grp) { pickGroup(grp.dataset.group!); return; }
    if (!state.record) { const src = t.closest<HTMLElement>('[data-country], [data-act="help"], [data-place], [data-go]'); opener = !src ? null : src.id ? `#${src.id}` : src.dataset.country ? `#countries [data-country="${src.dataset.country}"]` : src.dataset.act ? '[data-act="help"]' : src.dataset.place ? `#panel-body [data-place="${src.dataset.place}"]` : `#panel-body [data-go="${src.dataset.go}"]`; }
    const ctry = t.closest<HTMLElement>('[data-country]');
    if (ctry) { openCountry(ctry.dataset.country!); return; }
    const go = t.closest<HTMLElement>('[data-go]');
    if (go) { select(go.dataset.go!); return; }
    const pl = t.closest<HTMLElement>('[data-place]');
    if (pl) { openPlace(pl.dataset.place!); return; }
    const rd = t.closest<HTMLElement>('[data-ride]');
    if (rd) { const a = world.byId.get(rd.dataset.ride!)!, l = a.legs.find((x) => x.sail && x.km > 9000)!; select(a.id); setYear(l.y0 - 1); play(a.id); openSheet(false); return; }
    const f = t.closest<HTMLElement>('[data-finding]');
    if (f) { openFinding(f.dataset.finding!); return; }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'back') goBack();
    else if (act === 'help') { stop(); clearToast(); family = null; state.selected = null; state.place = null; state.focus = null; state.track = null; trail.length = 0; openRecord('help', helpHtml()); kick(); }
    else if (act === 'unplaced') { state.tab = 'people'; renderTab(); openSheet(true); document.querySelector('#unplaced')?.scrollIntoView({ block: 'start' }); }
    else if (act === 'goyear') { stop(); setYear(Number(t.closest<HTMLElement>('[data-y]')!.dataset.y)); openSheet(false); }
    else if (act === 'family' && state.selected) {
      // parents, brothers and sisters, partners and children, lit together: where one household ended up
      const p0 = P.get(state.selected)!, ids = new Set<string>([p0.id]);
      const fams = [p0.parents, ...p0.fams].filter(Boolean).map((fid) => F.get(fid!)).filter(Boolean) as Family[];
      for (const f of fams) for (const id of [...f.partners, ...f.children]) if (world.byId.has(id)) ids.add(id);
      stop(); closeRecord(); state.selected = null; state.track = null; state.focus = ids; trail.length = 0;
      family = ids; familySide = state.year >= stages[0].plan.turn;
      renderTab(); const lit = [...ids].filter((id) => world.lightOf(world.byId.get(id)!, state.year + 0.5)).length;
      const away = frameFamily(); if (!lit) frameIds([...ids]);
      toast(ids.size === 1 ? `None of ${p0.given?.split(' ')[0] ?? 'this person'}’s close family is on the map. Esc to clear.` : `${ids.size} of ${p0.given?.split(' ')[0] ?? 'the'}’s close family, counting ${p0.sex === 'F' ? 'her' : p0.sex === 'M' ? 'him' : 'them'}, are on the map, ${lit} of them lit in ${Math.round(state.year)}.${away ? ` ${away} ${away === 1 ? 'is' : 'are'} on the other side of the world: Two shores shows both.` : ''} Scrub the year to see where each ended up. Esc to clear.`, 8000); openSheet(false); writeHash(); kick();
      refocus('#views');
    }
    else if (act === 'follow' && state.selected) {
      const a = world.byId.get(state.selected)!;
      (document.activeElement as HTMLElement | null)?.blur();
      stop(); setYear(Math.max(trackMin, Math.min(a.on, a.stays[0].from) - 1)); play(a.id); openSheet(false);
      refocus('#play');
    }
  });
  $('#panel-body').addEventListener('input', (e) => {
    const inp = e.target as HTMLInputElement; if (inp.id !== 'pfilter') return;
    const q = fold(inp.value.trim()).split(/\s+/).filter(Boolean);
    let shown = 0;
    document.querySelectorAll<HTMLElement>('#plist li').forEach((li) => { li.hidden = !q.every((w) => li.dataset.key!.includes(w)); if (!li.hidden) shown++; });
    $('#pnone').hidden = shown > 0;
  });
  document.addEventListener('pointerdown', () => document.body.classList.remove('kbd'), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') document.body.classList.add('kbd');
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === ' ' && !t.matches('button, a')) { e.preventDefault(); if (state.playing) stop(); else play(resumeFollow()); }
    else if (e.key === 'ArrowLeft') { stop(); setYear(state.year - (e.shiftKey ? 10 : 1)); }
    else if (e.key === 'ArrowRight') { stop(); setYear(state.year + (e.shiftKey ? 10 : 1)); }
    else if (e.key === 'Home') { stop(); setYear(trackMin); } else if (e.key === 'End') { stop(); setYear(thisYear); }
    else if (e.key === '1') setLens('surname'); else if (e.key === '2') setLens('place'); else if (e.key === '3') setLens('certainty');
    else if (k === 'g') setView('globe'); else if (k === 's') setView('shores'); else if (k === 'b') setView('both');
    else if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    else if (e.key === '+' || e.key === '=') $('#zin').click(); else if (e.key === '-') $('#zout').click(); else if (e.key === '0') $('#zfit').click();
    else if (e.key === 'Escape') { if (state.record === 'help') { closeRecord(); renderTab(); } else clearAll(); refocus(opener ?? '#views'); opener = null; }
  });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => { if (state.view === 'both' && (isSmall() || isSideways() || tooNarrowForBoth())) setView('globe'); for (const s of stages) s.resize(); fitChips(); syncInset(); draw(true); }, 80); });
  addEventListener('popstate', () => applyHash());
}

// ---------------------------------------------------------------- deep links
let hashTimer = 0, pushed = false, hashYear = false;
function writeHash() {
  clearTimeout(hashTimer);
  // a step Back can undo is recorded at once; the rest can wait for the year to stop moving
  if (pushed) { flushHash(); return; }
  hashTimer = window.setTimeout(flushHash, 250);
}
function flushHash() {
  {
    const q = new URLSearchParams();
    q.set('y', String(Math.round(state.year)));
    if (state.selected) q.set('p', state.selected);
    if (state.place) q.set('pl', state.place);
    if (state.finding) q.set('f', state.finding);
    if (state.country) q.set('c', state.country);
    if (state.view !== 'globe') q.set('v', state.view);
    if (state.lens !== 'surname') q.set('lens', state.lens);
    const url = '#' + q.toString();
    // opening a person, place or country is a step Back can undo; everything else just updates the address
    if (pushed && url !== location.hash) history.pushState(null, '', url); else history.replaceState(null, '', url);
    pushed = false;
    const link = new URLSearchParams({ y: String(Math.round(state.year)), ...(state.selected ? { p: state.selected } : {}) }).toString();
    $<HTMLAnchorElement>('#to-river').href = './index.html#' + link;
    const open = document.querySelector<HTMLAnchorElement>('#open-river');
    if (open && state.selected) open.href = './index.html#' + link;
  }
}
function readHash(): boolean {
  const q = new URLSearchParams(location.hash.slice(1));
  hashYear = false;
  if (![...q.keys()].length) return false;
  const y = Number(q.get('y')); if (y) { state.year = Math.max(trackMin, Math.min(thisYear, y)); hashYear = true; } else state.year = peakYear;
  const lens = q.get('lens'); if (lens === 'place' || lens === 'certainty' || lens === 'surname') state.lens = lens;
  const v = q.get('v'); if (v === 'globe' || v === 'shores' || v === 'both') state.view = v;
  const p = q.get('p'); state.selected = p && P.has(p) && !P.get(p)!.living ? p : null;
  const pl = q.get('pl'); state.place = pl && world.atSite.has(pl) ? pl : null;
  const f = q.get('f'); state.finding = f && [...atlas.facts, ...atlas.leads].some((x) => x.id === f) ? f : null;
  const c = q.get('c'); state.country = c && countries.some((x) => x.name === c) ? c : null;
  return true;
}
/** Put the page into the state the address asks for. With no year in the address, a person or place chooses its own. */
function restore(moveYear: boolean) {
  const sel = state.selected, pl = state.place, f = state.finding, co = state.country;
  state.selected = state.place = state.finding = state.country = null; state.focus = null; state.track = null; trail.length = 0;
  if (!location.hash && reduceMotion) state.year = peakYear;
  setYear(state.year); renderTab();
  if (sel) select(sel, true); else if (pl) openPlace(pl, moveYear); else if (co) openCountry(co, moveYear); else if (f) openFinding(f, moveYear); else openSheet(false);
  pushed = false;
}
function applyHash() {
  stop(); if (state.record) closeRecord();
  state.year = thisYear; state.lens = 'surname'; state.view = 'globe';
  readHash();
  setView(state.view, true); setLens(state.lens);
  restore(!hashYear);
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<p style="padding:40px;font:16px system-ui;color:#EAF0F7">The atlas could not be loaded. ${esc(String(err?.message ?? err))}</p>`;
});
