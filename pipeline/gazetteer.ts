// Every place in the tree, placed by hand. No geocoding service is used, so no
// family data leaves the build. Coordinates are to about a kilometre.
//
// A place string from the tree is matched against RULES in order, most specific
// first. A string that matches nothing and is not in IGNORE fails the tests.

import type { AtlasPlace, Precision } from '../src/model/atlas-types.ts';

type Row = [id: string, name: string, lat: number, lon: number, prec: Precision, country: string, region: string, town?: string];

const ROWS: Row[] = [
  // Norfolk
  ['norwich', 'Norwich, Norfolk', 52.630, 1.297, 'town', 'England', 'Norfolk'],
  ['norwich-st-augustine', 'St Augustine, Norwich', 52.6369, 1.2915, 'parish', 'England', 'Norfolk', 'norwich'],
  ['norwich-st-benedict', 'St Benedict, Norwich', 52.6312, 1.2877, 'parish', 'England', 'Norfolk', 'norwich'],
  ['norwich-st-etheldreda', 'St Etheldreda, Norwich', 52.6243, 1.2997, 'parish', 'England', 'Norfolk', 'norwich'],
  ['norwich-st-stephen', 'St Stephen, Norwich', 52.6262, 1.2915, 'parish', 'England', 'Norfolk', 'norwich'],
  ['norwich-st-clement', 'St Clement, Norwich', 52.6335, 1.2960, 'parish', 'England', 'Norfolk', 'norwich'],
  ['norwich-st-simon', 'St Simon and St Jude, Norwich', 52.6322, 1.2985, 'parish', 'England', 'Norfolk', 'norwich'],
  ['shipdham', 'Shipdham, Norfolk', 52.628, 0.890, 'town', 'England', 'Norfolk'],
  ['yaxham', 'Yaxham, Norfolk', 52.655, 0.964, 'town', 'England', 'Norfolk'],
  ['elsing', 'Elsing, Norfolk', 52.707, 1.037, 'town', 'England', 'Norfolk'],
  ['westfield', 'Westfield, Norfolk', 52.653, 0.905, 'town', 'England', 'Norfolk'],
  ['easton', 'Easton, Norfolk', 52.652, 1.160, 'town', 'England', 'Norfolk'],
  ['holme-hale', 'Holme Hale, Norfolk', 52.630, 0.790, 'town', 'England', 'Norfolk'],
  ['crownthorpe', 'Crownthorpe, Norfolk', 52.590, 1.060, 'town', 'England', 'Norfolk'],
  ['wymondham', 'Wymondham, Norfolk', 52.570, 1.116, 'town', 'England', 'Norfolk'],
  ['dereham', 'East Dereham, Norfolk', 52.681, 0.940, 'town', 'England', 'Norfolk'],
  // Suffolk and Essex
  ['sproughton', 'Sproughton, Suffolk', 52.062, 1.094, 'town', 'England', 'Suffolk'],
  ['harkstead', 'Harkstead, Suffolk', 51.975, 1.181, 'town', 'England', 'Suffolk'],
  ['clopton', 'Clopton, Suffolk', 52.139, 1.253, 'town', 'England', 'Suffolk'],
  ['burgh', 'Burgh, Suffolk', 52.118, 1.262, 'town', 'England', 'Suffolk'],
  ['woodbridge', 'Woodbridge, Suffolk', 52.094, 1.320, 'town', 'England', 'Suffolk'],
  ['westerfield', 'Westerfield, Suffolk', 52.083, 1.168, 'town', 'England', 'Suffolk'],
  ['ipswich', 'Ipswich, Suffolk', 52.059, 1.155, 'town', 'England', 'Suffolk'],
  ['suffolk', 'Suffolk', 52.20, 1.00, 'area', 'England', 'Suffolk'],
  ['essex', 'Essex', 51.77, 0.56, 'area', 'England', 'Elsewhere in England'],
  // Kent and London
  ['woolwich', 'Woolwich, Kent', 51.490, 0.065, 'town', 'England', 'Kent'],
  ['bexley', 'Bexley, Kent', 51.441, 0.150, 'town', 'England', 'Kent'],
  ['kent', 'Kent', 51.25, 0.75, 'area', 'England', 'Kent'],
  ['london', 'London', 51.507, -0.128, 'town', 'England', 'London'],
  ['lambeth', 'Lambeth, London', 51.480, -0.117, 'town', 'England', 'London'],
  ['camberwell', 'Camberwell, London', 51.474, -0.093, 'town', 'England', 'London'],
  ['streatham', 'Streatham, Surrey', 51.428, -0.131, 'town', 'England', 'London'],
  // the rest of England
  ['derbyshire', 'Derbyshire', 53.13, -1.60, 'area', 'England', 'Elsewhere in England'],
  ['mucklestone', 'Mucklestone, Staffordshire', 52.938, -2.413, 'town', 'England', 'Staffordshire'],
  ['betley', 'Betley, Staffordshire', 53.034, -2.369, 'town', 'England', 'Staffordshire'],
  ['ludlow', 'Ludlow, Shropshire', 52.368, -2.718, 'town', 'England', 'Elsewhere in England'],
  ['wistanstow', 'Wistanstow, Shropshire', 52.465, -2.838, 'town', 'England', 'Elsewhere in England'],
  ['wem', 'Wem, Shropshire', 52.855, -2.725, 'town', 'England', 'Elsewhere in England'],
  ['leominster', 'Leominster, Herefordshire', 52.228, -2.739, 'town', 'England', 'Elsewhere in England'],
  ['birmingham', 'Birmingham, Warwickshire', 52.480, -1.903, 'town', 'England', 'Elsewhere in England'],
  ['chichester', 'Chichester, Sussex', 50.837, -0.780, 'town', 'England', 'Elsewhere in England'],
  ['leicestershire', 'Leicestershire', 52.70, -1.13, 'area', 'England', 'Elsewhere in England'],
  ['hampshire', 'Hampshire', 51.06, -1.31, 'area', 'England', 'Elsewhere in England'],
  ['northamptonshire', 'Northamptonshire', 52.27, -0.88, 'area', 'England', 'Elsewhere in England'],
  ['somerset', 'Somerset', 51.10, -2.90, 'area', 'England', 'Elsewhere in England'],
  ['thorncombe', 'Thorncombe, Dorset', 50.827, -2.889, 'town', 'England', 'Elsewhere in England'],
  ['kingswood', 'Kingswood, Wiltshire', 51.627, -2.368, 'town', 'England', 'Elsewhere in England'],
  ['cornwall', 'Cornwall', 50.40, -4.90, 'area', 'England', 'Cornwall'],
  ['st-martin-meneage', 'St Martin in Meneage, Cornwall', 50.066, -5.158, 'town', 'England', 'Cornwall'],
  ['mawgan-meneage', 'Mawgan in Meneage, Cornwall', 50.083, -5.200, 'town', 'England', 'Cornwall'],
  ['helston', 'Helston, Cornwall', 50.102, -5.275, 'town', 'England', 'Cornwall'],
  ['constantine', 'Constantine, Cornwall', 50.118, -5.176, 'town', 'England', 'Cornwall'],
  ['illogan', 'Illogan, Cornwall', 50.250, -5.268, 'town', 'England', 'Cornwall'],
  ['england', 'England', 52.60, -1.50, 'country', 'England', 'Elsewhere in England'],
  // Wales, Ireland, America
  ['gellifelen', 'Clydach Works, Llanelly, Breconshire', 51.807, -3.126, 'town', 'Wales', 'Elsewhere in England'],
  ['trevethin', 'Trevethin, Monmouthshire', 51.712, -3.045, 'town', 'Wales', 'Elsewhere in England'],
  ['ireland', 'Ireland', 53.30, -7.80, 'country', 'Ireland', 'Elsewhere'],
  ['new-york', 'New York', 40.71, -74.01, 'town', 'United States', 'Elsewhere'],
  // New Zealand
  ['christchurch', 'Christchurch', -43.532, 172.636, 'town', 'New Zealand', 'New Zealand'],
  ['linwood', 'Linwood, Christchurch', -43.534, 172.665, 'parish', 'New Zealand', 'New Zealand', 'christchurch'],
  ['bromley', 'Bromley, Christchurch', -43.537, 172.690, 'parish', 'New Zealand', 'New Zealand', 'christchurch'],
  ['wellington', 'Wellington', -41.287, 174.776, 'town', 'New Zealand', 'New Zealand'],
  ['carterton', 'Carterton, Wairarapa', -41.025, 175.527, 'town', 'New Zealand', 'New Zealand'],
  ['shannon', 'Shannon, Horowhenua', -40.550, 175.417, 'town', 'New Zealand', 'New Zealand'],
  ['wanganui', 'Whanganui', -39.930, 175.050, 'town', 'New Zealand', 'New Zealand'],
  ['hawera', 'Hāwera, Taranaki', -39.590, 174.283, 'town', 'New Zealand', 'New Zealand'],
  ['napier', 'Napier, Hawke’s Bay', -39.492, 176.912, 'town', 'New Zealand', 'New Zealand'],
  ['waipukurau', 'Waipukurau, Hawke’s Bay', -39.995, 176.555, 'town', 'New Zealand', 'New Zealand'],
  ['auckland', 'Auckland', -36.848, 174.763, 'town', 'New Zealand', 'New Zealand'],
  ['parnell', 'Parnell, Auckland', -36.855, 174.782, 'parish', 'New Zealand', 'New Zealand', 'auckland'],
  ['purewa', 'Purewa, Auckland', -36.870, 174.830, 'parish', 'New Zealand', 'New Zealand', 'auckland'],
  ['epsom', 'Epsom, Auckland', -36.888, 174.775, 'parish', 'New Zealand', 'New Zealand', 'auckland'],
  ['waikumete', 'Waikumete, Auckland', -36.905, 174.640, 'parish', 'New Zealand', 'New Zealand', 'auckland'],
  ['howick', 'Howick, Auckland', -36.894, 174.932, 'town', 'New Zealand', 'New Zealand'],
  ['tuakau', 'Tuakau, Waikato', -37.258, 174.947, 'town', 'New Zealand', 'New Zealand'],
  ['pirongia', 'Pirongia (then Alexandra), Waikato', -37.990, 175.203, 'town', 'New Zealand', 'New Zealand'],
  ['paterangi', 'Paterangi, Waikato', -37.950, 175.250, 'town', 'New Zealand', 'New Zealand'],
  ['te-awamutu', 'Te Awamutu, Waikato', -38.008, 175.325, 'town', 'New Zealand', 'New Zealand'],
  ['hamilton', 'Hamilton, Waikato', -37.787, 175.279, 'town', 'New Zealand', 'New Zealand'],
  ['paeroa', 'Paeroa, Hauraki', -37.380, 175.670, 'town', 'New Zealand', 'New Zealand'],
  ['northland', 'Northland', -35.60, 174.00, 'area', 'New Zealand', 'New Zealand'],
  ['new-zealand', 'New Zealand', -40.60, 175.60, 'country', 'New Zealand', 'New Zealand'],
  // Poland
  ['koszalin', 'Koszalin', 54.194, 16.172, 'town', 'Poland', 'Poland'],
  ['pulawy', 'Puławy', 51.416, 21.969, 'town', 'Poland', 'Poland'],
  ['przeworsk', 'Przeworsk', 50.059, 22.494, 'town', 'Poland', 'Poland'],
  ['zamosc', 'Zamość', 50.723, 23.252, 'town', 'Poland', 'Poland'],
  ['stalowa-wola', 'Stalowa Wola', 50.583, 22.054, 'town', 'Poland', 'Poland'],
  ['poland', 'Poland', 52.00, 19.40, 'country', 'Poland', 'Poland'],
];

