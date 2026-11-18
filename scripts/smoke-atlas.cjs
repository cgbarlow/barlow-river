// End-to-end smoke test for the Atlas in a real browser.
//   node scripts/smoke-atlas.cjs                 against a dev server (http://localhost:5173/)
//   node scripts/smoke-atlas.cjs --preview       serves dist/ itself
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const selfServe = process.argv.includes('--preview');
const base = selfServe ? 'http://localhost:4173/' : process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:5173/';
const url = base + 'atlas.html';
let server;
async function serve() {
  if (!selfServe) return;
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 200)); }
  throw new Error('preview server did not start');
}
const results = [];
const t0 = Date.now();
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}${process.env.SMOKE_TIMES ? '  [' + ((Date.now() - t0) / 1000).toFixed(1) + 's]' : ''}`); };
process.on('exit', () => server?.kill());

(async () => {
  await serve();
  const browser = await chromium.launch();
  const errors = [];
  const open = async (hash = '', viewport = { width: 1440, height: 900 }, extra = {}) => {
    const ctx = await browser.newContext({ viewport, ...extra });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(url + hash);
    await page.waitForSelector('#app:not(.loading)');
    return page;
  };
  const year = (p) => p.evaluate(() => Number(document.querySelector('#year').textContent));
  const A = (p, fn, arg) => p.evaluate(fn, arg);
  const idOf = (p, name) => p.evaluate((n) => window.__atlas.world.actors.find((a) => a.p.name === n)?.id, name);
  const clickLight = async (p, id, n = 0) => {
    await A(p, () => window.__atlas.settle());
    const at = await p.evaluate(([id, n]) => { const s = window.__atlas.stages[n]; const q = s.screenOf(id); const r = s.canvas.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1]] : null; }, [id, n]);
    if (!at) return false;
    await p.mouse.click(at[0], at[1]);
    return true;
  };
  const inked = (p, n = 0) => p.evaluate((n) => { const c = window.__atlas.stages[n].canvas; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) k++; return k; }, n);

  // 1. it plays by itself
  let page = await open();
  const y0 = await year(page);
  await page.waitForTimeout(2600);
  const y1 = await year(page);
  check('intro starts in the past and plays forward', y0 < 1700 && y1 > y0, `${y0} -> ${y1}`);
  await page.keyboard.press(' ');
  const y2 = await year(page); await page.waitForTimeout(500);
  check('space pauses', (await year(page)) === y2);
  const box0 = await page.locator('#view-a').boundingBox(), stageBox = await page.locator('#stage').boundingBox();
  check('the map fills the stage', box0.height > 500 && Math.abs(box0.height - stageBox.height) < 2 && Math.abs(box0.width - stageBox.width) < 2, `${box0.width}x${box0.height}`);
  check('the globe is drawn', (await inked(page)) > 500);

  // 2. the year
  const box = await page.locator('#track').boundingBox();
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
  const y3 = await year(page);
  check('clicking the track sets the year', y3 > 1780 && y3 < 1900, String(y3));
  await page.keyboard.press('ArrowRight');
  check('arrow key steps a year', (await year(page)) === y3 + 1);
  await page.keyboard.press('Shift+ArrowLeft');
  check('shift and arrow steps ten', (await year(page)) === y3 - 9);
  check('the count of lights is shown', /\d+ lit/.test(await page.locator('#alive').textContent()));
  const sc = await A(page, () => { const s = window.__atlas.scene(); return { lights: s.lights.length, alive: s.alive, living: s.lights.filter((l) => l.actor.p.living).length }; });
  check('people are lit, and none of them is living', sc.lights > 20 && sc.living === 0, JSON.stringify(sc));

  // 3. births, deaths, embers
  const life = await A(page, () => {
    const w = window.__atlas.world, a = w.actors.find((x) => x.ember && !x.hollow && x.legs.length === 0);
    const at = (y) => { const s = w.scene(y, null, null); return { lit: s.lights.some((l) => l.actor === a), ember: s.embers.some((e) => e.actor === a), ripple: s.ripples.filter((r) => r.actor === a).map((r) => r.kind) }; };
    return { before: at(a.b - 1), born: at(a.b + 0.5), mid: at((a.b + a.d) / 2), died: at(a.d + 1), after: at(a.d + 30) };
  });
  check('a light comes on at birth with a ripple', !life.before.lit && life.born.lit && life.born.ripple.includes('birth'));
  check('it goes out at death and leaves an ember where the death is recorded', life.mid.lit && !life.died.lit && life.died.ripple.includes('death') && life.after.ember);
  const noEmber = await A(page, () => { const w = window.__atlas.world, a = w.actors.find((x) => !x.ember); const s = w.scene(a.d + 5, null, null); return !s.embers.some((e) => e.actor === a); });
  check('no ember where the death place is not recorded', noEmber);

  // 4. tap a light
  const edwin = await idOf(page, 'Edwin Watkins');
  await A(page, () => window.__atlas.setYear(1860));
  check('a light can be found on the canvas', await clickLight(page, edwin));
  await page.waitForSelector('#record:not([hidden]) h2');
  check('tapping a light opens the person', (await page.locator('#record h2').textContent()) === 'Edwin Watkins');
  check('the record lists the places in order with the evidence', (await page.locator('#record .stops li').count()) >= 6 && /census/.test(await page.locator('#record .stops').textContent()) && /birth of/.test(await page.locator('#record .stops').textContent()));
  check('a voyage is described as custom, not record', /usual .* route/.test(await page.locator('#record .move.sail').first().textContent()) && /does not record the ship/.test(await page.locator('#record').textContent()));
  check('the record links to the River for the same person', (await page.locator('#record a[href*="index.html#p="]').getAttribute('href')).includes(encodeURIComponent(edwin)));
  check('the address bar carries the person and the year', /p=/.test(page.url()) || (await page.waitForTimeout(400), /p=/.test(page.url())));

  // 5. follow the journey: the light sails
  await page.locator('#record [data-act="follow"]').click();
  let sailed = false, shipSeen = false;
  for (let i = 0; i < 80 && !sailed; i++) { await page.waitForTimeout(150); const s = await A(page, (id) => { const sc = window.__atlas.scene(); return { moving: sc.lights.some((l) => l.actor.id === id && l.moving), ship: Boolean(sc.ship) }; }, edwin); if (s.moving) { sailed = true; shipSeen = s.ship; } }
  check('follow the journey plays, and the light sails', sailed && shipSeen);
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(150); if (!(await A(page, () => window.__atlas.state.playing))) break; }
  check('the journey ends where the records end', !(await A(page, () => window.__atlas.state.playing)) && (await year(page)) >= 1874 && (await year(page)) <= 1880, String(await year(page)));
  await A(page, () => window.__atlas.settle());
  check('the globe has turned to New Zealand', (await A(page, () => window.__atlas.stages[0].cam.lon)) > 150);
  await page.keyboard.press('Escape');
  check('escape closes the record', await page.locator('#record').isHidden());

  // 6. doubt, and people with no place of their own
  const francis = await A(page, () => window.__atlas.world.actors.find((a) => a.disputed).id);
  await A(page, (id) => window.__atlas.select(id), francis);
  check('the move in doubt is marked and explained', /tree doubts this/.test(await page.locator('#record .move.doubt').textContent()));
  check('selecting someone outside their lifetime moves the year into it', (await year(page)) >= 1639 && (await year(page)) < 1710, String(await year(page)));
  const hollow = await A(page, () => window.__atlas.world.actors.find((a) => a.hollow).id);
  await A(page, (id) => window.__atlas.select(id), hollow);
  const hText = await page.locator('#record').textContent();
  check('a hollow light says it is borrowed and from whom', /No record gives a place/.test(hText) && /No place of their own/.test(hText) && (await page.locator('#record [data-act="follow"]').count()) === 0);
  await page.locator('#record .back').click();

  // 7. two ways to draw the Earth, or both
  await A(page, () => window.__atlas.setYear(1880));
  await page.locator('.view [data-view="shores"]').click();
  await A(page, () => window.__atlas.settle());
  check('two shores draws', (await inked(page)) > 500 && (await page.locator('.view [data-view="shores"]').getAttribute('aria-checked')) === 'true');
  const tf = await idOf(page, 'Thomas Finch');
  const both = await A(page, () => { const s = window.__atlas.stages[0], w = window.__atlas.world; const eng = w.actors.find((a) => !a.hollow && s.screenOf(a.id) && w.lightOf(a, 1880)?.[0] < 10), nz = w.actors.find((a) => s.screenOf(a.id) && w.lightOf(a, 1880)?.[0] > 150); return eng && nz ? [s.screenOf(eng.id)[0], s.screenOf(nz.id)[0]] : null; });
  check('Britain is on one shore and New Zealand on the other', both && both[0] < both[1] && both[1] - both[0] > 300, JSON.stringify(both));
  check('a light can be tapped on the shores', (await clickLight(page, tf)) && (await page.waitForSelector('#record:not([hidden]) h2'), (await page.locator('#record h2').textContent()) === 'Thomas Finch'));
  await page.locator('#record .back').click();
  await page.keyboard.press('b');
  await A(page, () => window.__atlas.settle());
  const bb = [await page.locator('#view-a').boundingBox(), await page.locator('#view-b').boundingBox()];
  check('both shows the globe and the shores side by side', bb[1] && Math.abs(bb[0].width - bb[1].width) < 3 && bb[1].x >= bb[0].x + bb[0].width - 2 && (await inked(page, 1)) > 500 && (await inked(page, 0)) > 500);
  await page.keyboard.press('g');
  check('the key G returns to the globe', await page.locator('#view-b').isHidden());
  await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
  const k0 = await A(page, () => window.__atlas.stages[0].cam.k);
  await page.mouse.wheel(0, -400);
  check('the wheel zooms', (await A(page, () => window.__atlas.stages[0].cam.k)) > k0);
  const lon0 = await A(page, () => window.__atlas.stages[0].cam.lon);
  await page.mouse.move(box0.x + 300, box0.y + 200); await page.mouse.down(); await page.mouse.move(box0.x + 500, box0.y + 240, { steps: 5 }); await page.mouse.up();
  check('dragging turns the globe and takes the camera', (await A(page, () => window.__atlas.stages[0].cam.lon)) !== lon0 && !(await A(page, () => window.__atlas.stages[0].auto)));
  await page.locator('#zfit').click();
  check('the follow button gives the camera back', await A(page, () => window.__atlas.stages[0].auto));

  // 7b. the camera crosses the world once, and does not come back
  const cams = await A(page, () => { const out = []; for (let y = 1600; y <= 2020; y += 5) { window.__atlas.setYear(y); window.__atlas.settle(); out.push([y, Math.round(window.__atlas.stages[0].cam.lon), +window.__atlas.stages[0].cam.k.toFixed(1)]); } return { out, plan: window.__atlas.plan }; });
  const sides = cams.out.map((c) => (c[1] > 100 ? 'nz' : c[1] > -30 && c[1] < 40 ? 'eu' : 'sea'));
  const firstNz = sides.indexOf('nz');
  check('the globe starts with the family in Europe', sides[0] === 'eu' && firstNz > 10);
  check('it crosses to New Zealand once and never swings back', firstNz > 0 && sides.slice(firstNz).every((x) => x === 'nz') && sides.slice(0, firstNz).every((x) => x !== 'nz'), `turn ${cams.plan.turn}, ride ${JSON.stringify(cams.plan.ride)}`);
  let jump = 0; for (let i = 1; i < cams.out.length; i++) if (sides[i] === sides[i - 1]) jump = Math.max(jump, Math.abs(cams.out[i][1] - cams.out[i - 1][1]));
  check('between times it holds steady', jump <= 4, `largest move in five years: ${jump} degrees`);
  await A(page, () => { window.__atlas.setYear(1868); window.__atlas.stages[0].resume(); window.__atlas.settle(); window.__atlas.play(); });
  const seen = [];
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(120); const c = await A(page, () => [window.__atlas.state.year, window.__atlas.stages[0].cam.lon, Boolean(window.__atlas.scene().ship)]); seen.push(c); if (c[0] > 1885) break; }
  await A(page, () => window.__atlas.stop());
  // through Suez a ship first runs south-west down the Channel; after that it only goes east
  let back = 0; for (let i = 1; i < seen.length; i++) { if (seen[i - 1][1] < 40) continue; let d = seen[i][1] - seen[i - 1][1]; if (d > 180) d -= 360; if (d < -180) d += 360; if (d < -0.5) back++; }
  check('played through the voyage, the globe turns one way only and rides with the ship', back === 0 && seen.some((c) => c[2]) && seen[seen.length - 1][1] > 100, `${seen.length} samples, ${back} backward`);
  await A(page, () => window.__atlas.setYear(1880));

  // 7c. every country the records name can be seen and reached
  const chips = await page.locator('#countries [data-country]').allTextContents();
  check('every country in the records has a chip with its count for the year', ['England', 'New Zealand', 'Poland', 'Ireland', 'Wales', 'United States'].every((n) => chips.some((c) => c.startsWith(n))) && /England \d+/.test(chips.join('|')), chips.join(' | '));
  const sum = await A(page, () => { const c = window.__atlas.counts(); return [Object.values(c).reduce((a, b) => a + b, 0), window.__atlas.scene().alive]; });
  check('the counts add up to the lights that are lit', sum[0] === sum[1], sum.join(' vs '));
  await A(page, () => { window.__atlas.setYear(1850); window.__atlas.stages[0].resume(); window.__atlas.settle(); });
  const ptr = await A(page, () => { const s = window.__atlas.stages[0], q = s.pointerScreen('New Zealand'), r = s.canvas.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1], s.pointerScreen('England') ? 1 : 0] : null; });
  check('from Europe, the globe points to New Zealand at its rim and not to England', ptr && ptr[2] === 0, JSON.stringify(ptr));
  await page.mouse.click(ptr[0], ptr[1]);
  await page.waitForSelector('#record:not([hidden]) h2');
  await A(page, () => window.__atlas.settle());
  check('tapping the pointer goes there and says who', (await page.locator('#record h2').textContent()) === 'New Zealand' && (await A(page, () => window.__atlas.stages[0].cam.lon)) > 150 && /Came here from another country \(\d+\)/.test(await page.locator('#record').textContent()));
  await page.locator('#countries [data-country="Poland"]').click();
  const pol = await page.locator('#record').textContent();
  check('a country chip opens the country and explains a dark one', /Poland/.test(await page.locator('#record h2').textContent()) && /nearly dark/.test(pol) && (await page.locator('#countries [data-country="Poland"]').getAttribute('aria-pressed')) === 'true' && (await year(page)) >= 1900);
  await page.locator('#record .back').click();
  check('going back clears the country', (await page.locator('#countries [aria-pressed="true"]').count()) === 0 && (await A(page, () => window.__atlas.state.focus)) === null);
  await page.keyboard.press('s');
  await A(page, () => { window.__atlas.setYear(1790); window.__atlas.settle(); });
  const ny = await A(page, () => { const w = window.__atlas.world, s = window.__atlas.stages[0]; const a = w.actors.find((x) => w.countryOf(x, 1790) === 'United States'); return a ? s.screenOf(a.id) : null; });
  check('on two shores, someone in the United States is drawn in an inset of its own', Array.isArray(ny), JSON.stringify(ny));
  await page.keyboard.press('g');
  await A(page, () => window.__atlas.setYear(1880));

  // 8. lenses
  await page.keyboard.press('2');
  check('the birthplace lens recolours and rewrites the key', /Norfolk/.test(await page.locator('#legend').textContent()) && (await page.locator('#lens [data-lens="place"]').getAttribute('aria-checked')) === 'true');
  await page.keyboard.press('3');
  check('the certainty lens names its four kinds', /Placed by a record/.test(await page.locator('#legend').textContent()) && /Identity disputed/.test(await page.locator('#legend').textContent()));
  await page.keyboard.press('1');

  // 9. the panel: findings, places, people
  const cards = await page.locator('#panel-body [data-finding]').count();
  check('findings are listed', cards >= 7, String(cards));
  await page.locator('#panel-body [data-finding="a-first-crossing"]').click();
  check('a finding moves the year and lights its people', (await year(page)) === 1855 && (await A(page, () => window.__atlas.state.focus?.size)) >= 1 && (await page.locator('#panel-body .card.on + .who button').count()) >= 1);
  await page.locator('.tabs [data-tab="places"]').click();
  check('every place is listed', (await page.locator('#panel-body [data-place]').count()) === (await A(page, () => window.__atlas.world.atSite.size)));
  await page.locator('#panel-body [data-place="norwich"]').click();
  const placeText = await page.locator('#record').textContent();
  check('a place lists who was born and died there, and its parishes', /Born or baptised here \(\d+\)/.test(placeText) && /St Augustine/.test(placeText) && (await page.locator('#record [data-go]').count()) > 10);
  await page.locator('#record .back').click();
  await page.locator('.tabs [data-tab="people"]').click();
  const nPeople = await page.locator('#plist [data-go]').count();
  check('every person on the map is in the list', nPeople === (await A(page, () => window.__atlas.world.actors.length)), String(nPeople));
  check('the unplaced are named, and the living are counted but not named', (await page.locator('#panel-body [data-none]').count()) === (await A(page, () => window.__atlas.atlas.unplaced.length)) && /109 living relatives/.test(await page.locator('#panel-body').textContent()));
  await page.locator('#pfilter').fill('howick');
  const filtered = await page.locator('#plist li:not([hidden])').count();
  check('the list filters by place', filtered > 2 && filtered < 40, String(filtered));
  await page.locator('#plist li:not([hidden]) [data-go]').first().click();
  check('a person opens from the list', await page.locator('#record h2').isVisible());
  await page.locator('#record .back').click();

  // 10. search
  await page.keyboard.press('/');
  await page.keyboard.type('chmiel');
  check('search finds a Polish name without diacritics', (await page.locator('#results li[data-i]').count()) > 0);
  await page.locator('#search').fill('zamosc');
  await page.keyboard.press('Enter');
  check('search finds a place and opens it', /Zamość/.test(await page.locator('#record h2').textContent()));
  await page.locator('#record .back').click();
  const none = await A(page, () => window.__atlas.atlas.unplaced[0]);
  await A(page, (id) => window.__atlas.select(id), none);
  check('someone with no place is explained, not placed', (await page.locator('.toast').count()) === 1 && (await A(page, () => window.__atlas.state.selected)) === null);

  // 11. keyboard on the map
  await A(page, () => window.__atlas.setYear(1700));
  await page.locator('#views').focus();
  await page.keyboard.press('ArrowDown');
  const s1 = await A(page, () => window.__atlas.state.selected);
  await page.keyboard.press('ArrowDown');
  const s2 = await A(page, () => window.__atlas.state.selected);
  check('arrow keys on the map step through people', s1 && s2 && s1 !== s2);
  await page.keyboard.press('Escape');
  await page.locator('#help').click();
  check('the guide opens', /How to read the atlas/.test(await page.locator('#record h2').textContent()) && /Sea routes are custom/.test(await page.locator('#record').textContent()));
  await page.keyboard.press('Escape');

  // 12. captions arrive during play
  await A(page, () => { window.__atlas.setYear(1852); window.__atlas.play(); });
  let cap = '';
  for (let i = 0; i < 40 && !/1855/.test(cap); i++) { await page.waitForTimeout(150); if (await page.locator('#caption.on').count()) cap = await page.locator('#caption').textContent(); }
  check('a caption says what the records say, and what they do not', /1855/.test(cap) && /not recorded/.test(cap), cap.slice(0, 70));
  await A(page, () => window.__atlas.stop());
  await page.close();

  // 13. deep links
  page = await open(`#y=1890&p=${encodeURIComponent(edwin)}&v=shores&lens=certainty`);
  check('a link restores year, person, view and lens', (await year(page)) === 1890 && (await page.locator('#record h2').textContent()) === 'Edwin Watkins' && (await A(page, () => window.__atlas.stages[0].kind)) === 'shores' && (await A(page, () => window.__atlas.state.lens)) === 'certainty');
  check('a link does not autoplay', !(await A(page, () => window.__atlas.state.playing)));
  await page.goto(url + '#pl=pirongia&y=1870'); await page.reload(); await page.waitForSelector('#app:not(.loading)');
  check('a link to a place opens it', /Pirongia/.test(await page.locator('#record h2').textContent()));
  await page.goto(url + '#p=x0000dead&y=1900&v=nonsense'); await page.reload(); await page.waitForSelector('#app:not(.loading)');
  check('a bad link falls back quietly', (await year(page)) === 1900 && (await page.locator('#record').isHidden()));
  await page.close();

  // 14. between the two modes
  page = await open('#y=1862');
  await A(page, (id) => window.__atlas.select(id), edwin);
  await page.waitForTimeout(400);
  await page.locator('#record a[href*="index.html"]').click();
  await page.waitForSelector('#river');
  await page.waitForSelector('#record:not([hidden]) h2');
  check('“Open in the River” opens the same person there', (await page.locator('#record h2').textContent()) === 'Edwin Watkins');
  check('the River links back to the Atlas for that person', (await page.locator('#record a[href*="atlas.html#p="]').count()) === 1 && (await page.locator('a.mode-link[href*="atlas.html"]').count()) === 1);
  await page.locator('#record a[href*="atlas.html#p="]').click();
  await page.waitForSelector('#views');
  await page.waitForSelector('#record:not([hidden]) h2');
  check('and “See on the map” comes back', (await page.locator('#record h2').textContent()) === 'Edwin Watkins');
  await page.close();

  // 15. a phone
  page = await open('#y=1880', { width: 390, height: 800 }, { hasTouch: true, isMobile: true });
  check('on a phone the map draws and the page does not scroll sideways', (await inked(page)) > 200 && (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)));
  check('on a phone “both” is not offered', await page.locator('.view [data-view="both"]').isHidden());
  const pid = await A(page, () => { const s = window.__atlas.stages[0]; window.__atlas.settle(); return window.__atlas.scene().lights.find((l) => s.screenOf(l.actor.id))?.actor.id; });
  const pat = await page.evaluate((id) => { const s = window.__atlas.stages[0]; const q = s.screenOf(id); const r = s.canvas.getBoundingClientRect(); return [r.left + q[0], r.top + q[1]]; }, pid);
  await page.touchscreen.tap(pat[0], pat[1]);
  await page.waitForTimeout(500);
  check('a tap on a light opens the sheet with a person', (await page.locator('#panel.open').count()) === 1 && (await page.locator('#record h2').isVisible()));
  await page.locator('#record .back').click();
  await page.locator('.view [data-view="shores"]').tap();
  await A(page, () => window.__atlas.settle());
  const stacked = await A(page, () => { const s = window.__atlas.stages[0], w = window.__atlas.world; const e = w.actors.find((a) => s.screenOf(a.id) && w.lightOf(a, 1880)?.[0] < 10), n = w.actors.find((a) => s.screenOf(a.id) && w.lightOf(a, 1880)?.[0] > 150); return e && n ? s.screenOf(n.id)[1] - s.screenOf(e.id)[1] : 0; });
  check('on a phone the two shores stack', stacked > 80, String(stacked));
  await page.close();

  // 16. a phone on its side, and reduced motion
  page = await open('#y=1880', { width: 800, height: 380 }, { hasTouch: true, isMobile: true });
  check('sideways, the map still draws beside the panel', (await inked(page)) > 150 && (await page.locator('#view-a').boundingBox()).height > 120);
  await page.close();
  page = await open('', { width: 1280, height: 800 }, { reducedMotion: 'reduce' });
  await page.waitForTimeout(1500);
  check('with reduced motion nothing plays by itself', !(await A(page, () => window.__atlas.state.playing)) && (await inked(page)) > 500);
  await page.close();

  check('no errors in the console', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed} of ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
