# Council report: the Atlas, round 23

Subject: the seventeenth full outside test (commit `55e4fde`, a fresh tester), and what was done.

## What the tester found

Verdict on `55e4fde`: **yes**, fit to merge. No blocking defect.

- The owner's requests: met, the River included (all 340 of its record boxes checked).
- Rules A1 to A12 and R1: no violation. 2,640 strip bars recounted; every "most in any year" matches the maximum over all years.
- 543 sentence forms with a number or quantifier and 133 with a negative reviewed: none false.
- Scores: **29.5 of 35 overall, 30.5 as a build.**

The last three build scores: 31.5, 30.5, 30.5. The bar is 31.

Minor: a country panel's "N lit in YEAR" line did not follow the year; the family message could show an old year; the focus mark on a strip bar was faint; the borrowed-lights title was ambiguous ("most of all"); focus lost after "not on the map".

What the tester said would add half a point: panels that update live with the year; a "next story" step through the findings; a bar's message saying who came and went; a fresh family message each year; a visible focus ring on bars.

## The Council

**Owl.** Five items, all small, all in the tester's last column. Do the five.

**Cat.** And each new sentence counted. "3 new here, 18 gone" is a count; check it against the scene before the commit.

**Bear.** If the next test says 31 or more with no blocker, we close. If it says 30.5 again, we report that three testers in a row put the build between 30.5 and 31.5 and let the owner judge whether that meets the bar.

**Simon.** Consensus.

## What was done

| For | Change |
|---|---|
| Interactive, Dynamic | An open country panel's count follows the year, in play and in scrubbing. Every strip has a marker at the current year. |
| Engaging | A "Tell me a story" button in the Journeys tab steps through the thirteen starred findings in the order of their years. |
| Surprising | A bar's message also says how many are new there since ten years before and how many have gone. |
| Delightful | The family message is renewed with each year, or cleared. A strip bar has a white focus ring. |
| Minor | The borrowed-lights title: "168 of the 322 people on the map are placed only by a relative's record; the share is highest for those born in the 1900s". Focus goes to the heading after "not on the map". A county or country strip says "in", not "at". |

Checked before the commit: the story order (thirteen findings, 1654 to 1959, then round again); England at 1850 reads 113, as its chip does; the 1885 bar says 68 lights, 3 new, 18 gone, and the scene gives 68, 3 and 18.

94 unit tests, the River's 59 browser checks and the Atlas's 166 pass.

## Next

A full outside test of this commit, with scores.
