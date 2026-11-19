# Council report: the Atlas, round 16

Subject: the tenth full outside test in a row (commit `6bdf92f`, a fresh tester), and what was done.

## What the tester found

Verdict on `6bdf92f`: **no**. "The drawing is rule-perfect." Two places still carried the same class of sentence.

- The owner's four requests: met.
- Rules A1 to A11: **no violations**, every year and a full play-through. 389 age and order sentences: none wrong. 81 of 81 "last known" sentences right. Every recount true.
- Every "the map reads…" sentence on the page is true.
- All six points from round 15 fixed, one partly.
- Scores: 28 of 35 overall and as a build.

Blocking:
- **N1.** Every hollow person's panel said "nothing says where X went" under a badge "No place of their own", unscoped. For one woman a citation names a burial transcript in another parish.
- **D1 residue.** The People tab was fixed last round; the Journeys box, the guide and the README still said eighteen people have "no one to borrow from". Two of them have parents on the map and are undrawn only because they were born and died within one year.

## The Council

**Cat.** Round 14 fixed the sentences the tester named. Round 15 fixed the one it missed. This round the tester found two more. The author has been fixing what was pointed at. The only way out is to read every sentence with a negative in it, all of them, before the next tester does.

**Owl.** That is a finite list. Dump every sentence on the page, keep the ones with "no", "not", "nothing", "nobody", "never", "none", "only", and read the templates. There are about 160.

**Rabbit.** Then make the automated check carry the patterns that were found.

**Wolf.** Ten testers. Blockers: ten, ten, five, two, four, one, one, one, one, two. Every one since round 10 has been wording. The map has had no rule violation in any of the ten.

**Simon.** Consensus as Cat and Owl say.

## What was done

The two named points:
- Hollow panels: "nothing the map reads says where X went". The badge, the tooltip and the Key say "Drawn with a relative".
- Journeys box, guide and README: "no such record, and no relative the map could draw them with while they were alive".

The author's own sweep of every negative sentence on the page (about 160 templates across 322 person panels, 73 place panels, six country panels, the guide, three tabs, 28 captions and 15 findings). Reworded as a result:
- "no closer place is given" on a record line is now "this record gives no closer place".
- "The only record that places X" is now "The only record the map reads that places X".
- Findings: "No one on the map is placed farther"; "More places than anyone else on the map"; "No record the map reads shows anyone coming back"; "As far as the map's records go, the voyage was one way."
- The last-light caption: "and by nothing the map reads since".
- The guide: an arrival is described as an event the tree dates, which is where the map reads it.

The automated sweep now also fails on "nothing says", "to borrow from", "no place of their own", "have no place" and "no one to".

94 unit tests, the River's 59 browser checks and the Atlas's 160 pass.

## Next

A full outside test of this commit by a fresh tester.
