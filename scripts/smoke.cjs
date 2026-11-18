// End-to-end smoke test in a real browser.
//   npm run smoke                      against a dev server you started (http://localhost:5173/)
//   npm run smoke -- http://host/      against any address
//   npm run verify                     builds, serves dist/ itself, and tests that
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const selfServe = process.argv.includes('--preview');
const url = selfServe ? 'http://localhost:4173/' : process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:5173/';
let server;
async function serve() {
  if (!selfServe) return;
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 200)); }
  throw new Error('preview server did not start');
}
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`); };

process.on('exit', () => server?.kill());
(async () => {
  await serve();
  const browser = await chromium.launch();
  const errors = [];
  const open = async (hash = '', viewport = { width: 1440, height: 900 }) => {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(url + hash);
    await page.waitForSelector('#app:not(.loading)');
    return page;
  };
  const year = (p) => p.evaluate(() => Number(document.querySelector('#year').textContent));

  // 1. the river plays by itself on first load
  let page = await open();
  const y0 = await year(page);
  await page.waitForTimeout(2600);
  const y1 = await year(page);
  check('intro starts in the past and plays forward', y0 < 1700 && y1 > y0, `${y0} -> ${y1}`);
  check('the camera starts close and pulls back', await page.evaluate(() => window.__river.river.k > 1));
  await page.keyboard.press(' ');
  const y2 = await year(page); await page.waitForTimeout(500);
  check('space pauses', (await year(page)) === y2);
  check('people appear as time passes', (await page.locator('.p.alive').count()) > 0 && (await page.locator('.p.unborn').count()) > 100);

  // 2. scrub with the track and keys
  const box = await page.locator('#track').boundingBox();
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
  const y3 = await year(page);
  check('clicking the track sets the year', y3 > 1780 && y3 < 1900, String(y3));
  await page.keyboard.press('ArrowRight');
  check('arrow key steps a year', (await year(page)) === y3 + 1);
  check('a caption or alive count is shown', /alive/.test(await page.locator('#alive').textContent()));

  // 3. tap a person
  await page.evaluate(() => window.__river.setYear(1862));
  const dot = page.locator('.p[data-id="I11"] .hit');
  const db = await dot.boundingBox();
  await page.mouse.click(db.x + db.width / 2, db.y + db.height / 2);
  await page.waitForSelector('#record:not([hidden]) h2');
  check('tapping a light opens the record', (await page.locator('#record h2').textContent()) === 'Peter Barlow');
  check('record shows sources and family', (await page.locator('#record .cites li').count()) >= 1 && (await page.locator('#record [data-go]').count()) >= 3);
  check('ancestors and descendants are lit', (await page.locator('.p.lit').count()) > 10);
  check('the url carries the selection', /p=I11/.test(await page.evaluate(() => new Promise((r) => setTimeout(() => r(location.hash), 400)))));
  await page.locator('#record [data-act="follow"]').click();
  await page.waitForTimeout(700);
  check('follow the water draws a pulse that can actually paint', await page.evaluate(() => { const el = document.querySelector('.pulse'); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.filter === 'none' && el.getTotalLength() > 100 && el.getAnimations().length === 1; }));
  check('space pauses after follow the water', await page.evaluate(() => window.__river.state.playing) === true);
  await page.keyboard.press(' ');
  check('and it does pause', await page.evaluate(() => window.__river.state.playing) === false);
  await page.locator('#record [data-go]').first().click();
  check('family chips navigate', (await page.locator('#record h2').textContent()) !== '');
  await page.locator('#record [data-act="back"]').click();
  check('back closes the record', await page.locator('#record').isHidden());

  // a light sitting on the year line can still be tapped
  const onLine = await page.evaluate(() => {
    const r = window.__river; r.setYear(1862);
    const hit = [...r.L.spots.values()].filter((s) => s.year === 1862 && !r.data.people.find((p) => p.id === s.id).living)[0];
    const svg = document.querySelector('#river').getBoundingClientRect();
    return hit ? { id: hit.id, x: svg.left + hit.x * r.river.k + r.river.tx, y: svg.top + hit.y * r.river.k + r.river.ty } : null;
  });
  if (onLine) {
    await page.mouse.click(onLine.x, onLine.y);
    await page.waitForTimeout(200);
    check('a person born in the current year can be tapped through the year line', (await page.evaluate(() => window.__river.state.selected)) === onLine.id && (await year(page)) === 1862);
    await page.keyboard.press('Escape');
  }

  // a life in sentences, namesakes, what rests on a link, and how two people are related
  await page.evaluate(() => window.__river.select('I900005'));
  await page.waitForSelector('#record .lifelines');
  check('a record tells the life in sentences', /children/.test(await page.locator('#record .lifelines').textContent()), (await page.locator('#record .lifelines').textContent()).slice(0, 80));
  check('a doubted link says what rests on it', /If this link is wrong/.test(await page.locator('#record .rests').textContent()));
  await page.locator('#record [data-act="upstream"]').click();
  check('and can show them', (await page.locator('.p.lit').count()) >= 4);
  await page.locator('#record [data-act="names"]').click();
  check('namesakes light together', (await page.locator('.p.lit').count()) >= 5);
  await page.evaluate(() => window.__river.select('I11'));
  await page.locator('#record [data-act="relate"]').click();
  await page.evaluate(() => window.__river.select('I900125'));
  await page.waitForSelector('#record .kinline');
  const kin = await page.locator('#record .kinline').textContent();
  check('two people can be related in words', /Peter Barlow \(1776.1862\) is the (nephew|son) of Peter Barlow \(1745\)/.test(kin), kin);
  check('the relationship is in the url', /k=I11,I900125/.test(await page.evaluate(() => new Promise((r) => setTimeout(() => r(decodeURIComponent(location.hash)), 400)))));
  await page.locator('#record [data-act="back"]').click();

  // findings marked on the river
  await page.evaluate(() => { window.__river.setYear(2026); window.__river.river.fit(false); });
  await page.waitForTimeout(700);
  const nMarks = await page.locator('.finding').count();
  const mb = await page.locator('.finding[data-find="fact:first-nz"] .fstar').boundingBox();
  await page.mouse.click(mb.x + mb.width / 2, mb.y + mb.height / 2);
  await page.waitForTimeout(500);
  check('findings are starred on the river and open when tapped', nMarks >= 4 && (await page.evaluate(() => window.__river.state.lead)) === 'fact:first-nz', `${nMarks} stars`);
  await page.keyboard.press('Escape');
  await page.locator('.tabs [data-tab="case"]').click();

  // keyboard route to the lights
  await page.locator('#river').focus();
  await page.keyboard.press('ArrowDown');
  const k1 = await page.locator('#record h2').textContent();
  await page.keyboard.press('ArrowDown');
  const k2 = await page.locator('#record h2').textContent();
  check('arrow keys on the river step through people', Boolean(k1) && (await page.evaluate(() => window.__river.state.selected)) !== null && (await page.evaluate(() => document.activeElement.id)) === 'river', `${k1} -> ${k2}`);
  await page.keyboard.press('Escape');

  // the year line stays in view when zoomed in
  await page.evaluate(() => { window.__river.setYear(1700); window.__river.river.zoomBy(4); });
  await page.waitForTimeout(400);
  const tb2 = await page.locator('#track').boundingBox();
  await page.mouse.click(tb2.x + tb2.width * 0.85, tb2.y + tb2.height / 2);
  await page.waitForTimeout(300);
  const cx = await page.evaluate(() => document.querySelector('.cursor').getBoundingClientRect().left);
  const sw = await page.evaluate(() => document.querySelector('#stage').getBoundingClientRect().width);
  check('zoomed in: scrubbing keeps the year line on screen', cx > 0 && cx < sw, `${Math.round(cx)} of ${Math.round(sw)}`);
  await page.evaluate(() => window.__river.river.fit(false));

  // 4. lenses
  for (const lens of ['place', 'certainty', 'surname']) {
    await page.locator(`.lens [data-lens="${lens}"]`).click();
    check(`lens: ${lens}`, (await page.locator('#river').getAttribute('data-lens')) === lens && (await page.locator('#legend span').count()) >= 5);
  }

  // 5. case file
  await page.locator('[data-card="ranulph"]').click();
  await page.waitForTimeout(800);
  check('a case card lights the people it bears on', (await page.locator('.p.lit').count()) >= 5 && (await page.locator('.card.on .who [data-go]').count()) >= 5);
  check('the cut-off family is drawn', (await page.locator('.oxbow-mark').count()) >= 1 && (await page.locator('.severed').count()) >= 1);
  check('head of proof is flagged', (await page.locator('.proofhead').count()) === 1 && /generations/.test(await page.locator('.proofline').textContent()));

  // 6. leads and lines
  await page.locator('.tabs [data-tab="leads"]').click();
  const nLeads = await page.locator('[data-lead]').count();
  await page.locator('[data-lead]').first().click();
  check('leads are listed and light people', nLeads >= 5 && (await page.locator('.p.lit').count()) >= 1, `${nLeads} leads`);
  check('facts are computed and listed', (await page.locator('[data-lead^="fact:"]').count()) >= 5);
  await page.locator('#help').click();
  check('the reading guide opens', /How to read the river/.test(await page.locator('#record h2').textContent()));
  await page.locator('#record [data-act="back"]').click();
  await page.locator('.tabs [data-tab="lines"]').click();
  check('all seven lines have a card', (await page.locator('[data-line]').count()) === 7);
  await page.locator('[data-line="Finch"]').click();
  check('a line card lights its stream', (await page.locator('.p.lit').count()) > 10);

  // 7. search, with diacritics folded
  await page.locator('#search').fill('koziel');
  check('search folds diacritics', (await page.locator('#results li[data-id]').count()) >= 1);
  await page.locator('#search').fill('peter barlow');
  await page.keyboard.press('Enter');
  check('search selects a person', /Peter/.test(await page.locator('#record h2').textContent()));

  // 8. add a piece of evidence (draft only)
  await page.locator('#record [data-act="compose"]').click();
  await page.locator('#record [name="title"]').fill('Smoke test evidence');
  await page.locator('#record [name="source"]').fill('Test register');
  await page.locator('#record [name="link"]').selectOption('dispute');
  await page.locator('#record [data-act="savedraft"]').click();
  check('a draft card is saved', (await page.locator('.chip.draft').count()) === 1);
  await page.locator('[data-edit]').click();
  check('a draft can be edited', (await page.locator('#record [name="title"]').inputValue()) === 'Smoke test evidence');
  await page.locator('#record [name="title"]').fill('Smoke test evidence, edited');
  await page.locator('#record [data-act="savedraft"]').click();
  check('the edit replaces the draft', (await page.locator('.chip.draft').count()) === 1 && /edited/.test(await page.locator('.card.on .t').textContent()));
  const req = await page.evaluate(() => { const b = document.querySelector('[data-copy]'); return b ? true : false; });
  check('a change request can be copied', req);
  await page.locator('[data-del]').click();
  check('a draft can be deleted', (await page.locator('.chip.draft').count()) === 0);

  // 9. privacy in the page itself
  const leak = await page.evaluate(async () => {
    const d = await (await fetch('./data/river.json')).json();
    const living = d.people.filter((p) => p.living);
    return { n: living.length, keys: [...new Set(living.flatMap((p) => Object.keys(p)))].sort().join(',') };
  });
  check('living people carry no personal fields', leak.keys === 'estY,fams,id,living,parents', `${leak.n} living: ${leak.keys}`);
  await page.close();

  // photos: the sandbox blocks the image host, so serve a stand-in and check both paths
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/res.cloudinary.com/**', (r) => r.abort());
  await page.goto(url + '#p=I11'); await page.waitForSelector('#record h2'); await page.waitForTimeout(500);
  check('a missing photo falls back to an initial', (await page.locator('#record .avatar').count()) === 1);
  await page.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  let asked = '';
  await page.route('**/res.cloudinary.com/**', (r) => { asked = r.request().url(); r.fulfill({ status: 200, contentType: 'image/png', body: png }); });
  await page.goto(url + '#p=I11'); await page.waitForSelector('#record img');
  await page.waitForTimeout(400);
  check('a photo is shown when the image host answers (stand-in)', (await page.locator('#record img').count()) === 1 && /c_thumb,g_face/.test(asked), asked.slice(0, 70));
  await page.close();

  // the real image host, when this machine can reach it
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url + '#p=I11'); await page.waitForSelector('#app:not(.loading)'); await page.waitForTimeout(2500);
  const real = await page.evaluate(() => { const i = document.querySelector('#record img'); return i ? i.naturalWidth : 0; });
  if (real) check('a real photo loads from the image host', real >= 64, `${real}px wide`);
  else console.log('skip real photo: the image host is not reachable from here');
  await page.close();

  page = await open('#f=fact:largest');
  await page.waitForTimeout(500);
  check('a finding can be linked to', (await page.locator('.card.on[data-lead="fact:largest"]').count()) === 1 && (await page.locator('.p.lit').count()) >= 10);
  await page.close();
  page = await open('#line=Finch');
  await page.waitForTimeout(500);
  check('a line can be linked to', (await page.locator('.linecard.on[data-line="Finch"]').count()) === 1);
  await page.close();

  // narrow desktop: nobody sits under the legend
  page = await open('#y=2026', { width: 1024, height: 768 });
  await page.waitForTimeout(600);
  const under = await page.evaluate(() => {
    const l = document.querySelector('#legend').getBoundingClientRect();
    return [...document.querySelectorAll('.p:not(.unborn) .dot')].filter((d) => { const r = d.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return x > l.left && x < l.right && y > l.top && y < l.bottom; }).length;
  });
  check('1024 wide: the legend covers nobody', under === 0, `${under} under`);
  await page.close();

  // 10. deep link and phone layout
  page = await open('#y=1776&p=I11&lens=place', { width: 390, height: 800 });
  check('deep link restores year, lens and person', (await year(page)) === 1776 && (await page.locator('#river').getAttribute('data-lens')) === 'place' && (await page.locator('#record h2').textContent()) === 'Peter Barlow');
  check('phone: panel is a sheet and opens', await page.locator('#panel.open').count() === 1);
  await page.locator('#record [data-act="back"]').click();
  await page.locator('#play').click();
  const tx0 = await page.evaluate(() => window.__river.river.tx);
  await page.waitForTimeout(1800);
  check('phone: the camera travels with the year', (await page.evaluate(() => window.__river.river.tx)) < tx0);
  check('phone: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.close();

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  server?.kill();
  process.exit(failed ? 1 : 0);
})();
