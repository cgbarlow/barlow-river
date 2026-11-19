# Council report: the Atlas, round 20

Subject: the fourteenth full outside test (commit `09fdda4`, a fresh tester), and what was done.

## What the tester found

Verdict on `09fdda4`: **yes**, fit to merge. No blocking defect.

- The owner's four requests: met.
- Rules A1 to A12: no violation, including at four points in every year, not only whole years.
- **Every number and every quantifier on the page recounted:** 277 sentence forms with a number or a "most/all/first/last", and 404 with a negative. None false.
- Everything added in round 19 recounted exactly.
- Scores: **28.5 of 35 overall, 30 as a build.** The same as the test before. The bar is 31.

Minor: the River's "Aged about N" is one year high in 21 records, not the three reported earlier; a counted caption can stay on screen twenty years after its year; a title clipped in the Poland inset on a phone; the longer Key needs scrolling on a sideways phone.

What the tester said would add half a point: a presence-over-time strip in each place and country panel; captions for the long middle (1700 to 1850); retiring a counted caption once its year is well past. And three larger features: comparing two lives, a person's line to the youngest generation, and automatic coincidences.

## The Council

**Owl.** Two tests at thirty. The first three items are small and each maps to a criterion. Do those. The three larger features are new scope: put them to the owner.

**Cat.** The River's age line is version 1's own code and it is wrong in 21 records. We have the function that gets it right. Use it. Tell the owner the River changes.

**Bear.** Agreed. And say plainly that the score may stay at thirty: two testers in a row put the overall at 28.5 because of the records.

**Simon.** Consensus as Owl says.

## What was done

| For | Change |
|---|---|
| Interesting | Every place panel and country panel has a strip of bars: how many lights stand there at the middle of each decade, with the peak decade and its count. |
| Engaging | Captions for the first dated record the map reads in Cornwall (1757) and Kent (1773), and in Staffordshire (1592), where no other caption is near. |
| Dynamic | A counted caption leaves the screen once its year is more than six years past. |
| River | "Aged N" is counted from the full dates, "N or N+1" from bare years, "under one year" for an infant. |
| Minor | The inset title on the last frame shows the count alone, so it fits. |

94 unit tests, the River's 59 browser checks and the Atlas's 160 pass.

## Put to the owner, not built

- Compare two lives side by side on the map.
- A person's line down to the youngest generation, drawn on the map.
- Coincidences flagged automatically (relatives in one town in one year).

## Next

A full outside test of this commit, with scores.
