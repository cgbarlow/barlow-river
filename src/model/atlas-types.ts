// Shape of public/data/atlas.json. Built by pipeline/atlas.ts from the already
// privacy-filtered river data, so it can hold nothing the River does not publish.
// Only deceased people appear. No raw place strings: every place is a gazetteer entry.

import type { Lead } from './types.ts';

/** How closely a place is known. Area is a county or region. */
export type Precision = 'parish' | 'town' | 'area' | 'country';

export interface AtlasPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  prec: Precision;
  country: string;
  /** the River's region, for the place lens */
  region: string;
  /** the town this place sits in, used for anyone who died after 1950 */
  town?: string;
}

export type StopKind = 'birth' | 'baptism' | 'marriage' | 'child' | 'census' | 'event' | 'death' | 'burial' | 'borrowed';

export interface AtlasStop {
  y: number;
  /** place id */
  p: string;
  kind: StopKind;
  /** the evidence in a few words: "born", "census", "birth of Annie" */
  why: string;
  /** the year is estimated, not recorded */
  est?: boolean;
  /** whether this record is this person at all is disputed: the words from the tree */
  doubt?: string;
  /** vaguer than another stop that already covers it; listed, not drawn */
  coarse?: boolean;
}

export interface AtlasPerson {
  id: string;
  stops: AtlasStop[];
  /** no place of their own: shown hollow where a close relative was */
  borrowed?: { from: string; how: 'parent' | 'partner' | 'sibling' | 'child' };
}

export interface AtlasData {
  meta: {
    counts: { deceased: number; recorded: number; borrowed: number; unplaced: number; living: number; places: number; moves: number };
  };
  places: AtlasPlace[];
  people: AtlasPerson[];
  /** deceased people with no place at all, and none to borrow */
  unplaced: string[];
  facts: Lead[];
  leads: Lead[];
}
