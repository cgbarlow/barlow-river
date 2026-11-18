// Usage: npm run atlas
// Reads the published public/data/river.json and writes public/data/atlas.json.
// It never reads the raw export, so it cannot publish what the River does not.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildAtlas } from '../pipeline/atlas.ts';

const river = JSON.parse(readFileSync('public/data/river.json', 'utf8'));
const { atlas, unmapped } = buildAtlas(river);
if (unmapped.length) { console.error('Places not in the gazetteer (add them to pipeline/gazetteer.ts):\n  ' + unmapped.join('\n  ')); process.exit(1); }
writeFileSync('public/data/atlas.json', JSON.stringify(atlas));
const c = atlas.meta.counts;
console.log(`atlas.json: ${c.recorded} placed by record, ${c.borrowed} with a relative, ${c.unplaced} unplaced, ${c.places} places, ${c.moves} moves`);
