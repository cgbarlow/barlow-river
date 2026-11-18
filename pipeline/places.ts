// Free-text places grouped into the regions the tree actually lives in.

export const REGIONS = [
  'Norfolk', 'Suffolk', 'Kent', 'Cornwall', 'Staffordshire', 'London',
  'Elsewhere in England', 'New Zealand', 'Poland', 'Elsewhere',
] as const;
export type Region = (typeof REGIONS)[number];

const RULES: [RegExp, Region][] = [
  [/new zealand|\bn\.?z\.?\b|auckland|wellington|christchurch|wanganui|whanganui|pirongia|howick|waikato|lower hutt|carterton|wairarapa|otago|dunedin|canterbury, n|nelson|taranaki|napier|hawke|alexandra|hamilton|tauranga|invercargill|timaru|palmerston|masterton|thames|coromandel|onehunga|otahuhu|manukau|new plymouth|rotorua|gisborne|blenheim/i, 'New Zealand'],
  [/poland|polska|warsaw|warszawa|koszalin|brzeg|zamo[sś][cć]|szczecin|krak[oó]w|gda[nń]sk|wroc[lł]aw|pozna[nń]|lublin|[lł][oó]d[zź]|opole|kielce/i, 'Poland'],
  [/norfolk|norwich|shipdham|dereham|yarmouth|king'?s lynn|thetford|wymondham|aylsham|swaffham/i, 'Norfolk'],
  [/suffolk|ipswich|sproughton|harkstead|clopton|westerfield|woodbridge|burgh/i, 'Suffolk'],
  [/\bkent\b|woolwich|bexley|charlton|greenwich|deptford|plumstead|maidstone|canterbury|chatham|gravesend|dartford|rochester/i, 'Kent'],
  [/cornwall|truro|penzance|redruth|falmouth|bodmin|st\.? austell|camborne|helston|launceston/i, 'Cornwall'],
  [/stafford|mucklestone|betley|stoke|newcastle-under/i, 'Staffordshire'],
  [/london|middlesex|hackney|westminster|southwark|streatham|surrey|lambeth|islington|stepney/i, 'London'],
  [/england|shire\b|sussex|dorset|essex|devon|somerset|hampshire|birmingham|ludlow|chichester|leominster|\buk\b|united kingdom|wales|scotland/i, 'Elsewhere in England'],
];

export function regionOf(place: string | null | undefined): Region | null {
  if (!place) return null;
  for (const [re, region] of RULES) if (re.test(place)) return region;
  return 'Elsewhere';
}

/** Tidy a place for display: collapse spaces, drop trailing doubts kept in the raw record. */
export function tidyPlace(place: string | null | undefined): string | null {
  if (!place) return null;
  return place.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim() || null;
}
