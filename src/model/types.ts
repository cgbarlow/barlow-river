// Shape of public/data/river.json. Built by pipeline/build.ts.
// Living people carry NOTHING but an opaque id, their links and a structural
// position estimate. No name, date, sex, surname, place or text.

export type Tier = 'record' | 'compiled' | 'none' | 'doubt' | 'disputed' | 'ruledout';

export interface DateInfo {
  y: number;
  text: string;
  /** qualified in the record itself (c., before, after) */
  approx?: boolean;
  /** not in the record at all: estimated from relatives */
  est?: boolean;
  /** 'bap' when the date is a baptism or christening, 'bur' for a burial */
  kind?: 'bap' | 'bur';
  place?: string;
}

export interface Citation { source: string; detail?: string; url?: string }
export interface LifeEvent { tag: string; label: string; date?: string; y?: number; place?: string; value?: string; note?: string }

export interface Person {
  id: string;
  living: boolean;
  /** family id where this person is a child */
  parents?: string;
  /** family ids where this person is a partner */
  fams: string[];
  /** structural year estimate used to place the living (never a real date) */
  estY?: number;
  // ---- deceased only below ----
  name?: string;
  given?: string;
  surname?: string;
  married?: string[];
  sex?: 'M' | 'F' | 'U';
  b?: DateInfo;
  d?: DateInfo;
  region?: string;
  regionInferred?: boolean;
  /** certainty of the link up to the parents */
  tier?: Tier;
  /** the words in the record that set the tier */
  tierWhy?: string;
  /** how well the person themself is sourced */
  sourced?: 'record' | 'compiled' | 'none';
  desc?: string;
  occupation?: string;
  photo?: string;
  cites?: Citation[];
  notes?: string[];
  events?: LifeEvent[];
  variants?: string[];
  iris?: string;
}

export interface Family {
  id: string;
  partners: string[];
  children: string[];
  m?: DateInfo;
  /** structural estimate for families with a living partner or no date */
  estY: number;
  note?: string;
}

export interface Lead {
  id: string;
  kind: string;
  title: string;
  body: string;
  people: string[];
  y: number;
}

export interface RiverData {
  meta: {
    exportedAt: string;
    set: string;
    counts: { people: number; living: number; deceased: number; families: number; sources: number };
    thisYear: number;
  };
  people: Person[];
  families: Family[];
  leads: Lead[];
  /** things the tree shows when you count: not problems, just facts */
  facts: Lead[];
}
