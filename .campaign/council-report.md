# Council report: the Atlas, round 24

Subject: the eighteenth full outside test (commit `ea63f62`, a fresh tester), and what was done.

## What the tester found

Verdict on `ea63f62`: **no**, on one defect, and it is a real one.

- The owner's requests: met. No false statement. No rule violation. No privacy leak. Everything added in round 23 recounted exactly (1,141 samples of the open panel's count against the chip; 21 bar messages).
- Scores: **28.5 of 35 overall, 30 as a build.**

Blocking:
- **D1, the Back button.** Open a person in the River with the year outside their life, press "See on the map", then press Back: the browser stays on the Atlas, however many times Back is pressed. On arrival the Atlas moved the year into the person's life and recorded that as a new step; going Back to the arrival address did the same again. It has been there since the two pages were first linked. Seventeen testers went back and forth between the pages and did not hit it, because they started from a year inside the life.

Minor: the family message could be a year stale and was not renewed in play; a bar message said "at New Zealand"; the story button on a phone closed the sheet that holds the story; a story could open a year before its own star was drawn; the guide said a solid line always means the light travels.

## The Council

**Cat.** Eighteen tests to find a trap on the way back to version 1. The owner asked that version 1 not be disturbed; a visitor who cannot get back to it is disturbed. Fix it at the cause: restoring a view from an address is not a step, so it must not record one.

**Owl.** And two checks: one Back from the Atlas returns to the River; inside the Atlas each Back undoes one step.

**Bear.** The score has sat at 30 to 31.5 for five tests. We keep taking the tester's column, but we tell the owner the number is where it is.

**Simon.** Consensus.

## What was done

| Point | Fix |
|---|---|
| D1 | Restoring a view from the address bar or from Back no longer adds a history entry. Two browser checks: River → "See on the map" (year outside the life) → one Back returns to the River; inside the Atlas, two Backs undo two steps. |
| Family message | One message for the year on screen: how many of the family are lit, and how many are on the other side. Renewed whenever the year moves, cleared when play starts, renewed on pause. |
| Bar message | "in" for a county or country. It names up to three of those new there since ten years before. |
| Story button | Walks all eighteen findings that have someone on the map, in the order of their years. On a phone the sheet stays open at the story. An open finding shows its star even a year early. |
| Guide | A solid line is a move known to within three years, or a death and burial in one year, where no light travels. |
| Finding title | "168 of the 322 people on the map have none of the records the map reads and are drawn with a relative; the share is highest for those born in the 1900s". |

94 unit tests, the River's 59 browser checks and the Atlas's 169 pass.

## Next

A full outside test of this commit, with scores.
