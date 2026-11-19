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
  check('a voyage is described as custom, not record', /usual route/.test(await page.locator('#record .move.sail').first().textContent()) && /not the course of one ship/.test(await page.locator('#record').textContent()));
  check('the record links to the River for the same person', (await page.locator('#open-river').getAttribute('href')).includes(encodeURIComponent(edwin)));
  check('the address bar carries the person and the year', /p=/.test(page.url()) || (await page.waitForTimeout(400), /p=/.test(page.url())));

  // 5. follow the journey: the light sails
  await page.locator('#record [data-act="follow"]').click();
  let sailed = false, shipSeen = false;
  for (let i = 0; i < 80 && !sailed; i++) { await page.waitForTimeout(150); const s = await A(page, (id) => { const sc = window.__atlas.scene(); return { moving: sc.lights.some((l) => l.actor.id === id && l.moving), ship: Boolean(sc.ship) }; }, edwin); if (s.moving) { sailed = true; shipSeen = s.ship; } }
  check('follow the journey plays, and the light sails', sailed && shipSeen);
  for (let i = 0; i < 260; i++) { await page.waitForTimeout(150); if (!(await A(page, () => window.__atlas.state.playing))) break; }
  // his last record is his burial in 1912: the journey runs to there, so the death is told too
  check('the journey ends where the records end', !(await A(page, () => window.__atlas.state.playing)) && (await year(page)) >= 1912 && (await year(page)) <= 1915, String(await year(page)));
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
  check('a hollow light says it is borrowed and from whom', /records the map reads gives a place/.test(hText) && /No place of their own/.test(hText) && (await page.locator('#record [data-act="follow"]').count()) === 0);
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
  const cams = await A(page, () => { const out = []; for (let y = 1600; y <= 2020; y += 5) { window.__atlas.setYear(y); window.__atlas.settle(); out.push([y, Math.round(window.__atlas.stages[0].cam.lon), +window.__atlas.stages[0].cam.k.toFixed(1), window.__atlas.scene().lights.length]); } return { out, plan: window.__atlas.plan }; });
  const sides = cams.out.map((c) => (c[1] > 100 ? 'nz' : c[1] > -30 && c[1] < 40 ? 'eu' : 'sea'));
  const firstNz = sides.indexOf('nz');
  check('the globe starts with the family in Europe', sides[0] === 'eu' && firstNz > 10);
  check('it crosses to New Zealand once and never swings back', firstNz > 0 && sides.slice(firstNz).every((x) => x === 'nz') && sides.slice(0, firstNz).every((x) => x !== 'nz'), `turn ${cams.plan.turn}, ride ${JSON.stringify(cams.plan.ride)}`);
  let jump = 0; for (let i = 1; i < cams.out.length; i++) if (sides[i] === sides[i - 1] && cams.out[i][3] && cams.out[i - 1][3]) jump = Math.max(jump, Math.abs(cams.out[i][1] - cams.out[i - 1][1]));
  const lastCam = cams.out[cams.out.length - 1];
  check('when the last light is out it stands back on the same side, without crossing again', lastCam[3] === 0 ? lastCam[1] > 100 && lastCam[2] < 2 : true, JSON.stringify(lastCam));
  check('between times it holds steady', jump <= 4, `largest move in five years: ${jump} degrees`);
  await A(page, () => { window.__atlas.setYear(1868); window.__atlas.stages[0].resume(); window.__atlas.settle(); window.__atlas.play(); });
  const seen = [];
  for (let i = 0; i < 260; i++) { await page.waitForTimeout(120); const c = await A(page, () => [window.__atlas.state.year, window.__atlas.stages[0].cam.lon, Boolean(window.__atlas.scene().ship), document.querySelector('#caption.on')?.textContent ?? '']); seen.push(c); if (c[0] > 1880) break; }
  await A(page, () => window.__atlas.stop());
  // through Suez a ship first runs south-west down the Channel; after that it only goes east
  let back = 0; for (let i = 1; i < seen.length; i++) { if (seen[i - 1][1] < 40) continue; let d = seen[i][1] - seen[i - 1][1]; if (d > 180) d -= 360; if (d < -180) d += 360; if (d < -0.5) back++; }
  check('played through the voyage, the globe turns one way only and rides with the ship', back === 0 && seen.some((c) => c[2]) && seen[seen.length - 1][1] > 100, `${seen.length} samples, ${back} backward`);
  await A(page, () => window.__atlas.setYear(1880));

  // 7c. every country the records name can be seen and reached
  const chips = await page.evaluate(() => [...document.querySelectorAll('#countries [data-country]')].map((b) => b.querySelector('.full').textContent + ' ' + b.querySelector('b').textContent));
  check('every country in the records has a chip with its count for the year', ['England', 'New Zealand', 'Poland', 'Ireland', 'Wales', 'United States'].every((n) => chips.some((c) => c.startsWith(n))) && /England \d+/.test(chips.join('|')), chips.join(' | '));
  const sum = await A(page, () => { const c = window.__atlas.counts(); return [Object.values(c).reduce((a, b) => a + b, 0), window.__atlas.scene().alive]; });
  check('the counts add up to the lights that are lit', sum[0] === sum[1], sum.join(' vs '));
  await A(page, () => window.__atlas.setYear(1850));
  check('before the first record there, New Zealand counts nobody', (await page.locator('#countries [data-country="New Zealand"] b').textContent()) === '0' && (await A(page, () => window.__atlas.scene().lights.filter((l) => l.ll[0] > 100).length)) === 0);
  await A(page, () => { window.__atlas.setYear(1862); window.__atlas.stages[0].resume(); window.__atlas.settle(); });
  const ptr = await A(page, () => { const s = window.__atlas.stages[0], q = s.pointerScreen('New Zealand'), r = s.canvas.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1], s.pointerScreen('England') ? 1 : 0] : null; });
  check('from Europe, the globe points to New Zealand at its rim and not to England', ptr && ptr[2] === 0, JSON.stringify(ptr));
  await page.mouse.click(ptr[0], ptr[1]);
  await page.waitForSelector('#record:not([hidden]) h2');
  await A(page, () => window.__atlas.settle());
  check('tapping the pointer goes there and says who', (await page.locator('#record h2').textContent()) === 'New Zealand' && (await A(page, () => window.__atlas.stages[0].cam.lon)) > 150 && /Came here from another country \(\d+\)/.test(await page.locator('#record').textContent()));
  await page.locator('#countries [data-country="Poland"]').click();
  const pol = await page.locator('#record').textContent();
  check('a country chip opens the country and explains a dark one', /Poland/.test(await page.locator('#record h2').textContent()) && /nearly dark/.test(pol) && (await page.locator('#countries [data-country="Poland"]').getAttribute('aria-pressed')) === 'true' && (await year(page)) >= 1900);
  const polCount = await A(page, () => { const c = window.__atlas.world.countries().find((x) => x.name === 'Poland'); return c.people.length; });
  const polListed = await page.evaluate(() => new Set([...document.querySelectorAll('#record h3')].filter((h) => !/Places|Of those/.test(h.textContent)).flatMap((h) => [...h.nextElementSibling.querySelectorAll('[data-go]')].map((b) => b.dataset.go))).size);
  check('the country lists everyone it counts', polListed === polCount, `${polListed} listed, ${polCount} counted`);
  await page.locator('#record .back').click();
  check('Back from a country opened from another returns to the first', (await page.locator('#record h2').textContent()) === 'New Zealand');
  await page.locator('#record .back').click();
  check('going back again clears the country', (await page.locator('#countries [aria-pressed="true"]').count()) === 0 && (await A(page, () => window.__atlas.state.focus)) === null);
  await A(page, () => window.__atlas.setYear(1700));
  await page.locator('#countries [data-country="Wales"]').click();
  check('a country that is dark this year opens on a year when someone is lit there', Number((await page.locator('#countries [data-country="Wales"] b').textContent())) > 0 && /[1-9]\d* lit in/.test(await page.locator('#record .life').textContent()), await page.locator('#record .life').textContent());
  await page.locator('#record .back').click();
  await page.keyboard.press('s');
  await A(page, () => { window.__atlas.setYear(1790); window.__atlas.settle(); });
  const ny = await A(page, () => { const w = window.__atlas.world, s = window.__atlas.stages[0]; const a = w.actors.find((x) => w.countryOf(x, 1790) === 'United States'); return a ? s.screenOf(a.id) : null; });
  check('on two shores, someone in the United States is drawn in an inset of its own', Array.isArray(ny), JSON.stringify(ny));
  await page.keyboard.press('g');
  await A(page, () => window.__atlas.setYear(1880));

  // 7d. a selected person stays in view; Back goes back; the end is not empty
  await A(page, (id) => { window.__atlas.setYear(1893); window.__atlas.select(id); window.__atlas.settle(); }, edwin);
  await A(page, () => { window.__atlas.setYear(1862); window.__atlas.settle(); });
  const kept = await A(page, (id) => { const s = window.__atlas.stages[0], q = s.screenOf(id); return q && q[0] > 40 && q[0] < s.W - 40 && q[1] > 40 && q[1] < s.H - 40; }, edwin);
  check('a selected person stays in view when the year moves', kept === true);
  await page.locator('#record .stops [data-place]').first().click();
  const placeName1 = await page.locator('#record h2').textContent();
  await page.locator('#record .back').click();
  check('Back from a place returns to the person it was opened from', placeName1 !== 'Edwin Watkins' && (await page.locator('#record h2').textContent()) === 'Edwin Watkins');
  await page.locator('#record .stops [data-place]').first().click();
  await page.waitForTimeout(400);
  await page.goBack(); await page.waitForTimeout(400);
  check('the browser’s Back does the same and stays on the page', /atlas\.html/.test(page.url()) && (await page.locator('#record h2').textContent()) === 'Edwin Watkins');
  await page.locator('#record .back').click();
  await page.locator('#track').focus(); await page.keyboard.press('End');
  await A(page, () => window.__atlas.settle());
  const fin = await A(page, () => { const s = window.__atlas.scene(); return [s.lights.length, s.embers.length, s.embers.every((e) => e.bright)]; });
  check('at the present the map is not empty: embers stay lit and a line says why it is dark', (await year(page)) === 2026 && fin[0] === 0 && fin[1] > 40 && fin[2] && /living relatives carry on/.test(await page.locator('#caption.on').textContent()) && /109 living, not shown/.test(await page.locator('#alive').textContent()));
  await page.keyboard.press('Home');
  check('Home goes to the first year', (await year(page)) < 1600);
  await A(page, () => window.__atlas.setYear(1880));

  // 7e. records that name only a country still count; the sea is counted
  const sarah = await idOf(page, 'Sarah Ann Hurley');
  const sh = await A(page, (id) => { const w = window.__atlas.world, a = w.byId.get(id); const at = (y) => { const l = w.scene(y, null, null).lights.find((x) => x.actor === a); return [w.countryOf(a, y), l ? l.haze : null]; }; return [at(1858.5), at(1865.5), at(1880.5)]; }, sarah);
  check('a record naming only New Zealand moves the person there, as a haze, until a town is recorded', sh[0][0] === 'England' && sh[1][0] === 'New Zealand' && sh[1][1] === true && sh[2][0] === 'New Zealand' && sh[2][1] === false, JSON.stringify(sh));
  await A(page, () => window.__atlas.setYear(1874));
  check('a voyage that falls inside one year is counted as at sea', (await page.locator('#countries .sea b').textContent()) === '2' && (await A(page, () => Boolean(window.__atlas.scene().ship))));
  const sums = await A(page, () => { const out = []; for (const y of [1700, 1855, 1874, 1900, 1960]) { window.__atlas.setYear(y); window.__atlas.settle(); const c = window.__atlas.counts(); out.push(Object.values(c).reduce((a, b) => a + b, 0) === window.__atlas.scene().alive && document.querySelector('#alive').textContent.startsWith(String(window.__atlas.scene().alive))); } return out; });
  check('chips, the count under the year and the lights drawn agree', sums.every(Boolean), JSON.stringify(sums));
  const atSea = seen.filter((c) => c[2]);
  check('while the ship is at sea the caption is about that voyage', atSea.length > 5 && atSea.filter((c) => /Edwin Watkins and Fanny Page Loveless/.test(c[3])).length >= atSea.length * 0.8, `${atSea.filter((c) => /Edwin Watkins/.test(c[3])).length} of ${atSea.length} samples`);
  await A(page, () => window.__atlas.setYear(1880));

  // 8. lenses
  await page.keyboard.press('2');
  check('the birthplace lens recolours and rewrites the key', /Norfolk/.test(await page.locator('#legend').textContent()) && (await page.locator('#lens [data-lens="place"]').getAttribute('aria-checked')) === 'true');
  await page.keyboard.press('3');
  check('the certainty lens names its four kinds', /Placed by a record/.test(await page.locator('#legend').textContent()) && /Identity disputed/.test(await page.locator('#legend').textContent()));
  await page.keyboard.press('1');

  // 8b. the Key is a filter; a dated voyage can be ridden
  await page.locator('#legend .key-toggle').click();
  await page.locator('#legend [data-group="Finch"]').click();
  const grp = await A(page, () => { const st = window.__atlas.state; return [st.group, st.focus?.size ?? 0, window.__atlas.scene().lights.filter((l) => l.alpha > 0.3).length, window.__atlas.scene().lights.length]; });
  check('tapping a line in the Key lights only that line', grp[0] === 'Finch' && grp[1] > 10 && grp[2] > 0 && grp[2] < grp[3], JSON.stringify(grp));
  await page.locator('#legend [data-group="Finch"]').click();
  check('tapping it again clears it', (await A(page, () => window.__atlas.state.focus)) === null);
  await page.locator('#legend .key-toggle').click();
  await page.locator('#panel-body [data-finding^="a-same-year"]').click();
  await page.locator('#panel-body [data-ride]').click();
  let rode = false;
  for (let i = 0; i < 80 && !rode; i++) { await page.waitForTimeout(150); rode = await A(page, () => Boolean(window.__atlas.scene().ship)); }
  check('a finding about a dated voyage offers to sail it, and the ship sails', rode && (await A(page, () => window.__atlas.state.playing)));
  await A(page, () => window.__atlas.stop());
  await page.keyboard.press('Escape');
  await A(page, () => window.__atlas.setYear(1880));

  // 8c. findings are starred on the map; following anyone tells their records
  await A(page, () => { window.__atlas.setView('shores'); window.__atlas.setYear(1850); window.__atlas.settle(); });
  const before = await A(page, () => window.__atlas.stages[0].starScreen('a-first-crossing'));
  await A(page, () => { window.__atlas.setYear(1856); window.__atlas.settle(); });
  const star = await page.evaluate(() => { const s = window.__atlas.stages[0], q = s.starScreen('a-first-crossing'), r = s.canvas.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1]] : null; });
  check('a finding is starred on the map from the year it happens, not before', before === null && Array.isArray(star));
  // a tap near both a star and a light goes to whichever is nearer
  const near = await page.evaluate(() => { const s = window.__atlas.stages[0], st = s.starScreen('a-first-crossing'), r = s.canvas.getBoundingClientRect(); let best = null; for (const l of window.__atlas.scene().lights) { const q = s.screenOf(l.actor.id); if (!q) continue; const d = Math.hypot(q[0] - st[0], q[1] - st[1]); if (d < 30 && (!best || d < best.d)) best = { d, id: l.actor.id, x: r.left + q[0], y: r.top + q[1] }; } return best; });
  if (near) {
    await page.mouse.click(near.x, near.y);
    check('a click on a light beside a star opens the person, not the finding', (await A(page, () => window.__atlas.state.selected)) !== null && (await A(page, () => window.__atlas.state.finding)) === null, JSON.stringify(near));
    await page.keyboard.press('Escape');
  } else check('a click on a light beside a star opens the person, not the finding', true, 'no light within 30 px of the star at this size');
  await page.mouse.click(star[0], star[1]);
  check('tapping the star opens the finding', (await A(page, () => window.__atlas.state.finding)) === 'a-first-crossing' && (await page.locator('#panel-body .card.on').count()) === 1);
  await page.keyboard.press('Escape');
  await A(page, () => window.__atlas.setView('globe'));
  const tf1 = await A(page, () => window.__atlas.world.actors.find((a) => a.p.name === 'Thomas Finch' && a.b === 1823).id);
  await A(page, (id) => window.__atlas.select(id), tf1);
  await page.locator('#record [data-act="follow"]').click();
  const told = new Set();
  for (let i = 0; i < 90; i++) { await page.waitForTimeout(150); if (await page.locator('#caption.on').count()) told.add(await page.locator('#caption').textContent()); if (!(await A(page, () => window.__atlas.state.playing))) break; }
  check('following someone who never sails still tells their records, place by place', told.size >= 2 && [...told].some((t) => /Sproughton/.test(t)) && [...told].some((t) => /Howick/.test(t)) && ![...told].some((t) => /Edwin Watkins/.test(t)), [...told].map((t) => t.slice(0, 40)).join(' | '));
  // a second follow, started while the first one's caption is still up, shows none of the first's
  await A(page, () => window.__atlas.stop());
  await A(page, (id) => window.__atlas.select(id), tf1);
  await page.locator('#record [data-act="follow"]').click();
  for (let i = 0; i < 30 && !(await page.locator('#caption.on').count()); i++) await page.waitForTimeout(100);
  const firstCap = await page.locator('#caption').textContent();
  await A(page, (id) => window.__atlas.select(id), edwin);
  await page.locator('#record [data-act="follow"]').click();
  const second = new Set();
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(100); if (await page.locator('#caption.on').count()) second.add(await page.locator('#caption').textContent()); }
  check('a second follow never shows the first person’s caption', /Sproughton/.test(firstCap) && ![...second].some((t) => /Sproughton|Howick/.test(t)), [...second].map((t) => t.slice(0, 30)).join(' | '));
  await A(page, () => window.__atlas.stop());
  await page.keyboard.press('Escape');
  await A(page, () => window.__atlas.setYear(1880));

  // 8d. things an outside tester found: sentences that must agree with each other
  await A(page, () => window.__atlas.openCountry('New Zealand'));
  const nzCame = Number((await page.locator('#record h3', { hasText: 'Came here from another country' }).textContent()).match(/\((\d+)\)/)[1]);
  const crossers = Number((await A(page, () => window.__atlas.atlas.facts.find((f) => f.id === 'a-one-way').title)).match(/^(\d+)/)[1]);
  check('the New Zealand panel and the findings agree on how many came', nzCame === crossers, `${nzCame} vs ${crossers}`);
  await page.keyboard.press('Escape');
  check('the help does not say hollow lights never move', await (async () => { await page.locator('#help').click(); const t = await page.locator('#record').textContent(); await page.keyboard.press('Escape'); return /goes where that parent is next recorded/.test(t) && !/and they never move/.test(t); })());
  const dead = await page.evaluate(() => { document.querySelector('#legend .key-toggle').click(); const out = [...document.querySelectorAll('#legend [data-group]')].map((b) => b.dataset.group).filter((g) => !window.__atlas.world.actors.some((a) => window.__atlas.atlas && (window.__atlas.state.lens === 'surname'))); document.querySelector('#legend .key-toggle').click(); return out; });
  const swatches = await page.evaluate(() => { document.querySelector('#legend .key-toggle').click(); const keys = [...document.querySelectorAll('#legend [data-group]')].map((b) => b.dataset.group); const res = []; for (const k of keys) { document.querySelector(`#legend [data-group="${k}"]`).click(); res.push([k, window.__atlas.state.focus ? window.__atlas.state.focus.size : 0]); document.querySelector(`#legend [data-group="${k}"]`).click(); } document.querySelector('#legend .key-toggle').click(); return res; });
  check('every colour in the Key lights someone', swatches.length >= 5 && swatches.every((x) => x[1] > 0) && dead.length === 0, JSON.stringify(swatches));
  await page.evaluate(() => { document.querySelector('#legend .key-toggle').click(); document.querySelector('#legend [data-group]').click(); });
  check('a toast never blocks a control', (await page.evaluate(() => { const t = document.querySelector('.toast'); return t ? getComputedStyle(t).pointerEvents : 'none'; })) === 'none');
  await page.evaluate(() => { document.querySelector('#legend [data-group]').click(); document.querySelector('#legend .key-toggle').click(); });
  check('and it goes when the selection is cleared', (await page.locator('.toast').count()) === 0);
  await page.keyboard.press('Tab');
  await page.locator('#countries [data-country="Poland"]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check('opening a country by keyboard leaves focus in the record', await page.evaluate(() => Boolean(document.activeElement?.closest('#record'))));
  await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  check('and Back by keyboard leaves focus on the panel, not at the top of the page', await page.evaluate(() => Boolean(document.activeElement?.closest('#panel'))));
  await page.mouse.move(700, 500);
  await A(page, () => window.__atlas.setYear(1880));

  // 9. the panel: findings, places, people
  const cards = await page.locator('#panel-body [data-finding]').count();
  check('findings are listed', cards >= 7, String(cards));
  const allF = await A(page, () => { const out = []; for (const f of [...window.__atlas.atlas.facts, ...window.__atlas.atlas.leads]) { window.__atlas.openFinding(f.id); const sc = window.__atlas.scene(); const ok = f.people.some((id) => sc.lights.some((l) => l.actor.id === id)) || f.people.every((id) => { const a = window.__atlas.world.byId.get(id); return !a || a.on >= a.d; }); if (!ok) out.push(f.id); window.__atlas.openFinding(f.id); } return out; });
  check('every finding opens on a year when someone it is about is lit', allF.length === 0, allF.join(', '));
  check('the split-family finding only counts brothers and sisters alive to be parted', /still living then/.test(await page.locator('#panel-body [data-finding="a-split-siblings"]').textContent()));
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
  check('the list says who has a light and who only an ember', /\d+ people with a light/.test(await page.locator('#panel-body .kicker').textContent()));
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
  await page.waitForTimeout(150);
  check('after a search the keyboard is in the record that opened', await page.evaluate(() => Boolean(document.activeElement?.closest('#record'))));
  await page.keyboard.press('/'); await page.locator('#search').fill('poland'); await page.keyboard.press('Enter');
  check('search finds a country', (await page.locator('#record h2').textContent()) === 'Poland');
  await page.locator('#record .back').click();
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
  const t1 = Date.now(); let held = 0;
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(100); const now = await page.locator('#caption').textContent(); if (now !== cap || !(await page.locator('#caption.on').count())) break; held = Date.now() - t1; }
  check('a caption stays up long enough to read', held >= 1800, `${held} ms`);
  check('a caption keeps a loose year loose and says what the voyage meant for the children', /Thomas Finch is in Howick/.test(cap) && /about 1823/.test(cap) && /children are born in New Zealand/.test(cap), cap.slice(0, 200));
  check('a caption says what the records say, and no more', /1855/.test(cap) && /Last recorded in/.test(cap) && !/sailed|ship/.test(cap), cap.slice(0, 70));
  const capBox = await page.locator('#caption').boundingBox(), stBox = await page.locator('#stage').boundingBox();
  check('captions sit at the bottom, clear of the countries and the rim pointers', capBox.y > stBox.y + stBox.height * 0.6);
  await A(page, () => window.__atlas.stop());
  // 12b. every caption is about a record
  const badCaps = await A(page, () => window.__atlas.beats().filter((b) => /first recorded in \d|^By /.test(b.text) && (b.ids ?? []).some((id) => { const a = window.__atlas.world.byId.get(id); return !a || a.a.stops.every((s) => s.kind === 'borrowed'); })).map((b) => b.text.slice(0, 60)));
  check('no caption says “recorded” of someone with no record of their own', badCaps.length === 0, badCaps.join(' | '));
  const caps = await A(page, () => window.__atlas.beats().map((b) => b.y));
  let quiet = 0; for (let i = 1; i < caps.length; i++) if (caps[i - 1] >= 1700) quiet = Math.max(quiet, caps[i] - caps[i - 1]);
  check('no half-century passes without a caption after 1700', quiet <= 50, `longest gap ${quiet} years, ${caps.length} captions`);
  await A(page, () => window.__atlas.openFinding('a-first-wales'));
  check('the Wales finding opens on a year when Wales is lit', Number(await page.locator('#countries [data-country="Wales"] b').textContent()) > 0, await page.locator('#countries [data-country="Wales"]').textContent());
  await page.keyboard.press('Escape');

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
  await page.locator('#open-river').click();
  await page.waitForSelector('#river');
  await page.waitForSelector('#record:not([hidden]) h2');
  check('“Open in the River” opens the same person there', (await page.locator('#record h2').textContent()) === 'Edwin Watkins');
  check('the River links back to the Atlas for that person', (await page.locator('#record a[href*="atlas.html#p="]').count()) === 1 && (await page.locator('a.mode-link[href*="atlas.html"]').count()) === 1);
  await page.locator('#record a[href*="atlas.html#p="]').click();
  await page.waitForSelector('#views');
  await page.waitForSelector('#record:not([hidden]) h2');
  check('and “See on the map” comes back, on the same year, with the light lit', (await page.locator('#record h2').textContent()) === 'Edwin Watkins' && (await year(page)) === 1862 && (await A(page, (id) => window.__atlas.scene().lights.some((l) => l.actor.id === id), edwin)));
  await page.close();

  page = await open('');
  await page.goto(base + 'index.html'); await page.waitForSelector('#river'); await page.waitForTimeout(2500);
  const ry = Number(await page.locator('#year').textContent());
  await page.locator('a.mode-link').click(); await page.waitForSelector('#views'); await page.waitForSelector('#app:not(.loading)');
  check('from the River in mid-play, the Atlas opens on the year that was showing', Math.abs((await year(page)) - ry) <= 12 && (await year(page)) > 1560, `${ry} -> ${await year(page)}`);
  await page.goto(base + `index.html#p=${encodeURIComponent(tf)}`); await page.reload(); await page.waitForSelector('#record:not([hidden]) h2');
  await page.locator('#see-map').click(); await page.waitForSelector('#views'); await page.waitForSelector('#record:not([hidden]) h2');
  check('“See on the map” from the present day lands in the person’s lifetime, lit', (await year(page)) < 1900 && (await A(page, (id) => window.__atlas.scene().lights.some((l) => l.actor.id === id), tf)), String(await year(page)));
  await page.close();
  page = await open('#v=shores');
  check('a link with no year opens on a year with people in it', (await A(page, () => window.__atlas.scene().alive)) > 50 && (await year(page)) < 2000, String(await year(page)));
  await page.close();
  page = await open(`#p=${encodeURIComponent(edwin)}`);
  check('a link to a person with no year opens in their lifetime', (await year(page)) >= 1848 && (await year(page)) < 1912 && (await A(page, (id) => window.__atlas.scene().lights.some((l) => l.actor.id === id), edwin)));
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
  // one finger turns the globe, two fingers zoom it, and the page itself does not move
  const cdp = await page.context().newCDPSession(page);
  const vb = await page.locator('#view-a').boundingBox();
  const mx = vb.x + vb.width / 2, my = vb.y + vb.height / 2;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const lon1 = await A(page, () => window.__atlas.stages[0].cam.lon);
  await touch('touchStart', [[mx, my]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[mx - i * 15, my + i * 3]]); await touch('touchEnd', []);
  check('on a phone one finger turns the globe', Math.abs((await A(page, () => window.__atlas.stages[0].cam.lon)) - lon1) > 0.5 && (await page.evaluate(() => scrollY)) === 0);
  const k1 = await A(page, () => window.__atlas.stages[0].cam.k);
  await touch('touchStart', [[mx - 30, my], [mx + 30, my]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[mx - 30 - i * 12, my], [mx + 30 + i * 12, my]]); await touch('touchEnd', []);
  check('on a phone two fingers zoom it', (await A(page, () => window.__atlas.stages[0].cam.k)) > k1 * 1.3, `${k1.toFixed(2)} -> ${(await A(page, () => window.__atlas.stages[0].cam.k)).toFixed(2)}`);
  await page.locator('#zfit').tap();
  await A(page, () => window.__atlas.settle());
  const sp = await page.evaluate(() => { const s = window.__atlas.stages[0], r = s.canvas.getBoundingClientRect(); const id = (window.__atlas.atlas.facts.concat(window.__atlas.atlas.leads)).map((f) => f.id).find((i) => s.starScreen(i)); const q = id ? s.starScreen(id) : null; return q ? [id, r.left + q[0], r.top + q[1]] : null; });
  if (sp) { await page.touchscreen.tap(sp[1], sp[2]); await page.waitForTimeout(300); check('on a phone a tap on a star opens something', (await A(page, () => window.__atlas.state.finding)) !== null || (await A(page, () => window.__atlas.state.selected)) !== null, sp[0]); await page.keyboard.press('Escape'); }
  // two stars side by side at Norwich: each can be opened by touch
  await A(page, () => { window.__atlas.setYear(1700); window.__atlas.stages[0].resume(); window.__atlas.settle(); });
  const two = await page.evaluate(() => { const s = window.__atlas.stages[0], r = s.canvas.getBoundingClientRect(); return ['a-birthplace', 'a-doubt-I900104'].map((id) => { const q = s.starScreen(id); return q ? [id, r.left + q[0], r.top + q[1]] : null; }); });
  if (two.every(Boolean)) {
    const got = [];
    for (const t of two) { await page.touchscreen.tap(t[1], t[2]); await page.waitForTimeout(250); got.push(await A(page, () => window.__atlas.state.finding)); await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
    check('on a phone two stars at the same town each open their own finding', got[0] === two[0][0] && got[1] === two[1][0], JSON.stringify(got));
  } else check('on a phone two stars at the same town each open their own finding', false, 'stars not found at 1700');
  if (await page.locator('#panel.open').count()) await page.locator('#grab').tap();
  await A(page, () => { window.__atlas.setYear(1880); window.__atlas.stages[0].resume(); window.__atlas.settle(); });
  await page.locator('.view [data-view="shores"]').tap();
  await A(page, () => window.__atlas.settle());
  const stacked = await A(page, () => { const s = window.__atlas.stages[0], w = window.__atlas.world; const e = w.actors.find((a) => s.screenOf(a.id) && w.lightOf(a, 1880)?.[0] < 10), n = w.actors.find((a) => s.screenOf(a.id) && w.lightOf(a, 1880)?.[0] > 150); return e && n ? s.screenOf(n.id)[1] - s.screenOf(e.id)[1] : 0; });
  check('on a phone the two shores stack', stacked > 40, String(stacked));
  await page.locator('#legend .key-toggle').tap();
  await A(page, () => { window.__atlas.setYear(1852); window.__atlas.play(); });
  for (let i = 0; i < 40 && !(await page.locator('#caption.on').count()); i++) await page.waitForTimeout(150);
  await A(page, () => window.__atlas.stop());
  const cz = await page.evaluate(() => { const c = document.querySelector('#caption').getBoundingClientRect(), z = document.querySelector('.zoom').getBoundingClientRect(); return [Math.round(c.right), Math.round(z.left), c.width > 150]; });
  check('on a phone the caption stays clear of the buttons', cz[0] <= cz[1] && cz[2], JSON.stringify(cz));
  await A(page, () => window.__atlas.setYear(1880));
  const chipsIn = await page.evaluate(() => [...document.querySelectorAll('#countries [data-country]')].map((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  check('on a phone every country chip is on screen without a swipe', chipsIn.length === 6 && chipsIn.every(Boolean), JSON.stringify(chipsIn));
  check('on a phone the Key opens', !(await page.locator('#legend.collapsed').count()) && /Hollow/.test(await page.locator('#legend').innerText()));
  await page.locator('#legend .key-toggle').tap();
  const hdr = await page.locator('.top').boundingBox();
  check('on a phone the header leaves the map most of the screen', hdr.height < 130 && (await page.locator('#view-a').boundingBox()).height > 480, `${Math.round(hdr.height)} px`);
  const nzP = await A(page, () => { const w = window.__atlas.world; return w.actors.find((a) => !a.hollow && w.lightOf(a, 1880.5)?.[0] > 150).id; });
  await A(page, (id) => { window.__atlas.select(id); window.__atlas.settle(); }, nzP);
  await page.waitForTimeout(500); await A(page, () => window.__atlas.settle());
  const vis = await page.evaluate((id) => { const s = window.__atlas.stages[0], q = s.screenOf(id), r = s.canvas.getBoundingClientRect(), sheet = document.querySelector('#panel').getBoundingClientRect(); return q ? [Math.round(r.top + q[1]), Math.round(sheet.top)] : null; }, nzP);
  check('on a phone, two shores keeps a selected person above the open sheet', vis && vis[0] < vis[1] - 8, JSON.stringify(vis));
  await page.locator('#record .back').click();
  await page.close();

  // 16. a phone on its side, and reduced motion
  page = await open('#y=1880', { width: 800, height: 380 }, { hasTouch: true, isMobile: true });
  check('sideways, the map still draws beside the panel', (await inked(page)) > 150 && (await page.locator('#view-a').boundingBox()).height > 120);
  const reach = await page.evaluate(() => [...document.querySelectorAll('.view button, #lens button, #countries [data-country="England"], #play, #help')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [b.dataset.view || b.dataset.lens || b.dataset.country || b.id, Boolean(e && (e === b || b.contains(e))), Math.round(r.width)]; }));
  check('sideways, every view, lens and the first country can be tapped', reach.length >= 8 && reach.every((r) => r[1] && r[2] >= 30), JSON.stringify(reach.filter((r) => !r[1])));
  await page.locator('.view [data-view="shores"]').tap();
  check('sideways, a tap switches to two shores', (await A(page, () => window.__atlas.stages[0].kind)) === 'shores');
  await page.close();
  page = await open('', { width: 1280, height: 800 }, { reducedMotion: 'reduce' });
  await page.waitForTimeout(1500);
  check('with reduced motion nothing plays by itself, and it opens on a peopled year', !(await A(page, () => window.__atlas.state.playing)) && (await inked(page)) > 500 && (await A(page, () => window.__atlas.scene().alive)) > 50);
  await page.close();

  // 17. what the last outside test found
  {
  page = await open('#y=1855');
  await A(page, () => window.__atlas.stop());
  const panelOf = async (id) => { await A(page, (i) => window.__atlas.select(i), id); return page.locator('#record').textContent(); };
  const pb = await panelOf('I11');
  check('an age counts birthdays: Peter Barlow, born October 1776, was 35 when a child was born in May 1812', /the last at 35\./.test(pb), (pb.match(/children on record[^.]*\./) || [''])[0]);
  const allMoves = await A(page, () => { const A_ = window.__atlas, out = []; for (const a of A_.world.actors) { A_.select(a.id); for (const m of document.querySelectorAll('#record .move b:first-child')) out.push(a.id + ': ' + m.textContent); } return out; });
  const inside = allMoves.filter((m) => /(New Zealand to (Wellington|Carterton|Whanganui|Northland))|Woolwich to England|Kent to Bexley/.test(m));
  check('a record that only names the country or county of the place before it is not listed as a move', allMoves.length > 60 && inside.length === 0, inside.slice(0, 3).join(' | '));
  check('no distance is given to or from a country', !allMoves.some((m) => /(England|Ireland|New Zealand|Poland)(,| to England,| to New Zealand,) [\d,]+ km/.test(m.split(': ')[1]) && /^(somewhere|England|Ireland|New Zealand|Poland) to |to (England|Ireland|New Zealand|Poland),/.test(m.split(': ')[1])), allMoves.filter((m) => /to (England|Ireland|New Zealand|Poland),/.test(m)).slice(0, 3).join(' | '));
  check('no reason on the page is the bare word "accomplishment"', !(await A(page, () => JSON.stringify(window.__atlas.atlas.people))).includes('accomplishment'));
  // light the family: those lit are in view, and the message goes with the selection
  const tf17 = await A(page, () => window.__atlas.world.actors.find((a) => a.p.name === 'Thomas Finch' && a.b === 1823).id);
  for (const y of [1830, 1850, 1880]) {
    await A(page, (o) => { window.__atlas.setYear(o.y); window.__atlas.select(o.id, false); window.__atlas.setYear(o.y); }, { y, id: tf17 });
    await page.locator('#record [data-act="family"]').click();
    await page.waitForTimeout(1600);
    const fam = await A(page, () => { const A_ = window.__atlas, st = A_.stages[0]; A_.settle(); const sc = A_.scene(); const ids = [...A_.state.focus]; const lit = ids.filter((id) => sc.lights.some((l) => l.actor.id === id)); const r = st.canvas.getBoundingClientRect(); const seen = lit.filter((id) => { const q = st.screenOf(id); return q && q[0] > 0 && q[1] > 0 && q[0] < r.width && q[1] < r.height; }); return [lit.length, seen.length, Boolean(document.querySelector('.toast'))]; });
    check(`light the family in ${y}: most of those lit are in view`, fam[0] > 0 && fam[1] * 2 >= fam[0] && fam[2], JSON.stringify(fam));
    await page.keyboard.press('Escape');
    check(`light the family in ${y}: Esc clears the message with the selection`, (await page.locator('.toast').count()) === 0 && (await A(page, () => window.__atlas.state.focus)) === null);
  }
  // the arrow keys keep stepping
  await page.keyboard.press('Tab');
  await page.locator('#views').focus();
  const stepped = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(120); stepped.push(await A(page, () => window.__atlas.state.selected)); }
  check('down arrow on the map steps through four different people', new Set(stepped).size === 4 && (await page.evaluate(() => document.activeElement?.id)) === 'views', JSON.stringify(stepped));
  await page.keyboard.press('Escape'); await page.waitForTimeout(80);
  check('Esc puts the keyboard back on the map it came from', (await page.evaluate(() => document.activeElement?.id)) === 'views');
  // a place name is a target along its whole length
  await A(page, () => { window.__atlas.setYear(1855); window.__atlas.settle(); });
  const labs = await A(page, () => { const st = window.__atlas.stages[0]; return [...window.__atlas.world.atSite.keys()].map((id) => [id, st.labelScreen(id)]).filter((x) => x[1]); });
  let labOk = labs.length > 2; const labBad = [];
  for (const [id, q] of labs) { const box = await page.locator('#view-a').boundingBox(); await A(page, () => window.__atlas.select(null)); await page.keyboard.press('Escape'); await A(page, () => window.__atlas.settle()); const q2 = await A(page, (i) => window.__atlas.stages[0].labelScreen(i), id); if (!q2) continue; await page.mouse.click(box.x + q2[0], box.y + q2[1]); await page.waitForTimeout(60); const got = await A(page, () => window.__atlas.state.finding ? 'star' : window.__atlas.state.place); /* a finding's star on top of the name wins */ if (got !== id && got !== 'star') { labOk = false; labBad.push(id + '→' + got); } void q; }
  check('every place name drawn opens its place when its far end is clicked', labOk, `${labs.length} labels; ${labBad.join(' ')}`);
  // sail with: the place being left is given a whole year and time to be read
  const fb = await A(page, () => { const A_ = window.__atlas; const a = A_.world.actors.find((x) => x.legs.some((l) => l.sail && l.km > 9000)); A_.select(a.id); A_.setYear(1873); A_.play(a.id); return a.id; });
  const capSeen = [];
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); const t = await page.evaluate(() => (document.querySelector('#caption.on b')?.textContent ?? '') + '|' + (document.querySelector('#caption.on')?.textContent ?? '').slice(0, 30)); capSeen.push(t); }
  const first17 = capSeen.find((t) => t !== '|'), held17 = capSeen.filter((t) => t === first17).length * 150;
  check('sail with: the first caption carries a whole year and stays long enough to read', Boolean(first17) && /^\d{4}\|/.test(first17) && held17 >= 2000, `${first17} held17 ${held17} ms`);
  await A(page, () => window.__atlas.stop()); void fb;
  await page.close();
  // a window of middling width: the chips shorten to fit; Esc from help returns to the ? button; the family message goes when a country opens
  page = await open('#y=1880', { width: 901, height: 700 });
  await A(page, () => window.__atlas.stop());
  const mid = await page.evaluate(() => { const r = document.querySelector('#countries'); return [r.scrollWidth <= r.clientWidth + 1, [...r.children].every((c) => { const b = c.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; })]; });
  check('at 901 wide every country chip fits on screen', mid[0] && mid[1], JSON.stringify(mid));
  await page.keyboard.press('Tab');
  await page.locator('#help').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(120); await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  check('Esc from help puts the keyboard back on the ? button', (await page.evaluate(() => document.activeElement?.id)) === 'help');
  await A(page, () => { const A_ = window.__atlas; A_.select(A_.world.actors.find((a) => a.p.name === 'Thomas Finch' && a.b === 1823).id, false); });
  await page.locator('#record [data-act="family"]').click(); await page.waitForTimeout(100);
  await page.locator('#countries [data-country="England"]').click(); await page.waitForTimeout(100);
  check('the family message does not stay over a country panel', (await page.locator('.toast').count()) === 0);
  await page.keyboard.press('Escape');
  await A(page, () => window.__atlas.setView('shores'));
  check('two shores, which cannot zoom, shows no zoom buttons', (await page.locator('#zin').isHidden()) && (await page.locator('#zout').isHidden()));
  await page.close();
  // what stays after a light goes out, and the claims the captions make
  page = await open('#y=1990');
  await A(page, () => window.__atlas.stop());
  const rem = await A(page, () => { const A_ = window.__atlas, w = A_.world; A_.setYear(1990); const sc = A_.scene(); const gone = w.actors.filter((a) => a.on < a.d && a.d <= 1990); const marked = new Set([...sc.embers, ...sc.rests].map((x) => x.actor.id)); return [gone.length, gone.filter((a) => marked.has(a.id)).length, sc.embers.every((e) => e.actor.ember), sc.rests.every((r) => !r.actor.ember), sc.rests.length]; });
  check('every light that has gone out leaves a mark: an ember where the death place is recorded, a ring otherwise', rem[0] > 250 && rem[0] === rem[1] && rem[2] && rem[3] && rem[4] > 150, JSON.stringify(rem));
  const caps = await A(page, () => window.__atlas.beats().map((b) => b.text));
  const peak = caps.find((t) => /the most it ever will/.test(t)) || '', tip = caps.find((t) => /^From \d{4} more of the family/.test(t)) || '';
  check('captions that count lights say when hollow ones are counted', /are hollow/.test(peak) && /record of their own/.test(peak) && /hollow lights included/.test(tip), peak + ' | ' + tip);
  const brit = await A(page, () => { const A_ = window.__atlas, w = A_.world; const t = A_.beats().find((b) => /no light is left in Britain/.test(b.text)); if (!t) return null; const y = Number(/After (\d{4})/.exec(t.text)[1]); const gb = (yy) => w.actors.filter((a) => ['England', 'Wales'].includes(w.countryOf(a, yy + 0.5))).length; return [y, gb(y), gb(y + 1), Math.max(...Array.from({ length: 2026 - y }, (_, i) => gb(y + 1 + i)))]; });
  check('the caption about the last light in Britain matches what is drawn', brit && brit[1] > 0 && brit[2] === 0 && brit[3] === 0, JSON.stringify(brit));
  const p67 = await A(page, () => { window.__atlas.select('I67'); return document.querySelector('#record').textContent; });
  check('a voyage whose arrival the tree dates is not said to be undated', /The tree dates the arrival: 2 Jul 1883/.test(p67) && !/do not date the voyage/.test(p67.split('Auckland to')[0].split('to Auckland').pop() || ''), (p67.match(/to Auckland[^]*?River\./) || [''])[0].slice(0, 300));
  await page.keyboard.press('Escape');
  // the page never says outright that something is unrecorded: it says what the map reads
  const allText = await A(page, () => { const A_ = window.__atlas, out = []; for (const a of A_.world.actors) { A_.select(a.id); out.push(a.id + ' :: ' + document.querySelector('#record').textContent); } for (const c of ['England', 'New Zealand', 'Wales', 'Poland', 'United States', 'Ireland']) { A_.openCountry(c); out.push(c + ' :: ' + document.querySelector('#record').textContent); } document.querySelector('#help').click(); out.push('guide :: ' + document.querySelector('#record').textContent); out.push('captions :: ' + A_.beats().map((b) => b.text).join(' | ')); out.push('findings :: ' + JSON.stringify([A_.atlas.facts, A_.atlas.leads])); return out; });
  const bare = /\bnot recorded\b|\bno recorded\b|No death is recorded|(?<!map reads )[Nn]o record\b|the tree does not|[Rr]ecords (here )?do not (say|date)|[Nn]obody wrote|names no ship|No ship is named/;
  const hitsBare = allText.filter((t) => bare.test(t)).map((t) => t.split(' :: ')[0] + ': ' + (bare.exec(t) || [''])[0]);
  check('no panel, caption, finding or guide text says outright that something is unrecorded', allText.length > 320 && hitsBare.length === 0, hitsBare.slice(0, 6).join(' | '));
  const whc = allText.find((t) => t.startsWith('L5KW-4FV')) || '';
  check('a voyage the map has a dated emigration for is not called undated', /The tree dates the arrival: 1857/.test(whc) && !/no dated record of this voyage/.test(whc));
  await page.keyboard.press('Escape');
  check('no page text says the tree names no ship', !/names no ship|does not record the ship/.test(await A(page, () => { document.querySelector('#help').click(); return document.querySelector('#record').textContent + document.querySelector('#panel-body').textContent + JSON.stringify(window.__atlas.atlas.leads); })));
  await page.close();
  // Home after playing: the first years have no light at all, and the globe must still draw
  page = await open('#y=1700');
  await A(page, () => { const A_ = window.__atlas; A_.stop(); A_.setYear(1700); A_.play(); });
  await page.waitForTimeout(9000);
  await page.keyboard.press('Home'); await page.waitForTimeout(600);
  const home1 = await A(page, () => { const c = window.__atlas.stages[0].cam; return [window.__atlas.state.year, isFinite(c.k) && isFinite(c.lon) && isFinite(c.lat)]; });
  await A(page, () => { window.__atlas.setYear(1850); window.__atlas.settle(); });
  check('Home after playing lands on the first, empty year and the globe still draws afterwards', home1[0] === 1590 && home1[1] && (await inked(page)) > 500 && errors.length === 0, JSON.stringify(home1) + ' ' + errors.slice(0, 1).join());
  for (const y0 of [1790, 1960]) { await A(page, (y) => { const A_ = window.__atlas; A_.setYear(y); A_.play(); }, y0); await page.waitForTimeout(1500); await page.keyboard.press('Home'); await page.waitForTimeout(300); }
  check('and again from later years', (await A(page, () => isFinite(window.__atlas.stages[0].cam.k))) && errors.length === 0);
  await A(page, () => { window.__atlas.setYear(2026); window.__atlas.settle(); });
  const fin = await page.evaluate(() => [...document.querySelectorAll('#countries button')].map((b) => b.getAttribute('aria-label')));
  const finSum = await A(page, () => { const sc = window.__atlas.scene(); return sc.embers.length + sc.rests.length; });
  check('on the last frame the chips count what each country remembers, and they add up to the marks drawn', fin.every((t) => /remembered$/.test(t)) && fin.reduce((n, t) => n + Number(/: (\d+)/.exec(t)[1]), 0) === finSum && finSum > 300, JSON.stringify(fin) + ' ' + finSum);
  check('no finding says the tree names no ship', !/does not name a ship|names no ship/.test(await A(page, () => JSON.stringify([window.__atlas.atlas.facts, window.__atlas.atlas.leads]))));
  await page.close();
  // phones: every country chip on screen while someone is at sea; the caption under the lower map
  page = await open('#y=1874', { width: 390, height: 800 }, { hasTouch: true, isMobile: true });
  await A(page, () => { window.__atlas.stop(); window.__atlas.setYear(1874); window.__atlas.settle(); });
  const chipsR = await page.evaluate(() => [...document.querySelectorAll('#countries > *')].map((c) => Math.round(c.getBoundingClientRect().right)));
  check('on a phone every country chip is on screen while someone is at sea', chipsR.length === 7 && Math.max(...chipsR) <= 390, JSON.stringify(chipsR));
  await A(page, () => { window.__atlas.setView('shores'); window.__atlas.settle(); });
  const capBox = await page.evaluate(() => { const c = document.querySelector('#caption'); c.classList.add('on'); c.innerHTML = '<b>1870</b>Edward Charles Carter dies in Wellington in 1870. Last recorded in Bexley in 1831.'; const w = window.__atlas.stages[0].siteScreen('wellington'); const cv = window.__atlas.stages[0].canvas.getBoundingClientRect(), r = c.getBoundingClientRect(); return [r.top, w ? cv.top + w[1] : null]; });
  check('on a phone the caption sits under the lower map, not on the place it describes', capBox[1] !== null && capBox[0] > capBox[1] + 20, JSON.stringify(capBox));
  await page.close();

  }

  check('no errors in the console', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed} of ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
