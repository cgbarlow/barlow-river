# Council report: the Atlas, round 15

Subject: the ninth full outside test in a row (commit `f6e8aff`, a fresh tester), and what was done.

## What the tester found

Verdict on `f6e8aff`: **no, but only narrowly.** One sentence.

- The owner's four requests: met.
- Rules A1 to A11, every person in every year and 5,351 frames of a full play: **no violations**. 412 age and order sentences recomputed: none wrong. All 124 place strings checked by hand.
- Every "the map reads no…" sentence on the page is true.
- All five points from round 14 fixed or, for one, partly.
- Scores: 28 of 35 overall, 28.5 as a build.

Blocking:
- **D1.** The People tab said "18 people have no placed record and no close relative with one." Three of the eighteen do have a close relative on the map; they are unplaced because no loan could start while they were alive. The guide's own wording was right; the tab's was not.

Minor: one unscoped "Where no death is recorded" in the Journeys box; the guide's list of what makes a solid light left out deaths and dated events; the guide gave the wrong reason for Poland being dark; the camera did not go back to the family after Esc; the Ireland chip off-screen on a phone on the last frame.

## The Council

**Cat.** The sweep check added last round read the panels, captions, findings and guide. It did not read the three tabs. The sentence was in a tab. Extend the check to the tabs.

**Owl.** One line, plus the four minors that are one line each.

**Wolf.** Nine testers; blockers ten, ten, five, two, four, one, one, one, one. The last four were a sentence each.

**Simon.** Consensus as Owl says.

## What was done

| Point | Fix |
|---|---|
| D1 | "…have none of the dated, placed records the map reads, and no close relative it could draw them with while they were alive." |
| Journeys box | "Where the map reads no dated death…" |
| Solid light list | Adds deaths, dated events and arrivals. |
| Poland in the guide | "…living, or have dates but no placed record the map reads." |
| Camera after Esc | Goes back to following the family. |
| Last-frame chips on a phone | Shorter label, so every country fits. |
| Sweep check | Now reads the three tabs as well. |
| Key handler | A key event whose target is the document no longer throws. |

94 unit tests, the River's 59 browser checks and the Atlas's 160 pass.

## Next

A full outside test of this commit by a fresh tester.