export const PLACES: AtlasPlace[] = ROWS.map(([id, name, lat, lon, prec, country, region, town]) => ({ id, name, lat, lon, prec, country, region, ...(town ? { town } : {}) }));
export const PLACE = new Map(PLACES.map((p) => [p.id, p]));

/** Rough boxes, to catch a mistyped coordinate: [south, north, west, east]. */
export const COUNTRY_BOX: Record<string, [number, number, number, number]> = {
  England: [49.9, 55.9, -5.8, 1.8], Wales: [51.3, 53.5, -5.4, -2.6], Ireland: [51.3, 55.5, -10.6, -5.3],
  'United States': [24, 49.5, -125, -66], 'New Zealand': [-47.5, -34, 166, 179], Poland: [49, 55, 14, 24.2],
};

/** Not places. The GEDCOM carries occupations and schools in some place fields. */
export const IGNORE = [/^teacher$/i, /stonemason/i, /^law clerk$/i, /^gentleman$/i, /^beer seller$/i, /^normal school/i];

const RULES: [RegExp, string][] = [
  // Norwich parishes before Norwich
  [/st\.? augustine.*norwich/, 'norwich-st-augustine'], [/st\.? benedict.*norwich/, 'norwich-st-benedict'],
  [/st\.? etheldreda.*norwich/, 'norwich-st-etheldreda'], [/st\.? stephen.*norwich/, 'norwich-st-stephen'],
  [/st\.? clement.*norwich/, 'norwich-st-clement'], [/st\.? simon/, 'norwich-st-simon'],
  [/norwich/, 'norwich'], [/shipdham/, 'shipdham'], [/yaxham/, 'yaxham'], [/elsing/, 'elsing'], [/westfield, norfolk/, 'westfield'],
  [/easton, norfolk/, 'easton'], [/holme hale/, 'holme-hale'], [/crownthorpe/, 'crownthorpe'], [/wymondham/, 'wymondham'], [/dereham/, 'dereham'],
  [/sproughton/, 'sproughton'], [/harkstead/, 'harkstead'], [/clopton/, 'clopton'], [/burgh, suffolk/, 'burgh'], [/woodbridge/, 'woodbridge'],
  [/westerfield/, 'westerfield'], [/ipswich/, 'ipswich'], [/suffolk/, 'suffolk'], [/essex/, 'essex'],
  // New Zealand before England: "Canterbury", "Alexandra" and "Hamilton" exist in both worlds
  [/linwood/, 'linwood'], [/bromley, christchurch/, 'bromley'], [/christchurch/, 'christchurch'],
  [/carterton/, 'carterton'], [/shannon/, 'shannon'], [/w(h)?anganui/, 'wanganui'], [/hawera/, 'hawera'],
  [/waipuk/, 'waipukurau'], [/napier/, 'napier'], [/wellington/, 'wellington'],
  [/parnell/, 'parnell'], [/purewa/, 'purewa'], [/epsom, auckland/, 'epsom'], [/waikumete/, 'waikumete'], [/howick/, 'howick'], [/tuakau/, 'tuakau'],
  // Alexandra in the Waikato was renamed Pirongia in 1896. The records use both for one place.
  [/pirongia|^alexandra\b/, 'pirongia'], [/paterangi/, 'paterangi'], [/te awamutu/, 'te-awamutu'], [/hamilton/, 'hamilton'], [/paeroa/, 'paeroa'],
  [/northland/, 'northland'], [/auckland/, 'auckland'], [/new zealand|\bn\.?z\.?$/, 'new-zealand'],
  // Poland
  [/koszalin/, 'koszalin'], [/pulawy/, 'pulawy'], [/przeworsk/, 'przeworsk'], [/zamosc/, 'zamosc'], [/stalowa wola/, 'stalowa-wola'], [/poland|polska/, 'poland'],
  // London and Kent
  [/woolwich/, 'woolwich'], [/bexley/, 'bexley'], [/lambeth|stockwell|kenni(ng|gt)/, 'lambeth'], [/camberwell/, 'camberwell'], [/streatham/, 'streatham'],
  [/london/, 'london'], [/\bkent\b/, 'kent'],
  // the rest
  [/mucklestone/, 'mucklestone'], [/betley/, 'betley'], [/ludlow|gaolford|goulford|stanton lacy/, 'ludlow'], [/wistans(l|t)ow/, 'wistanstow'], [/\bwem\b/, 'wem'],
  [/leominster/, 'leominster'], [/birmingham/, 'birmingham'], [/chichester/, 'chichester'], [/thorncombe/, 'thorncombe'], [/kingswood/, 'kingswood'],
  [/st\.? martin in meneage/, 'st-martin-meneage'], [/mawgan in meneage/, 'mawgan-meneage'], [/helston/, 'helston'], [/constantine/, 'constantine'], [/illogan/, 'illogan'],
  [/gellifelen|llanelly/, 'gellifelen'], [/trevethin/, 'trevethin'],
  [/derbyshire/, 'derbyshire'], [/leicestershire/, 'leicestershire'], [/hampshire/, 'hampshire'], [/northamptonshire/, 'northamptonshire'], [/somerset/, 'somerset'], [/cornwall/, 'cornwall'],
  [/new york/, 'new-york'], [/ireland/, 'ireland'],
  [/england|united kingdom/, 'england'],
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().replace(/\s+/g, ' ').trim();

/** The gazetteer entry for a place string from the tree, 'ignore' for a known non-place, or null when it is new. */
export function locate(raw: string | null | undefined): AtlasPlace | 'ignore' | null {
  if (!raw) return null;
  if (IGNORE.some((re) => re.test(raw.trim()))) return 'ignore';
  const f = fold(raw);
  for (const [re, id] of RULES) if (re.test(f)) return PLACE.get(id)!;
  return null;
}
