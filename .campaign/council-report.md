# Council report: the Atlas, round 21

Subject: the fifteenth full outside test (commit `7d80523`, a fresh tester), and what was done.

## What the tester found

Verdict on `7d80523`: **no**, "not quite", on one line.

- The owner's four requests: met.
- Rules A1 to A12 for the Atlas: no violation. Every bar of every decade strip (6 countries, 73 places) recounted from the drawn frames and found exact. All 18 findings, all 38 captions and 172 quantifier forms recount true.
- Scores: **28.5 of 35 overall, 31.5 as a build.** The build is over the Council's bar of 31 for the first time.

Blocking:
- **D1.** In the River, James Carter's record box said "Died after 1808 … Aged about 35", beside a son born in 1816. The age line added last round treated an "after" date like a "c." date. The life-summary code already refuses such dates; the new line did not.

Minor: a decade strip said "Most in the 1960s: 1" when several decades were level (27 of 57 strips); two small-screen overlaps; one keyboard path where Esc left focus on the page body.

## The Council

**Cat.** A fix to version 1 broke version 1 for one man. The owner asked that the River not be disturbed. Every change to shared code now gets a River check of its own.

**Owl.** One line and one wording. Add a browser check for each.

**Bear.** 31.5. The bar is met on the build. It is not met on a commit a tester has passed. Fix, test, and only then say so.

**Simon.** Consensus as Owl and Bear say.

## What was done

| Point | Fix |
|---|---|
| D1 | The River gives no age at death when either date is "after" or "before". A browser check opens James Carter in the River and looks for it; another checks Peter Barlow reads "Aged 85". |
| Tied peaks | A strip with several level decades says "Never more than N, first in the Xs." A browser check counts the bars from the scene and checks the wording. |
| Interactive | A bar in a decade strip can be tapped to go to that decade. |

94 unit tests, the River's 59 browser checks and the Atlas's 164 pass. One River check failed once in a full run and passed on two reruns; it reads the current year off the screen and is sensitive to timing.

## Next

A full outside test of this commit, with scores.
