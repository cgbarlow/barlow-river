// The open case. Curated from the Iris document "Hypothesis: the original Barlow
// village" (last reviewed there 13 October 2026). People are referenced by the
// ids in river.json; a card whose people are missing still renders.

export type Status = 'ruledout' | 'doubt' | 'proven' | 'open';
export const STATUS_LABEL: Record<Status, string> = { ruledout: 'Ruled out', doubt: 'In doubt', proven: 'Proven', open: 'Open' };

export interface EvidenceCard {
  id: string;
  status: Status;
  title: string;
  body: string;
  /** the record the card rests on */
  source?: string;
  people: string[];
  /** year to move the river to */
  year: number;
  draft?: boolean;
  link?: string;
}

export const CASE = {
  question: 'Where did the Norwich Barlows come from?',
  summary:
    'Barlow is a place name. Somebody took it from a village called Barlow, and no Barlow is anywhere near Norwich. The candidates are Barlow in Derbyshire and Barlow near Manchester. Before either can be tested, the line has to be proved back to Staffordshire, and at the moment it is not.',
  reviewed: '13 October 2026',
  irisDoc: 'https://iris-uat.chrisbarlow.nz/views/5ec00491-e3cc-4173-8f28-7f2593953c8d',
};

export const CARDS: EvidenceCard[] = [
  {
    id: 'three-peters', status: 'proven', year: 1745,
    title: 'Three sons named Peter',
    body: 'Peter Barlow and Judith Din baptised three sons Peter at St Augustine, Norwich: 1736, 1738 and 1745. The first was buried on 10 June 1738, three months before the second was baptised. Giving a dead child’s name to the next was normal.',
    source: 'FreeREG, St Augustine, Norwich: baptisms and burials',
    people: ['I900123', 'I900005', 'I900125', 'I900003', 'I900004'],
  },
  {
    id: 'which-peter', status: 'doubt', year: 1776,
    title: 'Which Peter was the mathematician’s father?',
    body: 'A Peter Barlow married Catherine Blomfield on 1 January 1774 and is named as father at the 1776 baptism of Peter the mathematician. He is taken to be the Peter of 1738. But a third Peter in 1745 suggests the 1738 boy may also have died, in which case the father is the 1745 Peter. Either way the line runs through Peter and Judith. A Norwich burial for a Peter Barlow between 1738 and 1750 would settle it.',
    source: 'FreeREG, St Clement, Norwich marriages; Non-Conformist Record Indexes (RG4-8)',
    people: ['I900005', 'I900125', 'I11', 'I900006'],
  },
  {
    id: 'weaver', status: 'proven', year: 1707,
    title: 'John the worsted weaver',
    body: 'John Barlow, worsted weaver of Norwich, married Mirabella in 1705. Their son Peter was christened on 6 October 1707 at St Stephen. From here down to the present every step has a record.',
    source: 'FamilySearch indexed christenings and marriages; FreeREG',
    people: ['I900001', 'I900002', 'I900003'],
  },
  {
    id: 'noah-john', status: 'doubt', year: 1686,
    title: 'Is the weaver Noah’s son?',
    body: 'Noah Barlow and Eamy had a son John christened in 1686. John the weaver married in 1705. That the two Johns are one man is a hypothesis: right name, right city, right age, and nothing that says so. A freeman or apprenticeship entry for John the weaver would name his father.',
    source: 'Norwich freemen and apprenticeship records, c.1695 to 1710, not yet searched',
    people: ['I900001', 'I900102', 'I900101'],
  },
  {
    id: 'noah', status: 'proven', year: 1654,
    title: 'Noah, baptised in Norwich, 1654',
    body: 'Noah was baptised on 25 August 1654 at St Benedict, Norwich, son of Francis Barlow. This is the oldest Norwich record for the family.',
    source: 'FreeREG, St Benedict, Norwich baptisms',
    people: ['I900102', 'I900104'],
  },
  {
    id: 'oliva', status: 'proven', year: 1664,
    title: 'Francis’s wife was Oliva, not Sarah',
    body: 'St Benedict baptisms name the mother: Francis, son of Francis and Ollie, 1662; Rebeccah, daughter of Francis and Oliva, 1664. The London marriage to Sarah Plantine in 1655 comes only from a compiled tree and is later than Noah’s baptism. Sarah was detached from the family. She now sits beside the river, unconnected.',
    source: 'FreeREG, St Benedict, Norwich baptisms',
    people: ['I900132', 'I900104', 'I900130', 'I900133', 'I900105'],
  },
  {
    id: 'staffordshire', status: 'doubt', year: 1654,
    title: 'The Staffordshire link',
    body: 'The compiled tree says the Norwich Francis is the Francis baptised at Mucklestone, Staffordshire in 1638/9, son of Hugh. That boy would have been 15 when Noah was baptised. Two or more men have probably been merged. Until a record ties the Norwich Francis to Staffordshire, everything upstream of him is unproven for this family.',
    source: 'FreeREG, Mucklestone baptisms; FamilySearch Family Tree',
    people: ['I900104', 'I900106', 'I900107', 'I900102'],
  },
  {
    id: 'ranulph', status: 'ruledout', year: 1640,
    title: 'Hugh as Ranulph’s son',
    body: 'Ranulph Barlow of Betley, bricklayer, lived in the next parish and was the right age to be Hugh’s father. His will, proved 5 March 1639/40, leaves twelve pence each to five named children as their “full and whole child’s part”: Roger, William, Elizabeth, Dorothy and Margery. Hugh was alive and is not named. The link was removed from the tree. Ranulph’s family is the cut-off water above the river.',
    source: 'Will of Randull Barlowe of Betley, 1639/40. Staffordshire Record Office B/C/11',
    people: ['I900113', 'I900106', 'I900135', 'I900109', 'I900112', 'I900136', 'I900137', 'I900138', 'I900114'],
  },
  {
    id: 'origin', status: 'open', year: 1613,
    title: 'Before Hugh: three possible sources',
    body: 'Hugh’s parents are unknown. Mucklestone is about 30 miles from Barlow in Derbyshire and 35 from Barlow Hall near Manchester, so the map does not choose. The name is most common in Cheshire, which Mucklestone borders, and that leans slightly north-west. A local Staffordshire line, kin to the Betley Barlows, is the third possibility.',
    source: '1881 census surname distribution; parish geography',
    people: ['I900106'],
  },
];

