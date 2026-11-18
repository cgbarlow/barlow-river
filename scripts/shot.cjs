// Dev helper: node scripts/shot.mjs <url-hash> <out.png> [width] [height] [js-to-eval]
const { chromium } = require('playwright');
(async () => {
const [hash = '', out = 'shot.png', w = '1440', h = '900', js = ''] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:5173/' + hash);
await p.waitForSelector('#app:not(.loading)', { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(900);
if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log(JSON.stringify(r)); await p.waitForTimeout(1100); }
await p.screenshot({ path: out });
if (errs.length) console.log('ERRORS', errs.slice(0, 8));
await b.close();
})();
