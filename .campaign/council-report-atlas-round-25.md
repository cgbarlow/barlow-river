# Council report: the Atlas, round 25

Subject: the nineteenth full outside test (commit `8e5566b`, a fresh tester), and what was done.

## What the tester found

Verdict on `8e5566b`: **no**, on one defect introduced in round 24.

- The owner's requests: met. The Back trap is fixed in every case tried: seven River-to-Atlas-and-back cases on desktop and phone, 31 deep links, a nine-step chain inside the Atlas, reload at each step.
- Every count and sentence recounted true. Rules A1 to A12 and R1: no violation.
- Scores: **27.5 of 35 overall, 29.5 as a build**, marked down on Interactive for the crash.

Blocking:
- **D1, a crash.** Round 24 let an open finding show its star a year before its own year. The star's "new" ring has a radius worked out from how long ago the finding's year was. More than a year before, the radius is negative and the drawing call throws on every frame: stars, pointers and labels vanish, and reloading that address fails. Open a finding and press the left arrow twice.

Minor: a message can stay for a few seconds after Back; the panel's own Back button adds a history entry; opening a finding replaces an entry instead of adding one.

## The Council

**Cat.** Three rounds running, the blocker was something added the round before to gain half a point: an uncounted sentence, an age line, a star. We are now breaking the build faster than we are improving it.

**Owl.** Then this round adds nothing. One guard, one check that opens every finding and moves the year everywhere, and two small things that cannot break anything.

**Bear.** Agreed. And we stop chasing the last half point after this. If the next test passes, the Council reports the scores as they are.

**Wolf.** The owner should be told that plainly.

**Simon.** Consensus: fix, guard, test. No new features.

## What was done

| Point | Fix |
|---|---|
| D1 | The ring is drawn only in the years after a finding's own. A browser check opens each of the eighteen findings, on the globe and on Two shores, and sets the year to one, two and five years before its own, to 1590, 1700, 2026 and back; another loads a finding's address at a year long before its own and presses the arrow keys and Home. |
| Messages after Back | Going Back or Forward clears any message. |
| Story button | Stays at the top of the Journeys tab while the findings scroll. |

Nothing else was changed.

94 unit tests, the River's 59 browser checks and the Atlas's 172 pass.

## Next

A full outside test of this commit, with scores. After it the Council will report the scores as they stand and put the question of the bar to the owner.