/** Doubts about which of two people, where either answer keeps the line intact. */
export const SOFT_BREAKS = ['I900005'];

export const TESTS: { text: string; done?: boolean }[] = [
  { text: 'Tie the Norwich Francis to Staffordshire: his marriage to Oliva, his burial, or a freeman entry naming where he came from.' },
  { text: 'Read Ranulph Barlow’s will.', done: true },
  { text: 'Confirm Noah to John: Norwich freemen and apprenticeship records, c.1695 to 1710.' },
  { text: 'Find Hugh’s own baptism (c.1610 to 1616) or marriage in Mucklestone and the parishes around it.' },
  { text: 'Check whether the Mucklestone register survives for 1598 to 1620. The gap may be transcription, not loss.' },
  { text: 'Y-DNA: a direct male Barlow tested against a Barlow surname project.' },
];

/** The three guesses at where the water rises. Drawn as ghost headwaters. */
export const HEADWATERS = [
  { name: 'Barlow, Derbyshire?', note: 'Old landed family of the name. About 30 miles from Mucklestone.' },
  { name: 'Barlow, Lancashire?', note: 'Largest and oldest Barlow family. The name is most common in Cheshire, next door.' },
  { name: 'A Staffordshire line?', note: 'Barlows in neighbouring Betley from the 1590s. Possibly kin.' },
];

/** Captions shown as the year passes. Kept few. */
export const BEATS: { y: number; text: string }[] = [
  { y: 1613, text: 'Hugh Barlow is born around now in Mucklestone, Staffordshire. Whether he is ours is the open case.' },
  { y: 1640, text: 'Ranulph Barlow’s will is proved at Lichfield. It names five children. No Hugh.' },
  { y: 1654, text: 'Noah Barlow is baptised at St Benedict, Norwich. The family’s first Norwich record.' },
  { y: 1705, text: 'John Barlow, worsted weaver, marries Mirabella. From here down, the line holds.' },
  { y: 1738, text: 'A Peter is buried in June. Another Peter is baptised in September.' },
  { y: 1776, text: 'Peter Barlow is born in Norwich. He will become a mathematician at Woolwich.' },
];
