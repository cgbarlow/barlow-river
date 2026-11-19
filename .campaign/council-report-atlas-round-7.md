# Council report: the Atlas, round 7

Subject: the full outside test of commit `88234f4`, and what was done about it in `e73c4e0`.

## What the tester found

Verdict on `88234f4`: **not yet**. Nothing crashed and nothing was lost, but the page said things that were not true.

- The owner's three requests were all met. Timelapse in all three views. The camera changed hemisphere exactly once in 1,250 samples. Six countries plus "At sea" visible.
- Rules A1 to A7: about 680,000 light-frames checked, paused at every year and on every frame of a full play. **No violations.**
- Of the sixteen defects from the test before, ten were fixed, six partly.
- Ten defects in the build, none needing new records. The worst: ages a year out in six panels; "Light the family" leaving most of the family out of view; 21 "moves" between a country marker and a town inside it.
- Scores: 26.5 of 35 overall, 29 as a build.

## The Council

**Cat.** The rules about where a light may be drawn have now held through six passes. The defects have moved from the map to the sentences beside it. "Last at 36" when the dates say 35 is the same fault as a light in the wrong town: the page claiming more than the record. Treat every number in a panel as a claim to be tested. Fix D1 and D3 before anything else.

**Owl.** Ten defects, one commit, one more full pass. Do not split it. Order: false statements (D1, D3, D10), then things that do not work (D2, D4, D5), then focus, toast and phone (D6 to D9).

**Bear.** "Light the family" is the one new idea since the last round and it shipped pointing at the Pacific. Either it shows the family or it goes. Frame the side most of them are on and say how many are on the other.

**Rabbit.** The age fix belongs in the shared code, so the River gets it too. A bare year cannot say which side of a birthday someone was on; "35 or 36" is the honest form and the 1814 caption already uses it.

**Wolf.** The tester's taste list is not the defect list. Take the cheap ones that are really honesty (a stale caption over a new person) and leave the rest.

**Puppy.** Zero violations across 680,000 frames, and a camera that crosses once. Those were the two things most likely to sink this and they are solid.

**Simon.** Consensus: fix all ten, add a browser check for each so they cannot return, and have the new commit tested from scratch by a tester who has not seen this one. The build is not done until that tester says so.

## What was done (`e73c4e0`)

| # | Defect | Fix |
|---|---|---|
| D1 | Ages a year out | Ages count birthdays. Bare years give "35 or 36"; a "c." year gives "about". In the River too. |
| D2 | Light the family out of view | Frames those lit in the current year, on the side most of them are on, and re-frames as the year is scrubbed. Says how many are on the other side. |
| D3 | Moves between a country and a town in it | A record naming only the county or country of the place before it (or the reverse) is not a move. No distance to or from a country. The "most places" finding states its rule. |
| D4 | Arrow keys stepped once | Focus stays on the map. |
| D5 | Place labels unreliable | A place name is a target along its whole length. |
| D6 | Focus lost | Esc returns focus to the control a record was opened from; findings and "Light the family" keep it. |
| D7 | Message outlived selection | Cleared with the selection. |
| D8 | Phone leftovers | Shorter chips; caption between the Key and the zoom buttons under the lower map; more room under the maps on a short screen. |
| D9 | "1873.1", gone in 0.7 s | Whole year; held until read. |
| D10 | Wording | "accomplishment" replaced; borrowed first place says "from"; follow captions say how many records they leave out. |

Sixteen new browser checks. On `e73c4e0`: 88 unit tests, the River's 59 browser checks and the Atlas's 145 all pass.

## Next

A full outside test of `e73c4e0` by a fresh tester.
