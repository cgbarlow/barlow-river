// The Atlas page: the River's timelapse, drawn on the Earth.

import '../style.css';
import '../atlas.css';
import type { GeoPermissibleObjects } from 'd3-geo';
import land from './land.json';
import type { Family, Lead, Person, RiverData } from '../model/types.ts';
import type { AtlasData, AtlasPlace } from '../model/atlas-types.ts';
import { buildLayout, LINES, type Layout, type LineName } from '../model/layout.ts';
import { lifeLines } from '../model/kin.ts';
import { ROUTE_LABEL, type LonLat } from '../model/geo.ts';
import { windowText } from '../model/journey.ts';
import { SOFT_BREAKS } from '../casefile.ts';
import { LINE_COLOUR, REGION_COLOUR } from '../river.ts';
import { World, type Actor, type Scene } from './scene.ts';
import { Stage, type Lands, type Pointer, type ViewKind } from './stage.ts';

type Lens = 'surname' | 'place' | 'certainty';
type View = ViewKind | 'both';
type Tab = 'journeys' | 'places' | 'people';
const CERT = { record: '#7BE0B5', borrowed: '#8FA3C2', vague: '#F2C14E', disputed: '#FF8A7A' };

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
const isSmall = () => matchMedia('(max-width: 900px) and (max-aspect-ratio: 13/10)').matches;
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
  focus: null as Set<string> | null, follow: null as string | null,
  /** keep the selected person in view as the year moves, until the user takes the camera */
  track: null as string | null, record: null as 'person' | 'place' | 'country' | 'help' | null,
};

// ---------------------------------------------------------------- words
const lifeText = (p: Person) => {
  const b = p.b?.est ? `c. ${p.b.y}?` : (p.b?.kind === 'bap' ? 'bapt. ' : '') + (p.b?.text ?? '?');
  const d = p.d && !p.d.est ? (p.d.kind === 'bur' ? 'bur. ' : '') + p.d.text : '';
  return d ? `${b} – ${d}` : `${p.b?.est ? '' : 'b. '}${b}`;
};
const shortLife = (p: Person) => `${p.b?.est || p.b?.approx ? 'c.' : ''}${p.b?.y ?? '?'}${p.d && !p.d.est ? '–' + (p.d.approx ? 'c.' : '') + p.d.y : ''}`;
const lineOf = (id: string): LineName => L.spots.get(id)?.stream.line ?? 'Barlow';
const placeName = (id: string) => world.places.get(id)!.name;
const shortPlace = (id: string) => placeName(id).split(',')[0].replace(' (then Alexandra)', '');
const PREC: Record<string, string> = { parish: 'Known to the parish.', town: 'Known to the town or village.', area: 'Known only to the county or region. Drawn as a haze at its centre, not as a point.', country: 'Known only to the country. Drawn as a haze at its centre, not as a point.' };

function colourOf(a: Actor): string {
  if (state.lens === 'place') return REGION_COLOUR[world.places.get(a.stays[0].p)!.region] ?? '#A9B7CB';
  if (state.lens === 'certainty') return a.disputed ? CERT.disputed : a.hollow ? CERT.borrowed : a.vague ? CERT.vague : CERT.record;
  return LINE_COLOUR[lineOf(a.id)];
}
function toast(msg: string) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}

