# Council report: the Atlas, round 10

Subject: the fourth full outside test in a row (commit `149aa64`, a fresh tester), and what was done.

## What the tester found

Verdict on `149aa64`: **no**, on two points.

- The owner's four requests: met. The fourth, a remnant after a light goes out, "yes, but faint".
- Rules A1 to A10, by the tester's own checker: **no violations** in 437 paused years and 9,881 play frames. One false sentence under A9.
- All sixteen points from round 9: fifteen fixed, one unchanged ("Lost a father at about 11", hedged and not false).
- Every count the tester could recount matched.
- Scores: 26.5 of 35 overall, 28 as a build.

Blocking:
1. **D1, a real bug.** Play for a while, press Home, and the globe goes blank for good. The first two years have no light; the camera then worked out a centre from an empty list and got not-a-number.
2. **D2.** One finding still ended "The tree does not name a ship."

Minor: a solid line resting on a country-only record (D3); three rings outside the area the death record names (D4); remnants faint, and counted on the last frame only for countries out of view (D8); a label collision on a phone (D6).

## The Council

**Cat.** D1 is the first crash-class bug any tester has found, in round ten. It was reachable by one ordinary key. Our own checks never pressed Home after playing. Add that check, and guard the function itself, not only its one caller.

**Owl.** Two blockers, both small. Fix, add the checks, test again. Do not widen the round.

**Bear.** The owner asked for the remnant. "Barely readable on the globe" is not delivering it. Make the rings and embers bigger and stronger, and count them for every country on the last frame.

**Rabbit.** D4 is a fair catch. A death record that names only a country is still the last thing the records say. Put the ring there, not at the town before.

**Wolf.** D3 is the same lesson as last round: a country-only record does not date a departure from a town.

**Puppy.** Every recount matched. Fifteen of sixteen fixed. The camera crossed once, again.

**Simon.** Consensus: fix D1 to D4, D6 and D8, and test again from scratch. D5 (reading "with wife, 6 children" as placing seven more people) is an inference the Council will not make without the owner. D7 (stars over label ends) and the taste list stay.

## What was done

| # | Point | Fix |
|---|---|---|
| D1 | Globe blank after Home | With no light on its side the camera takes the home view; the centring function returns the current view for an empty list. A browser check plays, presses Home, and looks for a drawn globe and no errors. |
| D2 | "The tree does not name a ship" | "No ship is named for this crossing." |
| D3 | Solid line from a country-only record | A last record that names only the county or country does not date a departure: no travelling light, dashed line. |
| D4 | Rings outside the death record's area | The ring sits at the last place the records give, including a death record that names only a county or country. |
| D6 | Phone label collision on the last frame | Shorter label on a phone. |
| D8 | Remnants faint; counted only out of view | Rings and embers are larger and stronger. On the last frame every country chip counts what it remembers. |

92 unit tests, the River's 59 browser checks and the Atlas's 157 pass.

## Next

A full outside test of this commit by a fresh tester.
