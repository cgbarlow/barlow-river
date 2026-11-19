# Council report: the Atlas, round 26

Subject: the twentieth full outside test (commit `97e82d4`, a fresh tester), and what was done.

## What the tester found

Verdict on `97e82d4`: **no**, on two points.

- The owner's requests: met.
- The crash of round 25 is fixed: 4,992 checks with a finding open and the year moved every way, on three views, with reloads; 90 more with a person, place, country, family, swatch or Follow active; 1,150 random ordinary actions on four screen sizes. No error, no blank map.
- Rules A1 to A14: no violation. 338 sentence forms with a number and 140 with a negative reviewed: none false in the Atlas's own text.
- Scores: **28.5 of 35 overall, 31 as a build.** The build is at the Council's bar.

Blocking:
- **B1.** The story button, made to stay at the top of the Journeys tab in round 25, covers the title of the story it opens when the panel is a bottom sheet: on a phone and in a 900-wide window, 18 steps of 19.
- **B2.** "Lost a father at 6 or 7" for Frank H Barlow, born 1883, died 1884. His father died in 1890. The sentence never checked that the child was still alive. Shared code; in the River too, and on `main` today as "at about 6".

## The Council

**Cat.** B1 is the fourth blocker in a row made by the round before. It was called low-risk. Nothing is low-risk without a check on a phone.

**Owl.** Two fixes, a check each, nothing else.

**Rabbit.** B2 is older than this branch. Fix it anyway; it is one condition, and say it changes the River.

**Bear.** Thirty-one. If the next test passes, we close at whatever it scores and tell the owner the range.

**Simon.** Consensus.

## What was done

| Point | Fix |
|---|---|
| B1 | A finding scrolled into view stops below the story button. A browser check steps through nineteen stories at 390x800, 900x700 and 1440x900 and measures that each title is in view and below the button. |
| B2 | "Lost a father/mother" is said only when the parent died while the child was alive. A unit test covers a child who died first and a sibling who did not. In the River too. |
| README | A "c." year gives the age as "about", which is what the page does. |

Nothing else was changed.

95 unit tests, the River's 59 browser checks and the Atlas's 175 pass.

## Next

A full outside test of this commit, with scores.
