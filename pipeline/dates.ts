// GEDCOM-ish date parsing. Handles "4 APR 1736", "1871", "ABT JUN 1979",
// "21 MAR 1649/50" (Old Style / New Style dual year) and "22 Apr 1706".

export interface ParsedDate {
  /** Year used for positioning. For dual years this is the New Style year. */
  year: number;
  /** Human-readable form, e.g. "21 Mar 1649/50" or "c. Jun 1979". */
  text: string;
  /** True when the record itself is qualified (ABT, BEF, AFT, EST, CAL, c.). */
  approx: boolean;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const NICE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUAL: Record<string, string> = { ABT: 'c.', EST: 'c.', CAL: 'c.', BEF: 'before', AFT: 'after', CIRCA: 'c.', 'C.': 'c.', C: 'c.' };

export function parseDate(raw: unknown): ParsedDate | null {
  if (typeof raw !== 'string') return null;
  const tokens = raw.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let qual = '';
  let day = '';
  let month = -1;
  let year = 0;
  let dual = '';
  for (const t of tokens) {
    if (QUAL[t]) { qual = QUAL[t]; continue; }
    const m3 = MONTHS.indexOf(t.slice(0, 3));
    if (m3 >= 0 && /^[A-Z]+\.?$/.test(t)) { month = m3; continue; }
    const y = /^(\d{4})(?:\/(\d{1,2}))?$/.exec(t);
    if (y) {
      year = Number(y[1]);
      if (y[2]) { dual = y[2]; year += 1; }
      continue;
    }
    if (/^\d{1,2}$/.test(t) && !day) { day = String(Number(t)); continue; }
  }
  if (!year) return null;
  const yearText = dual ? `${year - 1}/${dual.padStart(2, '0')}` : String(year);
  const parts = [qual, day && month >= 0 ? day : '', month >= 0 ? NICE[month] : '', yearText].filter(Boolean);
  return { year, text: parts.join(' '), approx: Boolean(qual) };
}
