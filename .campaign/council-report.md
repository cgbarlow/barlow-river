# Council report: the Atlas, round 11

Subject: the fifth full outside test in a row (commit `196551f`, a fresh tester on a different model), and what was done.

## What the tester found

Verdict on `196551f`: **no**, on four points, all false statements or breaches of the page's own stated rules. None is a crash.

- The owner's four requests: met. The remnant "with a reservation": on the last frame the globe stands so far back that the marks are small.
- The globe-blanking bug: fixed, across 49 scenarios. No console error in any run.
- Rules A1 to A9 by the tester's checker: no violations. A10 broken for one person.
- Everything from round 10 fixed or mostly fixed.
- Scores: 28.5 of 35 overall, 28 as a build.

Blocking:
1. **N1.** William Barlow (1606) shown "born" at Mucklestone. His record says Betley, a baptism, with Mucklestone only in a note about doubt. The place matcher read the note.
2. **N2.** Once a long-gap move was over, its line was drawn solid. The Key says solid means known to within three years. 59 of 78 solid lines in 1950 were not.
3. **N3.** "No closer place is given" was false for three records that name a village (Milton, Gratton, Harton) the map could not place.
4. **N4.** A move's window opened at a record naming only the country or county, making it too narrow ("Last known in New Zealand in 1888 … those 2 years" for a man last placed in Auckland in 1883).

## The Council

**Cat.** N2 is the largest thing any tester has found since round 7 and it was in plain sight: most of the long lines on the map contradicted the Key. Five testers looked at the same lines. The lesson is to test the Key against the drawing, not only the drawing against the data.

**Owl.** Four fixes, each one place in the code. N1 is an ordering of two patterns. N2 is one condition. N3 is carrying the village name through. N4 is where the window opens.

**Rabbit.** For N3, do not guess where Gratton or Harton is. Carry the name the record gives and say the map could not place it.

**Bear.** The last frame is the owner's remnant in its final form and the tester calls it small. That is taste and it is the owner's to call; list it for him.

**Wolf.** The owner has said he hopes this is the last round. He should get the truth: five testers, five "no", each on fewer and smaller points, and no rule violation in any.

**Puppy.** D1 held under 49 attempts to break it.

**Simon.** Consensus: fix the four, add a test for each, and test again. Report the trend to the owner plainly and let him decide when it is enough.

## What was done

| # | Point | Fix |
|---|---|---|
| N1 | Betley record placed at Mucklestone as a birth | A place string that begins "Betley" is Betley; a record marked as a baptism is shown as one. |
| N2 | Long-gap lines solid once over | They stay dashed. Only a move known to within three years is solid. |
| N3 | "No closer place is given" where a village is named | The stop carries the village name; the panel says the record names it and the map could not place it. The county's panel lists such villages. |
| N4 | Window opened at a country-only record | The window opens at the last record that names the place being left. The number of years is counted from full dates where both are known. |
| N5 | Ember-only person selected but off-screen | The camera goes to the ember. |

93 unit tests, the River's 59 browser checks and the Atlas's 157 pass.

## Left for the owner

- The last frame stands far back, so the remnants are small.
- Hollow lights and "last placed here" rings are both open circles.
- The 1883 note says "with wife, 6 children"; only the man himself is placed by it.

## Next

A full outside test of this commit by a fresh tester.
