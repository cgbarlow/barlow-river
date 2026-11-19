# Council report: the Atlas, round 8

Subject: the full outside test of commit `e73c4e0` by a fresh tester, and what was done about it.

## What the tester found

Verdict on `e73c4e0`: **no**, on the word "fully". Nothing crashed, no console errors, 2 slow frames in 10,419.

- The owner's three requests: all met. One camera crossing, at 1874, on the desktop play-through and on both phone play-throughs.
- Rules A1 to A7, checked with the tester's own implementation of the rules: **no violations**.
- Of the ten defects from round 7: six fixed, one fixed with a residue, three partly.
- Sixteen new points. None is a light in the wrong place by the rules. Most are sentences that say more than the records: a finding title an older move disproves; a finding that made a doubt out of two dates nine months apart; a parish named for a year whose record names only the town; a milestone caption built on a hollow light; a child drawn in New York on her mother's birth record of 27 years before.
- Scores: 27 of 35 overall, 28.5 as a build.

## The Council

**Cat.** The rules passed, and the tester still found the page overreaching, so the rules were too narrow. A hollow light can obey every rule and still tell a story nobody recorded. Two changes to the rules themselves: a milestone is never built on a borrowed place; and when one parent is recorded either side of the birth, that parent lends, not whichever is listed first.

**Owl.** N1 to N3 are one fault: text written from the stay, which keeps the closest place name ever recorded, and not from the record of that year. Fix it once, at the source, and test the three sentences.

**Rabbit.** The page holds full dates and was not using them. The 1874 finding should quote 3 February and 9 November and stop inviting a check that needs no doing.

**Bear.** Say the seventy-year rule up front. 145 lights go out on an assumption. It was in each panel and nowhere a first-time reader would see it.

**Wolf.** The count of children in a panel counted living children. That is the River's rule, not the Atlas's, and it is broken in shared code. Fix it there. The River gets the fix too.

**Puppy.** Every pass has found the lights in the right places. What is left is wording, and wording can be finished.

**Simon.** Consensus: fix N1 to N15, widen the rules as Cat says, add checks, and test again from scratch. N16 is the records and stays as it is. The Council will not call this done on its own say-so.

## What was done

| # | Point | Fix |
|---|---|---|
| N1 | "The oldest move" was not the oldest | Retitled "A move the tree itself doubts". |
| N2 | Doubt made out of dates nine months apart | The finding quotes both full dates and says they fit. |
| N3 | A later record's place name given to an earlier year | Findings and follow captions name the place as that year's record names it. |
| N4 | Milestone on a hollow light | "Last light in Britain" is now the last placed there by a record of its own. A parent recorded either side of the birth lends before one who is not. |
| N5 | A generation-old record placing a child overseas | Same lender rule; and a borrowed start is dropped when it is over twenty years stale and in another country than the person's own first record. |
| N6 | Seventy-year rule unstated | In the guide and in "What the map cannot know", with the counts. |
| N7 | "5 with only an ember" | Four, and one recorded within a single year with neither. |
| N8 | Focus and message leftovers | Esc from help returns to the ? button; the family message clears on a country or help; Esc in search keeps focus. |
| N9 | Mid-width window | Chips shorten when they would overflow; no zoom buttons on two shores, which cannot zoom. |
| N10 | Phone: tapping a light zoomed out | The camera stands closer when the sheet is open. |
| N11 | "about" lost | Follow captions and place panels keep it. |
| N12 | Lens and Key wording | "By first place"; "Move, known to within three years"; people placed only by their own death are grouped with the hollow. |
| N13 | Kilometres between county centres | None given. |
| N14 | Small | "None of X's close family"; the filter says when nothing matches; arrows move between tabs. |
| N15 | Living children counted | No count of children unless every child has died. In the River too. |
| D1 residue | "Outlived by" and "Lost a mother at" | Counted from full dates; bare years give "19 or 20". |

Not done: the 800x380 three-line caption over Cornwall, the opened Key over the map on a phone, the early zoom breath, stars over labels. Taste, or the cost of a very small screen.

90 unit tests, the River's 59 browser checks and the Atlas's 149 pass.

## Next

A full outside test of this commit by a tester who has seen none of the earlier ones.
