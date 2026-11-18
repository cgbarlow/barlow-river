// End-to-end smoke test. Start the site first (npm run dev, or npm run preview),
// then: npm run smoke [-- http://localhost:5173/]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:5173/';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`); };

(async () => {
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
  check('follow the water draws a pulse', await page.evaluate(() => getComputedStyle(document.querySelector('.pulse')).display !== 'none'));
  await page.keyboard.press(' ');
  await page.locator('#record [data-go]').first().click();
  check('family chips navigate', (await page.locator('#record h2').textContent()) !== '');
  await page.locator('#record [data-act="back"]').click();
  check('back closes the record', await page.locator('#record').isHidden());

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
  process.exit(failed ? 1 : 0);
})();
