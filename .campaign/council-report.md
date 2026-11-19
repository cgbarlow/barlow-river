---
created: 2026-11-19
council-type: standalone
---

# Council Report

Final round on The Atlas. It takes four outside reports together: the fifth and sixth passes, the seventh (a full test of what was then the final state), and a narrow confirmation of the commit that fixed the seventh's findings, `b630387`. Earlier rounds: `council-report-atlas-plan.md`, `-mockups.md`, `-post-build.md`, `-round-3.md`, `-round-4.md`, `-closing.md`.

## Animal Perspectives

### Bear — Vision & Direction
- The Atlas does what was asked: the River's timelapse on a globe, on a flat map of two shores, or both, showing births, deaths and migration. It keeps the River's idea of doubt and draws it: solid, hollow, haze, dimming.
- It has an ending. When the last named light goes out the globe stands back, the embers stay lit, and a line says the family carries on among the living, who are not shown.

### Cat — Risk & Scope
- The placement rules were checked by four consecutive outside passes for every person in every year. Zero violations each time: no solid light before a record of the person's own; no hollow light except where a living relative with a record of their own was; counts equal to what is drawn; nothing about living people.
- The seventh pass found one statement the data did not support, a caption dating a New Zealand-born majority to 1868. It is gone, and the confirmation recounted every number in every caption.
- Two minor wording defects are known and left, so that the code tested is the code delivered: the doubted Francis Barlow is given a single age, fifteen, from a year-only birth, in a caption and a finding (the figure is the tree's own note); and his panel's old-calendar note ends by quoting a plain "1639" that shows nothing.
- Not verified from outside: a tap that falls near both a star and a light; pinch and drag on a phone; starting a second "Follow the journey" while the first caption is still fully up.
- The voyage routes are a convention from general knowledge and were not checked against a source.

### Owl — Process & Structure
- The Council reviewed the plan, the mockups, and the build six times. Eight outside passes in all. Unit tests went from 27 to 84 and Atlas browser checks from 74 to 116; the River's 59 checks passed unchanged at every round.
- The tested commit is the final code. The only commit after it adds this report and a paragraph in the README.

### Puppy — Opportunities & Momentum
- Worth showing: the globe turning with the 1874 ship; stars appearing on the map as findings happen; "nobody is recorded coming back"; the last frame.

### Rabbit — Resources & Stakeholders
- Phone portrait and landscape, keyboard, deep links, browser Back and both links to and from the River were exercised by testers who did not build it.

### Wolf — Cohesion & Balance
- Every country in the records has a chip, a count, a panel and a caption. Eighteen people who cannot be placed are listed, not guessed.

## Consensus

Scores from the seventh outside pass, adopted without rounding up:

| | Overall | As a build |
|---|---|---|
| Interesting | 4 | 4.5 |
| Novel | 4 | 4.5 |
| Surprising | 3.5 | 4 |
| Delightful | 3.5 | 4 |
| Engaging | 3.5 | 4 |
| Interactive | 4 | 4 |
| Dynamic | 4 | 4.5 |
| Total of 35 | 27.5 | 29.5 |

"As a build" judges only what the page does with the data it has. The concept scored 31. The gap is mostly the records: about half the lights are borrowed, one voyage is dated closely enough to sail, and no ship is named. Both the seventh pass and the confirmation gave the same verdict: fit to merge alongside the River.

Done against the brief. Tested from outside in its final state. `main` has not been touched and nothing is published.

## Recommended Next Steps

1. Owner: decide whether to merge the branch.
2. Owner: confirm whether "Beverley" (born about 1948, no death recorded, flagged deceased) is living, and correct the flag in Iris if so.
3. When next in the code: give the doubted Francis Barlow an age range and end the old-calendar note at "25 March".
4. Better scores need better records: dated arrivals, ship names, places for the Polish lines.
