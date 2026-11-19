# Council report: the Atlas, round 12

Subject: the sixth full outside test in a row (commit `cea294e`, a fresh tester), and what was done.

## What the tester found

Verdict on `cea294e`: **no, though it is close.** One blocker, one sentence.

- The owner's four requests: met.
- Every point from round 11 (N1 to N7): fixed. All 122 place strings were put through the gazetteer and read: none lets a later word win. Every solid line has a window of three years or less. All 79 "last known" sentences open at the last record that names the place.
- Rules A1 to A8, by the tester's own checker, every year and every frame of four play-throughs: **no violations**.
- 93 unit tests run by the tester: pass.
- Scores: 28 of 35 overall, 29 as a build.

Blocking:
- **B1.** Peter William Barlow's panel said "the records here do not date the voyage" beside his own record, "1883 Auckland, arrival noted in the tree", dated 2 July 1883.

Minor: a death recorded as "after 1808" shown as "c. 1808"; a same-year death and burial drawn dashed; a guide sentence that read as if 31 people lacked both birth and death; three small-screen overlaps; "London" for a Lambeth parish in one caption.

## The Council

**Cat.** One false sentence, in one panel, about the one record added in round 9. It is the same class as before, but the class is now nearly empty: the tester machine-checked every move sentence, every place string and every line style and found this alone.

**Owl.** Fix it, fix the three one-line minors, test again. Nothing else.

**Wolf.** Tell the owner the count: six testers, and the blockers went ten, ten, five, two, four, one.

**Bear, Rabbit, Puppy.** Agreed.

**Simon.** Consensus as Owl says. The small-screen overlaps and the "after 1808" light going out in 1808 go on the owner's list.

## What was done

| Point | Fix |
|---|---|
| B1 | Where the tree dates the arrival, the panel says so and gives the date. |
| "after 1808" shown as "c. 1808" | The stop reads "after 1808". |
| Same-year death and burial dashed | Drawn solid: it is known to within the year. |
| Guide: "31 have no birth on record either" | "31 people have no birth on record". |

93 unit tests, the River's 59 browser checks and the Atlas's 158 pass.

## Left for the owner

- The last frame stands far back, so the remnants are small on the globe.
- Hollow lights and "last placed here" rings are both open circles.
- The 1883 note says "with wife, 6 children"; only the man is placed by it.
- James Carter's death is recorded as "after 1808"; his light goes out in 1808 though a son is born in 1816.
- Small screens: stars pushed outside their panel on a sideways phone; a rim pointer under the chip row with the sheet open; the open Key over the closing caption.

## Next

A full outside test of this commit by a fresh tester.
