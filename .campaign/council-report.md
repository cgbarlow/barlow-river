# Council report: the Atlas, round 22

Subject: the sixteenth full outside test (commit `4f04158`, a fresh tester), and what was done.

## What the tester found

Verdict on `4f04158`: **no**, on one point, "on a strict reading".

- The owner's requests: met, including that the River is not disturbed. All 340 River record boxes opened; the age line is right in each.
- Rules A1 to A8, A10 to A12: no violation. `atlas.json` rebuilt by the tester: identical.
- Scores: **28.5 of 35 overall, 30.5 as a build.** The test before gave the build 31.5. Two testers, one point apart.

Blocking:
- **D1.** The decade strips said "Most in the 1840s: 106" and "Never more than 13". The bars sample the middle year of each decade. In 15 of 60 strips some other year has more: England has 113 lights in 1850, and the same panel says so two lines above.

Minor: a finding said "322 lights" where 317 people ever have a light; "Lost a father at about 11" from bare years; the guide did not say that a life inside one year has no light; strip bars too small to hit and not reachable by keyboard; "Light the family" lost relatives who crossed later without saying so; an emigration called an arrival.

## The Council

**Cat.** "Most" and "never" are claims about every year. The strip counted one year in ten. Count every year, or do not say it. Count every year.

**Owl.** Then the minors, each one line. And the tester's half-point column: tappable bars that say who stood there, bars for the keyboard, an ember that names its person, family kept in sight.

**Bear.** The score went down a point with a different tester on a better build. The number has noise of about a point. We report both and do not pick.

**Simon.** Consensus as Cat and Owl say.

## What was done

| Point | Fix |
|---|---|
| D1 | The strip says "The most in any year: N, first in YEAR", counted over every year. The bars are described as the middle year of each decade. A browser check recounts it for three countries. |
| Bars | Each decade is a full-height target, reachable by Tab and pressed with Enter. Tapping one goes to that year and names who stood there. |
| Embers and diamonds | Pointing at one names the person; tapping opens their record and keeps the year. |
| Light the family | When relatives end up on the other side of the world as the year is moved, a message says how many. |
| "322 lights" | "168 of the 322 people on the map are drawn with a relative". |
| "at about 11" | "at 10 or 11" from bare years, in the River too. |
| Guide | Says a life recorded within a single year has no light. |
| Emigration | Called an emigration. |

94 unit tests, the River's 59 browser checks and the Atlas's 166 pass.

## Next

A full outside test of this commit, with scores.
