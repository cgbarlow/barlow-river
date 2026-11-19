# Council report: the Atlas, closing (third)

Subject: the twenty-first full outside test (commit `0bf28e7`, a fresh tester), and where the work stands against the brief.

## The verdict

> Yes: 0bf28e7 is fit to merge as "fully tested and working". I found no BLOCKING defect.

By the tester's own checkers, written from the two data files:

- **The owner's requests:** all met. The timelapse on a globe, on Two shores, or both. One hemisphere crossing in a full play-through. The other countries always in view. A mark left by every one of the 317 lights. The River loads and works, and R1 holds for all 340 of its people.
- **Placement rules A1 to A8:** no violation on 437 paused years and 1,118 play frames.
- **Numbers and words:** about 120 sentence forms with a number or quantifier and 324 with a negative reviewed. None false.
- **Navigation and robustness:** no trapped Back, every address the page writes reloads, about 700 random actions on three screen sizes with no error.
- **The two fixes of round 26:** 148 story steps measured at four sizes, none with a covered title; every "lost a parent" sentence in both pages true.

## The seven criteria

| | Interesting | Novel | Surprising | Delightful | Engaging | Interactive | Dynamic | Total |
|---|---|---|---|---|---|---|---|---|
| Overall | 4 | 4.5 | 3.5 | 4 | 3.5 | 4.5 | 4.5 | 28.5 |
| As a build | 4.5 | 4.5 | 4 | 4 | 4 | 4.5 | 4.5 | 30 |

The plan was scored 31 before the build. Build scores from the last ten outside tests, oldest first: 29.5, 30, 30, 31.5, 30.5, 30.5, 30, 29.5, 31, 30. Overall scores over the same tests: 28 to 29.5.

The Council's reading:

- **The build sits at 30 to 31.** Two of ten testers put it at or over the bar; eight put it a half point or a point under. Different testers score the same build about a point apart.
- **The overall score sits at 28.5** and has not moved in ten tests. Every tester gives the same reason: 168 of 322 people have none of the records the map reads, and one voyage is dated closely enough to sail. That is the tree.
- **The bar of 31 is not met cleanly.** The Council does not claim it is.

## Why the Council stops here

Rounds 17 to 26 added features to gain the last point: the close last frame, diamonds, new findings, counted captions, decade strips, the story button, live panels. The score rose from 29 to about 30.5.

Over the same rounds, four tests in a row were failed by something the round before had added: an uncounted sentence, the River's age line, a star drawn early, a pinned button. Each was fixed and now has a check. But the pattern is plain: further features cost a blocker each and gain half a point from some testers and none from others.

What testers now name as the next half points are larger features: comparing two lives, a person's line to the youngest generation, automatic coincidences, a story told as one arc, the full list behind a strip bar. Those are new scope, and the owner's to choose.

**Cat.** I will not sign "31". I will sign "no rule violation in twenty-one tests, no false sentence in the last one, and a build ten testers put between 29.5 and 31.5".

**Bear.** The four things the owner asked for are there and have been there, measured, in every test since the tenth.

**Owl.** The tested commit is `0bf28e7`. Only documents change after it.

**Rabbit.** The River changed on this branch, in shared code, and each change fixed something that was false: ages count birthdays; birth order is read from dates; no count of children where one is living; no age from an "after" date; no "lost a parent" for a child who died first. Its 59 checks pass. The owner asked that version 1 not be disturbed, so he should accept these knowingly.

**Wolf.** `main` is untouched. Nothing is published. No pull request is open.

**Simon.** Consensus: the Atlas is fully tested and working by the measure of the last outside test. On the seven criteria it stands at 30 of 35 as a build against a plan scored 31. The Council puts two questions to the owner: whether that meets his bar, and whether he wants any of the larger features.

## For the owner

Minor, from the last test, not fixed (no code was changed after it):

1. Picking the ember of one of the four people who have only an ember moves the year to their death year, losing the last frame.
2. Pressing "/" focuses the search box but keeps the old query.
3. On a phone, tapping a finding card closes the sheet, and the globe takes a second to frame findings that span both sides of the world.
4. "them" and "their" in two sentences about people whose sex is recorded.

Standing items, his to decide: the 1883 arrival note ("with wife, 6 children"); free text the map does not read (cemetery citations, an undated death place); James Carter's "after 1808"; James Finch's 1846 to 1848; small-screen overlaps; "Beverley" (flagged deceased in the tree; if she is living the flag needs correcting in Iris); voyage routes are convention.

Not built, his to choose: comparing two lives; a line to the youngest generation; coincidences; a story as one arc; the full list behind a bar; ages at death by country.

## The owner's decision

Put to the owner on 19 November 2026: accept the Atlas as it stands at about 30 to 31 as a build against a plan scored 31, build the larger features, or fix the four minors and test once more.

The owner chose: **accept as it stands.** Commit `0bf28e7` is the finished, tested build. No further changes are made. Whether and when to merge to `main` remains his decision; no pull request has been opened.
