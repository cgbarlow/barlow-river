// Usage: npm run data [-- path/to/iris-export.json]
// Reads an Iris export_set JSON (never committed) and writes public/data/river.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildRiver } from '../pipeline/build.ts';

const src = process.argv[2] ?? 'data/raw/iris-export.json';
const exp = JSON.parse(readFileSync(src, 'utf8'));
const river = buildRiver(exp.result && typeof exp.result === 'string' ? JSON.parse(exp.result) : exp);
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/river.json', JSON.stringify(river));
const c = river.meta.counts;
console.log(`river.json: ${c.people} people (${c.deceased} shown, ${c.living} private), ${c.families} families, ${river.leads.length} leads`);