// ---------------------------------------------------------------- boot
async function boot() {
  [river, atlas] = await Promise.all([fetch('./data/river.json').then((r) => r.json()), fetch('./data/atlas.json').then((r) => r.json())]);
  P = new Map(river.people.map((p) => [p.id, p]));
  F = new Map(river.families.map((f) => [f.id, f]));
  L = buildLayout(river, new Set(SOFT_BREAKS));
  world = new World(river, atlas);
  thisYear = river.meta.thisYear; state.year = thisYear;
  trackMin = Math.floor(Math.min(...world.actors.map((a) => a.on)) / 10) * 10 - 10;
  // with no year asked for, open on the year with the most lights, not on an empty present
  { let best = 0; for (let y = trackMin; y <= thisYear; y += 5) { const n = world.actors.filter((a) => a.on <= y && y < a.d).length; if (n > best) { best = n; peakYear = y; } } }
  const c = atlas.meta.counts;
  $('#eyebrow').textContent = isSmall() ? `${c.recorded + c.borrowed} people · ${world.atSite.size} places · ${c.moves} moves` : `Barlow family · ${c.recorded + c.borrowed} people · ${world.atSite.size} places · ${c.moves} moves`;
  const ev = {
    onPick: (person: string | null, site: string | null) => { if (person) select(person); else if (site) openPlace(site); else if (state.selected || state.focus || state.place) clearAll(); },
    onHover: hover,
    onCountry: (name: string) => openCountry(name),
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
  (window as unknown as Record<string, unknown>).__atlas = { state, world, stages, openCountry, counts: () => Object.fromEntries(counts), plan: stages[0].plan, atlas, setYear, play, stop, select, openPlace, setView, setLens, scene: () => lastScene, settle: () => { draw(true); draw(true); } };
}

// ---------------------------------------------------------------- drawing loop
let frames = 0, raf = 0, lastT = 0, playYear = 0;
function kick(n = 160) { frames = Math.max(frames, n); if (!raf) raf = requestAnimationFrame(loop); }
function loop(now: number) {
  raf = 0;
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (state.playing) {
    const fol = state.follow ? world.byId.get(state.follow) : null;
    const sailing = Boolean(lastScene?.ship) || Boolean(fol && lastScene?.lights.some((l) => l.actor === fol && l.moving));
    const speed = sailing ? 0.3 : fol ? 5 : playYear < 1650 ? 14 : 8;
    playYear += dt * speed;
    const end = fol ? Math.min(thisYear, fol.stays[fol.stays.length - 1].from + 2) : thisYear;
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
  const fol = world.byId.get(state.follow ?? state.track ?? '') ?? null;
  const follow: LonLat | null = fol ? world.lightOf(fol, y) : null;
  const pointers: Pointer[] = countries.map((c) => ({ name: c.name, ll: c.ll, n: counts.get(c.name) ?? 0, on: state.country === c.name }));
  for (const s of stages) if (!s.canvas.hidden) s.draw(sc, state.selected, { follow, snap: snap || reduceMotion, pointers });
}

// ---------------------------------------------------------------- countries
let countries: ReturnType<World['countries']> = [];
let counts = new Map<string, number>();
/** One chip per country the records name, with how many lights are lit there this year. */
function renderCountries(year: number) {
  counts = new Map();
  for (const a of world.actors) { const c = world.countryOf(a, year); if (c) counts.set(c, (counts.get(c) ?? 0) + 1); }
  const sea = counts.get('sea') ?? 0;
  $('#countries').innerHTML = countries.map((c) => { const n = counts.get(c.name) ?? 0; return `<button data-country="${esc(c.name)}" aria-pressed="${state.country === c.name}" class="${n ? '' : 'none'}" title="${esc(c.name)}: ${n} lit in ${year}, ${c.people.length} people in all">${esc(c.name)} <b>${n}</b></button>`; }).join('') + (sea ? `<span class="sea">At sea <b>${sea}</b></span>` : '');
}
function openCountry(name: string, moveYear = true) {
  const c = countries.find((x) => x.name === name); if (!c) return;
  stop();
  if (state.country === name && state.record === 'country') { clearAll(); return; }
  state.country = name; state.selected = null; state.place = null; state.finding = null; state.follow = null; state.track = null;
  remember('country', name);
  state.focus = new Set(c.people.map((a) => a.id));
  if (moveYear && !(counts.get(name) ?? 0)) setYear(c.first);
  renderCountries(state.year);
  for (const s of stages) s.frame(c.sites.map((id) => world.ll(id)));
  openRecord('country', countryHtml(c));
  writeHash(); kick();
}
function countryHtml(c: (typeof countries)[number]): string {
  const here = (id: string) => world.places.get(id)!.country === c.name;
  const own = c.people.filter((a) => !a.hollow), lent = c.people.filter((a) => a.hollow);
  const recorded = (a: Actor) => a.a.stops.filter((s) => s.kind !== 'borrowed' && here(s.p));
  // everyone counted is listed once, by how they first appear here
  const born = own.filter((a) => recorded(a).some((s) => s.kind === 'birth' || s.kind === 'baptism'));
  const came = own.filter((a) => !born.includes(a) && recorded(a).length && a.stays.some((s) => !here(s.p) && s.from <= Math.min(...recorded(a).map((x) => x.y))));
  const rest = own.filter((a) => !born.includes(a) && !came.includes(a));
  const died = own.filter((a) => recorded(a).some((s) => s.kind === 'death' || s.kind === 'burial'));
  const ys = own.flatMap((a) => recorded(a).map((s) => s.y));
  const first = ys.length ? Math.min(...ys) : null, last = ys.length ? Math.max(...ys) : null;
  const list = (title: string, as: Actor[]) => (as.length ? `<h3>${title} (${as.length})</h3><div class="who">${[...as].sort((x, y) => x.b - y.b).slice(0, 60).map((a) => chip(a.id)).join('')}${as.length > 60 ? `<span class="rel">and ${as.length - 60} more: see the People tab</span>` : ''}</div>` : '');
  return `<button class="back" data-act="back">← Back</button><div class="rec"><div class="kicker">Country</div><h2>${esc(c.name)}</h2>
  <div class="life">${first == null ? 'No record of its own' : first === last ? `Recorded in ${first}` : `Recorded from ${first} to ${last}`} · ${counts.get(c.name) ?? 0} lit in ${Math.round(state.year)}</div>
  <p>${c.people.length} ${c.people.length === 1 ? 'person is' : 'people are'} placed here at some time, in ${c.sites.length} ${c.sites.length === 1 ? 'place' : 'places'}${lent.length ? `: ${own.length} by a record, ${lent.length} drawn with a relative` : ''}.${c.name === 'Poland' ? ' Most of the Polish lines are living or have no place recorded, so Poland is nearly dark on this map. That is a gap in the records, not in the family.' : ''}</p>
  <h3>Places (${c.sites.length})</h3><div class="who">${c.sites.map((id) => `<button data-place="${esc(id)}">${esc(shortPlace(id))}</button>`).join('')}</div>
  ${list('Born or baptised here', born)}${list('Came here from another country', came)}${list('First recorded here later in life', rest)}${list('Drawn here with a relative', lent)}
  ${died.length ? `<h3>Of those, died or buried here (${died.length})</h3><div class="who">${[...died].sort((x, y) => x.d - y.d).slice(0, 60).map((a) => chip(a.id)).join('')}${died.length > 60 ? `<span class="rel">and ${died.length - 60} more</span>` : ''}</div>` : ''}
  ${first != null ? `<div class="actions"><button class="btn quiet" data-act="goyear" data-y="${first}">Go to ${first}</button></div>` : ''}</div>`;
}

// ---------------------------------------------------------------- time
function setYear(y: number, fromPlay = false) {
  y = Math.max(trackMin, Math.min(thisYear, y));
  if (!fromPlay) playYear = y;
  const shown = Math.round(y);
  const changed = shown !== state.year;
  state.year = fromPlay ? shown : y === shown ? shown : y;
  if (changed || !fromPlay) {
    state.year = shown;
    $('#year').textContent = String(shown);
    const alive = world.actors.filter((a) => a.on <= shown && shown < a.d).length;
    $('#alive').textContent = shown >= thisYear ? `${atlas.meta.counts.living} living, not shown` : `${alive} lit`;
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
  document.body.classList.add('playing');
  $('#play').setAttribute('aria-label', 'Pause the timeline');
  kick();
}
function stop() {
  if (!state.playing) return;
  state.playing = false; state.year = Math.round(playYear);
  document.body.classList.remove('playing');
  $('#play').setAttribute('aria-label', 'Play the timeline');
  kick();
}
function intro() {
  setYear(trackMin + 10);
  draw(true);
  const hint = $('#hint'); hint.hidden = false;
  setTimeout(() => { hint.hidden = true; }, 6000);
  setTimeout(() => { if (state.year < trackMin + 14 && !state.selected && !state.record) play(); }, 900);
}

// captions: the moves themselves, in a sentence, as the year reaches them
interface Beat { y: number; text: string }
let beats: Beat[] = [];
function buildBeats() {
  const groups = new Map<string, { y0: number; y1: number; from: string; to: string; sail: boolean; doubt?: string; who: string[] }>();
  for (const a of world.actors) a.legs.forEach((l) => {
    if (l.km < 1500 && !l.doubt) return;
    const from = shortPlace(world.siteId(l.a)), to = shortPlace(world.siteId(l.b)), key = [l.y0, l.y1, from, to].join('|');
    const g = groups.get(key) ?? { y0: l.y0, y1: l.y1, from, to, sail: l.sail, doubt: l.doubt, who: [] };
    g.who.push(a.p.name!); groups.set(key, g);
  });
  for (const g of groups.values()) {
    const who = g.who.length > 2 ? `${g.who[0]} and ${g.who.length - 1} others` : g.who.join(' and ');
    if (g.doubt) beats.push({ y: g.y1, text: `A Francis Barlow is a father in ${g.to}. If he is the boy baptised at ${g.from}, he came 250 km and was fifteen. The tree doubts it.` });
    else if (g.sail) beats.push({ y: g.y0, text: `${who}: in ${g.from} in ${g.y0}, in ${g.to} by ${g.y1}. The voyage falls in ${g.y1 === g.y0 ? 'that year' : 'those years'}.` });
    else beats.push({ y: g.y1, text: `By ${g.y1} ${who} ${g.who.length > 1 ? 'are' : 'is'} in ${g.to}. Last recorded in ${g.from} in ${g.y0}.` });
  }
  // the first of each line recorded in a new country
  const seen = new Set<string>();
  for (const a of [...world.actors].sort((x, y) => x.b - y.b)) {
    if (a.hollow) continue;
    const s = a.a.stops.find((x) => x.kind === 'birth' || x.kind === 'baptism'); if (!s) continue;
    const country = world.places.get(s.p)!.country, key = lineOf(a.id) + '|' + country;
    if (seen.has(key)) continue; seen.add(key);
    if (country !== 'England' && !beats.some((b) => Math.abs(b.y - a.b) < 2)) beats.push({ y: a.b, text: `${a.p.name} is born in ${shortPlace(world.siteId(s.p))}: the first of the ${lineOf(a.id)} line recorded in ${country}.` });
  }
  beats.sort((a, b) => a.y - b.y);
  // say once what every later "by" means, on the first long gap
  const firstGap = beats.find((b) => /^By \d/.test(b.text));
  if (firstGap) firstGap.text += ' Nobody wrote down when they went, or on what ship. The map shows only what the records say.';
  const lastDeath = Math.max(...world.actors.map((a) => a.d));
  beats.push({ y: Math.min(thisYear, lastDeath), text: `The map goes dark here, but the family does not. ${atlas.meta.counts.living} living relatives carry on from these places. They are not shown.` });
}
let shownBeat: Beat | null = null;
function caption(fromPlay: boolean) {
  let b: Beat | null = null;
  if ((fromPlay && !state.follow) || state.year >= thisYear) for (const x of beats) if (x.y <= state.year && state.year < x.y + 9) b = x;
  if (b === shownBeat) return;
  shownBeat = b;
  const el = $('#caption'); el.classList.toggle('on', Boolean(b));
  if (b) el.innerHTML = `<b>${b.y}</b>${esc(b.text)}`;
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
  if (person) { const a = world.byId.get(person)!; tip.innerHTML = `<b>${esc(a.p.name)}</b><small>${esc(shortLife(a.p))}${a.hollow ? ' · no place of their own' : ''}</small>`; }
  else tip.innerHTML = `<b>${esc(placeName(site!))}</b><small>${world.atSite.get(site!)?.length ?? 0} people</small>`;
  tip.hidden = false; tip.style.left = Math.min(innerWidth - 270, x + 14) + 'px'; tip.style.top = y + 14 + 'px';
}
function frameIds(ids: string[]) {
  const lls: LonLat[] = [];
  for (const id of ids) { const a = world.byId.get(id); if (!a) continue; const y = Math.max(a.on, Math.min(a.d - 1, state.year)); const ll = world.lightOf(a, y) ?? world.ll(a.stays[0].p); lls.push(ll); }
  for (const s of stages) s.frame(lls);
}
function clearAll() {
  stop(); state.selected = null; state.place = null; state.finding = null; state.focus = null; state.follow = null; state.track = null; state.country = null; trail.length = 0;
  closeRecord(); renderTab(); renderCountries(state.year); writeHash(); kick();
}
function select(id: string | null, moveYear = true) {
  if (!id || !world.byId.has(id)) { if (id && P.get(id) && !P.get(id)!.living) { toast(`${P.get(id)!.name} has no recorded place and is not on the map`); openPeopleAt(id); } return; }
  stop();
  const a = world.byId.get(id)!;
  state.selected = id; state.place = null; state.focus = null; state.finding = null; state.follow = null; state.country = null; renderCountries(state.year);
  // a person not alive in the chosen year is shown in the year they are first recorded
  if (moveYear && (state.year < a.on || state.year >= a.d)) setYear(Math.min(a.d - 1, Math.max(a.on, a.stays[0].from)));
  // the camera stays with them as the year moves, until the user drags it away
  state.track = id; for (const s of stages) s.resume();
  remember('person', id);
  openRecord('person', personHtml(a));
  writeHash(); kick();
}
function openPlace(site: string, moveYear = true) {
  if (!world.places.has(site)) return;
  stop();
  const people = world.atSite.get(site) ?? [];
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
  stop();
  if (state.finding === id) { const top = $('#panel-body').scrollTop; state.finding = null; state.focus = null; renderTab(); $('#panel-body').scrollTop = top; writeHash(); kick(); return; }
  state.finding = id; state.selected = null; state.place = null; state.follow = null; state.track = null; state.country = null; trail.length = 0; renderCountries(state.year);
  state.focus = new Set(f.people);
  if (moveYear) setYear(f.y);
  frameIds(f.people.filter((p) => world.byId.has(p)));
  if (state.record) closeRecord();
  state.tab = 'journeys'; renderTab(); writeHash(); kick();
  document.querySelector('#panel-body .card.on')?.scrollIntoView({ block: 'nearest' });
  if (isSmall()) openSheet(false);
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
  if (k !== 'help') openSheet(false);
}
function openPeopleAt(id: string) { state.tab = 'people'; if (state.record) closeRecord(); renderTab(); openSheet(true); document.querySelector(`[data-go="${id}"], [data-none="${id}"]`)?.scrollIntoView({ block: 'center' }); }
let birthOrder: string[] = [];
function stepPerson(dir: number) {
  if (!birthOrder.length) birthOrder = [...world.actors].sort((a, b) => a.on - b.on).map((a) => a.id);
  let i = state.selected ? birthOrder.indexOf(state.selected) : -1;
  if (i < 0) { i = birthOrder.findIndex((id) => world.byId.get(id)!.on >= state.year); if (i < 0) i = birthOrder.length - 1; i -= dir > 0 ? 1 : 0; }
  i = Math.max(0, Math.min(birthOrder.length - 1, i + dir));
  select(birthOrder[i]);
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
  return `<button class="card${on ? ' on' : ''}" data-finding="${esc(f.id)}" aria-pressed="${on}"><span class="chip ${kind}">${kind === 'fact' ? 'Counted from the records' : 'Worth a second look'}</span><span class="t">${esc(f.title)}</span><span class="b${on ? '' : ' clip'}">${esc(f.body)}</span></button>${on ? `<div class="who">${who.slice(0, 8).map(chip).join('')}${who.length > 8 ? `<span class="rel">and ${who.length - 8} more</span>` : ''}</div>` : ''}`;
}
function journeysHtml(): string {
  const c = atlas.meta.counts;
  return `<div class="kicker">Where the family was</div><h2>Births, deaths and the moves between</h2>
  <p class="lede">Every light is a person, shown where the records put them in the chosen year. Press play and watch four centuries pass.</p>
  <div class="counts"><div><b>${c.recorded}</b>people placed by a record of their own, or of their child’s birth or their marriage</div><div><b>${c.borrowed}</b>with no place recorded: drawn hollow, where a close relative was</div><div><b>${c.unplaced}</b>with no place and no one to borrow from: <button class="inline" data-act="unplaced">not on the map</button></div><div><b>${c.living}</b>living relatives: not shown at all</div></div>
  <div class="proofline"><b>What the map cannot know.</b> The records say where someone was in a given year. They almost never say when a move happened. A solid line is a move known to within three years. A dashed line is a move that happened some time in a longer gap: the light stays where it was last recorded, dimming, and appears at the new place only in the year a record finds it there. Nobody is drawn anywhere before a record puts them there.</div>
  <h3>What the map shows</h3><div class="cards">${atlas.facts.map((f) => findingCard(f, 'fact')).join('')}</div>
  <h3>Worth a second look</h3><div class="cards">${atlas.leads.map((f) => findingCard(f, 'lead')).join('')}</div>
  <p class="fine">Places were set by hand from the place names in the tree. No address or map service was used, so nothing about the family left this page’s build. Voyages between Europe and New Zealand are drawn along the usual sea route of their time; the tree names no ship.</p>`;
}
function siteStats(site: string) {
  const people = world.atSite.get(site) ?? [];
  const born: Actor[] = [], died: Actor[] = [], here: Actor[] = [], lent: Actor[] = [];
  let y0 = Infinity, y1 = -Infinity;
  for (const a of people) {
    const st = a.a.stops.filter((s) => world.siteId(s.p) === site && !s.coarse);
    if (a.hollow) { lent.push(a); continue; }
    for (const s of st) { y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
    if (st.some((s) => s.kind === 'birth' || s.kind === 'baptism')) born.push(a);
    if (st.some((s) => s.kind === 'death' || s.kind === 'burial')) died.push(a);
    if (!st.some((s) => ['birth', 'baptism', 'death', 'burial'].includes(s.kind))) here.push(a);
  }
  return { people, born, died, here, lent, y0, y1 };
}
function placesHtml(): string {
  const rows = [...world.atSite.keys()].map((site) => ({ site, s: siteStats(site) })).sort((a, b) => (b.s.people.length - b.s.lent.length) - (a.s.people.length - a.s.lent.length) || b.s.people.length - a.s.people.length);
  return `<div class="kicker">${rows.length} places</div><h2>Where the records point</h2><p class="lede">Busiest first. Tap one to go there.</p>
  <ul class="plist">${rows.map(({ site, s }) => `<li><button data-place="${esc(site)}"><i style="background:${REGION_COLOUR[world.places.get(site)!.region] ?? '#A9B7CB'}"></i><span>${esc(placeName(site))}<small>${s.born.length ? `${s.born.length} born · ` : ''}${s.died.length ? `${s.died.length} died · ` : ''}${s.people.length} people${s.lent.length ? `, ${s.lent.length} of them placed here with a relative` : ''}</small></span><small>${isFinite(s.y0) ? (s.y0 === s.y1 ? s.y0 : `${s.y0}–${s.y1}`) : ''}</small></button></li>`).join('')}</ul>`;
}
function peopleHtml(): string {
  const rows = [...world.actors].sort((a, b) => a.b - b.b);
  const none = atlas.unplaced.map((id) => P.get(id)!).filter(Boolean);
  return `<div class="kicker">${rows.length} people on the map</div><h2>Everyone, in order of birth</h2>
  <input class="filter" id="pfilter" type="search" placeholder="Filter by name or place" aria-label="Filter the list by name or place">
  <ul class="plist" id="plist">${rows.map((a) => `<li data-key="${esc(fold(a.p.name + ' ' + a.stays.map((s) => placeName(s.p)).join(' ')))}"><button data-go="${esc(a.id)}">${dot(a)}<span>${esc(a.p.name)}<small>${esc(a.stays.map((s) => shortPlace(world.siteId(s.p))).filter((v, i, arr) => v !== arr[i - 1]).join(' → '))}${a.hollow ? ' (with a relative)' : ''}</small></span><small>${esc(shortLife(a.p))}</small></button></li>`).join('')}</ul>
  <h3 id="unplaced">Not on the map</h3><p class="lede">${none.length} people have no place recorded and no close relative with one. They are not drawn anywhere.</p>
  <ul class="plist">${none.map((p) => `<li><button data-none="${esc(p.id)}" disabled><i style="background:#5B6B83"></i><span>${esc(p.name)}</span><small>${esc(shortLife(p))}</small></button></li>`).join('')}</ul>
  <p class="fine">${atlas.meta.counts.living} living relatives are in the tree. Nothing about them is in this page: no light, no place, no name.</p>`;
}
function personHtml(a: Actor): string {
  const p = a.p, line = lineOf(a.id);
  const lines = lifeLines({ P, F }, p);
  const lender = a.a.borrowed ? P.get(a.a.borrowed.from) : null;
  const given = (p.given ?? p.name ?? '').split(' ')[0];
  const vagueDeath = a.a.stops.find((x) => (x.kind === 'death' || x.kind === 'burial') && x.coarse);
  const how = a.hollow ? `<span class="badge"><i style="border:1.5px solid ${CERT.borrowed}"></i>No place of their own</span>` : a.vague ? `<span class="badge"><i style="background:${CERT.vague}"></i>Place known only roughly</span>` : `<span class="badge"><i style="background:${CERT.record}"></i>Placed by a record</span>`;
  const stops = a.a.stops.map((s) => `<li class="${s.coarse ? 'coarse' : ''}"><b>${s.est ? 'c. ' : ''}${s.y}</b><span><button data-place="${esc(world.siteId(s.p))}">${esc(placeName(s.p))}</button><small>${esc(s.why)}${s.coarse ? ' · no closer than this, so not drawn' : ''}${s.doubt ? ` · in doubt: ${esc(s.doubt)}` : ''}</small></span></li>`).join('');
  const kmText = (k: number) => (k >= 1000 ? (Math.round(k / 100) * 100).toLocaleString('en') : k >= 100 ? String(Math.round(k / 10) * 10) : String(Math.round(k)));
  const moves = a.legs.filter((l) => l.km > 3).map((l) => `<div class="move${l.doubt ? ' doubt' : l.sail ? ' sail' : ''}"><b>${esc(shortPlace(world.siteId(l.a)))} to ${esc(shortPlace(world.siteId(l.b)))}, ${kmText(l.km)} km.</b> ${esc(windowText(l, (id) => shortPlace(world.siteId(id))))}${l.kind !== 'direct' && !l.assumed ? ' ' + esc(ROUTE_LABEL[l.kind]) : ''}${l.doubt ? ` <b style="color:#FFB4A8">The tree doubts this: ${esc(l.doubt)}. If the two records are two people, this move never happened.</b>` : ''}</div>`).join('');
  return `<button class="back" data-act="back">← Back</button>
  <div class="rec"><div class="rec-head">${p.photo ? `<img src="${esc(p.photo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar',textContent:'${esc((p.given ?? p.name ?? '?')[0])}'}))">` : `<div class="avatar">${esc((p.given ?? p.name ?? '?')[0])}</div>`}<div><h2>${esc(p.name)}</h2><div class="life">${esc(lifeText(p))}</div></div></div>
  <div class="badges"><span class="badge"><i style="background:${LINE_COLOUR[line]}"></i>${line} line</span>${how}</div>
  ${lines.length ? `<p class="lifelines">${esc(lines.join(' '))}</p>` : ''}
  ${a.hollow ? `<p>No record gives a place for ${esc(p.given ?? p.name)}. The hollow light is drawn in ${esc(placeName(a.stays[0].p))}, where ${lender ? `<button class="inline" data-go="${esc(lender.id)}">${esc(lender.name)}</button>` : 'a close relative'} was. It does not move, because nothing says where ${esc(p.given ?? p.name)} went.</p>` : ''}
  <h3>${a.hollow ? 'Why the light is here' : 'Where the records put ' + esc((p.given ?? p.name ?? '').split(' ')[0])}</h3><ol class="stops">${stops}</ol>
  ${moves ? `<h3>Moves</h3>${moves}` : ''}
  ${a.a.seen ? `<p class="fine">No record says where ${esc(given)} was before ${a.a.seen}, and no parent has a place to borrow. The light is not drawn until then.</p>` : ''}
  ${p.d?.est ? `<p class="fine">No death is recorded. The light goes out seventy years after birth, and no ember is left.</p>` : !a.ember ? (vagueDeath ? `<p class="fine">${esc(given)} died in ${esc(placeName(vagueDeath.p))}. No closer place is recorded, so no ember is left on the map.</p>` : `<p class="fine">Where ${esc(given)} died is not recorded, so no ember is left on the map.</p>`) : ''}
  <div class="actions">${a.legs.some((l) => l.km > 3) ? `<button class="btn solid" data-act="follow">Follow the journey</button>` : ''}<a class="btn quiet" id="open-river" href="./index.html#p=${encodeURIComponent(a.id)}&y=${Math.round(state.year)}">Open in the River</a></div></div>`;
}
function placeHtml(site: string): string {
  const pl = world.places.get(site)!, s = siteStats(site);
  const parishes = [...world.places.values()].filter((q) => q.town === site).map((q) => q.name.split(',')[0]);
  const list = (title: string, as: Actor[]) => (as.length ? `<h3>${title} (${as.length})</h3><div class="who">${as.sort((x, y) => x.b - y.b).map((a) => chip(a.id)).join('')}</div>` : '');
  return `<button class="back" data-act="back">← Back</button><div class="rec"><div class="kicker">${esc(pl.country)}</div><h2>${esc(pl.name)}</h2>
  <div class="life">${isFinite(s.y0) ? (s.y0 === s.y1 ? `Recorded in ${s.y0}` : `Recorded from ${s.y0} to ${s.y1}`) : 'No record of its own'}</div>
  <p>${PREC[pl.prec]}${parishes.length ? ` Includes ${esc(parishes.join(', '))}.` : ''}</p>
  ${list('Born or baptised here', s.born)}${list('Died or buried here', s.died)}${list('Recorded here', s.here)}${list('Drawn here with a relative', s.lent)}
  <div class="actions">${isFinite(s.y0) ? `<button class="btn quiet" data-act="goyear" data-y="${s.y0}">Go to ${s.y0}</button>` : ''}</div></div>`;
}
function helpHtml(): string {
  const c = atlas.meta.counts;
  return `<button class="back" data-act="back">← Back</button><div class="kicker">A short guide</div><h2>How to read the atlas</h2><div class="rec guide">
  <p><b>Each light is a person.</b> It comes on at birth where a birth or baptism is recorded, and goes out when they die. Where a death place is recorded, a small ember stays. Someone whose first record comes later in life is drawn hollow with a parent until then, or, with no parent to borrow from, not drawn until that record.</p>
  <p><b>A solid light has a record behind it.</b> A birth, baptism, marriage, census, burial, or the recorded birth of a child, which places both parents. ${c.recorded} people are placed this way.</p>
  <p><b>A hollow light is borrowed.</b> ${c.borrowed} people have no place in any record. They are drawn where a parent, partner, brother, sister or child was, and they never move.</p>
  <p><b>A haze is a place known only roughly.</b> “Derbyshire” or “New Zealand” and nothing closer.</p>
  <p><b>Lines are moves.</b> Solid: both ends are recorded within three years of each other, and the light travels. Dashed: the records leave a longer gap, so the light waits where it was last recorded, dimming, and appears at the new place in the year a record finds it there. Dotted red: the tree itself doubts the two records are the same person.</p>
  <p><b>Sea routes are custom, not record.</b> A voyage between Europe and New Zealand is drawn the way ships of that time usually went: round the Cape before 1870, through Suez after. The tree names no ship.</p>
  <p><b>Two ways to draw the Earth.</b> The globe stays with the family in Europe, crosses to New Zealand once, and stays there; drag it to look anywhere. Two shores is the flat map: Britain and New Zealand drawn large, with the ocean between them folded away. On a wide screen you can have both.</p>
  <p><b>Every country is named.</b> The row of countries above the map counts the lights lit in each this year. On the globe, a country out of view is named at the rim, in the direction it lies. Tap either to go there and see who it was.</p>
  <p><b>Who is missing.</b> ${c.living} living relatives are not shown at all. ${c.unplaced} people have no place and no relative to borrow from. Most of the Polish lines are living or undated, which is why Poland is nearly dark.</p>
  <h3>Keys</h3><dl class="kv"><dt>Space</dt><dd>Play or pause</dd><dt>← →</dt><dd>One year. With Shift, ten. Home and End for the first and last year</dd><dt>↑ ↓</dt><dd>With the map focused, step through people in birth order</dd><dt>G S B</dt><dd>Globe, two shores, both</dd><dt>1 2 3</dt><dd>Surname, birthplace, certainty</dd><dt>/</dt><dd>Find a person or place</dd><dt>+ − 0</dt><dd>Zoom in, out, follow the family</dd><dt>Esc</dt><dd>Close, clear</dd></dl></div>`;
}

function renderLegend() {
  const el = $('#legend');
  const sw = state.lens === 'surname' ? LINES.map((l) => `<span><i style="background:${LINE_COLOUR[l]}"></i>${l}</span>`).join('')
    : state.lens === 'place' ? [...new Set(world.actors.map((a) => world.places.get(a.stays[0].p)!.region))].map((r) => `<span><i style="background:${REGION_COLOUR[r] ?? '#A9B7CB'}"></i>${esc(r)}</span>`).join('')
    : `<span><i style="background:${CERT.record}"></i>Placed by a record</span><span><i style="background:${CERT.borrowed}"></i>With a relative</span><span><i style="background:${CERT.vague}"></i>County or country only</span><span><i style="background:${CERT.disputed}"></i>Identity disputed</span>`;
  el.innerHTML = `<button class="key-toggle" aria-expanded="${!el.classList.contains('collapsed')}">Key</button>${sw}<span><i class="ring"></i>Hollow: no place of their own</span><span><i class="haze"></i>Known only roughly</span><span><i class="em"></i>Died here</span><span><i class="ln"></i>Move, year known</span><span><i class="ln d"></i>Move, some time in a window</span><span><i class="ln q"></i>Move in doubt</span><button data-act="help">How to read this</button>`;
}
function setLens(lens: Lens) {
  state.lens = lens;
  document.querySelectorAll<HTMLElement>('#lens button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === lens)));
  renderLegend(); if (!state.record) renderTab(); writeHash(); kick();
}
let legendSet = false;
function setView(view: View, quiet = false) {
  if (view === 'both' && (isSmall() || isSideways())) view = 'globe';
  state.view = view;
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
  type Hit = { kind: 'p' | 's'; id: string; label: string; meta: string };
  const index: (Hit & { key: string })[] = [
    ...[...world.atSite.keys()].map((s) => ({ kind: 's' as const, id: s, label: placeName(s), meta: 'place', key: fold(placeName(s) + ' ' + [...world.places.values()].filter((q) => q.town === s).map((q) => q.name).join(' ')) })),
    ...river.people.filter((p) => !p.living).map((p) => ({ kind: 'p' as const, id: p.id, label: p.name!, meta: shortLife(p), key: fold([p.name, ...(p.married ?? []), ...(p.variants ?? []), p.b && !p.b.est ? p.b.y : '', p.d && !p.d.est ? p.d.y : ''].join(' ')) })),
  ];
  let hits: Hit[] = [], cur = 0;
  const drawList = () => {
    list.hidden = !input.value.trim(); input.setAttribute('aria-expanded', String(!list.hidden));
    list.innerHTML = hits.length ? hits.map((h, i) => `<li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === cur}"><span>${esc(h.label)}</span><small>${esc(h.meta)}</small></li>`).join('') : `<li class="none">No person or place of that name. Living people cannot be searched.</li>`;
  };
  input.addEventListener('input', () => { const q = fold(input.value.trim()).split(/\s+/).filter(Boolean); hits = q.length ? index.filter((x) => q.every((w) => x.key.includes(w))).slice(0, 30) : []; cur = 0; drawList(); });
  const choose = (h: Hit) => { input.value = ''; list.hidden = true; input.blur(); if (h.kind === 's') openPlace(h.id); else select(h.id); };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { cur = Math.min(hits.length - 1, cur + 1); drawList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); drawList(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[cur]) choose(hits[cur]);
    else if (e.key === 'Escape') { input.value = ''; list.hidden = true; input.blur(); }
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
  $('#play').addEventListener('click', () => (state.playing ? stop() : play()));
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
    const ctry = t.closest<HTMLElement>('[data-country]');
    if (ctry) { openCountry(ctry.dataset.country!); return; }
    const go = t.closest<HTMLElement>('[data-go]');
    if (go) { select(go.dataset.go!); return; }
    const pl = t.closest<HTMLElement>('[data-place]');
    if (pl) { openPlace(pl.dataset.place!); return; }
    const f = t.closest<HTMLElement>('[data-finding]');
    if (f) { openFinding(f.dataset.finding!); return; }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'back') goBack();
    else if (act === 'help') { stop(); state.selected = null; state.place = null; state.focus = null; state.track = null; trail.length = 0; openRecord('help', helpHtml()); kick(); }
    else if (act === 'unplaced') { state.tab = 'people'; renderTab(); openSheet(true); document.querySelector('#unplaced')?.scrollIntoView({ block: 'start' }); }
    else if (act === 'goyear') { stop(); setYear(Number(t.closest<HTMLElement>('[data-y]')!.dataset.y)); openSheet(false); }
    else if (act === 'follow' && state.selected) {
      const a = world.byId.get(state.selected)!;
      (document.activeElement as HTMLElement | null)?.blur();
      stop(); setYear(Math.max(a.on, a.stays[0].to - 1)); play(a.id); openSheet(false);
    }
  });
  $('#panel-body').addEventListener('input', (e) => {
    const inp = e.target as HTMLInputElement; if (inp.id !== 'pfilter') return;
    const q = fold(inp.value.trim()).split(/\s+/).filter(Boolean);
    document.querySelectorAll<HTMLElement>('#plist li').forEach((li) => { li.hidden = !q.every((w) => li.dataset.key!.includes(w)); });
  });
  document.addEventListener('pointerdown', () => document.body.classList.remove('kbd'), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') document.body.classList.add('kbd');
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === ' ' && !t.matches('button, a')) { e.preventDefault(); if (state.playing) stop(); else play(); }
    else if (e.key === 'ArrowLeft') { stop(); setYear(state.year - (e.shiftKey ? 10 : 1)); }
    else if (e.key === 'ArrowRight') { stop(); setYear(state.year + (e.shiftKey ? 10 : 1)); }
    else if (e.key === '1') setLens('surname'); else if (e.key === '2') setLens('place'); else if (e.key === '3') setLens('certainty');
    else if (k === 'g') setView('globe'); else if (k === 's') setView('shores'); else if (k === 'b') setView('both');
    else if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    else if (e.key === '+' || e.key === '=') $('#zin').click(); else if (e.key === '-') $('#zout').click(); else if (e.key === '0') $('#zfit').click();
    else if (e.key === 'Escape') { if (state.record === 'help') { closeRecord(); renderTab(); } else clearAll(); }
  });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => { if (state.view === 'both' && (isSmall() || isSideways())) setView('globe'); for (const s of stages) s.resize(); syncInset(); draw(true); }, 80); });
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
  if (sel) select(sel, moveYear); else if (pl) openPlace(pl, moveYear); else if (co) openCountry(co, moveYear); else if (f) openFinding(f, moveYear);
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
