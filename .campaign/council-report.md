# Council report: the Atlas, round 9

Subject: the third full outside test in a row (commit `fb4b58a`, a fresh tester), the owner's question about what stays after a light goes out, and what was done.

## What the tester found

Verdict on `fb4b58a`: **no**. Five blocking points, all in the words.

- The owner's three requests: met. One camera crossing in 10,810 frames.
- Rules A1 to A8, by the tester's own checker over every paused year and every play frame: **no violations**.
- A9 (no milestone on a hollow light without saying so): two violations, and one "last" that was false.
- Of the sixteen points from round 8: ten fixed, five partly, one fixed on the page but stale in the README.
- Scores: 26.5 of 35 overall, 28 as a build.

Blocking:
1. "Elijah Haggar dies in 1947: the last light in Britain that a record of its own places there" was false against the map: another recorded light sits in England until 1954.
2. "The tree names no ship" was false. The tree names two: the Atrato (1874, in a note) and the East Lothian (arrival of 2 July 1883, an event with no place field, which the pipeline dropped).
3. The 1914 and 1902 captions counted hollow lights without saying so.
4. A place named by a later record still attributed to an earlier year, in follow captions and four panels.
5. Birth order read from the order the tree lists children in, not from their dates. Six panels false. Shared code, so in the River too.

## What the owner asked

> Do the lights go out completely after death or is there still a remnant that we can see? If there is still some kind of remnant, that's good that's what I want.

Before this round only 47 people left an ember, because an ember means "died here" and needs a record. Everyone else vanished.

## The Council

**Cat.** Three rounds, three testers, and each found false sentences the last did not. The pattern is plain: every sentence written from a derived value and not from the record is a defect waiting. This round, go to the source each time: dates from the record's own date, places from the record's own place, "last" from what is drawn.

**Owl.** The 1883 arrival is in the tree with a date and a destination. Dropping it because the place sat in the wrong field was a pipeline fault. Read it.

**Rabbit.** For the owner's remnant: a second mark, visibly different, that says "last placed here". The ember keeps its meaning. Nobody is left with nothing.

**Bear.** Agreed, and count them at the end. "England 236 remembered" is the ending this map should have had.

**Wolf.** Birth order is the River's code. Fix it there, test it there.

**Puppy.** Zero rule violations for the seventh pass running.

**Simon.** Consensus: fix all five blockers and the minors that are one line each; add the remnant; test again from scratch. If the next tester still says no, the Council will report that honestly and not round it up.

## What was done

| # | Point | Fix |
|---|---|---|
| 1 | False "last light in Britain" | The caption is now computed from what is drawn: the last year any light is in Britain, whose it is, and whether it is hollow or what record places it. |
| 2 | "Names no ship" | Removed everywhere. The 1883 arrival is read and places Peter William Barlow in Auckland from 1883. The 1874 finding points to the note that names the Atrato. |
| 3 | Hollow lights counted silently | Both captions say so; the 1914 one also gives the peak by records alone. |
| 4 | Later place on an earlier year | Moves and follow captions name each place as that year's record does. A death and burial in one year read "Died in A and was buried in B". |
| 5 | Birth order | Read from dates; nothing is said when the dates cannot settle it. |
| Owner | Remnant | An open ring stays where a light was last placed when no death place is recorded. In the Key as "Last placed here". Counted with the embers on the last frame. |
| Minor | Follow ends on the wrong side; pause loses the follow | The camera stays where the light was; play resumes the follow. |
| Minor | Tapping a light zoomed out | Following never stands further back than the view was. |
| Minor | Certainty colour | Follows the Key's grouping. |
| Minor | "94 years" silence | 93, from the full dates, which are quoted. |
| Minor | "35 or 36" where both dates are full | Exact when the record has a full date. |
| Minor | England panel count; "Louisa own"; Home and End; Both at mid widths; README | Fixed. |

Each record now carries its full date where the tree has one. Stops still come only from the published, privacy-filtered file.

92 unit tests, the River's 59 browser checks and the Atlas's 153 pass.

## Next

A full outside test of this commit by a fresh tester.
