# Council report: the Atlas, closing

Subject: the eleventh full outside test in a row (commit `d24dec7`, a fresh tester), and the state of the work against the brief.

## The verdict

> Yes: d24dec7 is fit to merge as "fully tested and working". I found no blocking defect.

What the tester checked, by its own checker built from the two data files and not the page's code:

- **Placement rules A1 to A8:** no violation in any of 437 years (20,079 lights) or 1,573 play-through frames (105,038 lights).
- **Every recountable number** in the captions, findings, place panels, country panels and life sentences: true. 420 age and order sentences recomputed, none wrong.
- **Every sentence with a negative in it:** 1,431 sentences in 176 forms, read one by one. None that is scoped to the map is contradicted by a record the map reads.
- **The owner's four requests:** all met.
  1. The timelapse on a globe, a flat map (Two shores), or both, with births, deaths and migration.
  2. The camera crossed hemispheres exactly once, at 1874, riding the voyage. No bounce.
  3. Other countries: a chip row always on screen, pointers at the globe's rim, insets for Poland and the United States.
  4. A remnant after every light: 317 people who had a light each leave one ember or ring.
- **Use:** full play-through, every control by mouse, touch at two phone sizes and keyboard alone, 23 deep links including bad ones, the links to and from the River. No console errors from the page.

## The seven criteria

| | Interesting | Novel | Surprising | Delightful | Engaging | Interactive | Dynamic | Total |
|---|---|---|---|---|---|---|---|---|
| Overall | 4 | 4 | 3.5 | 4 | 3.5 | 4.5 | 4.5 | 28 |
| As a build | 4.5 | 4 | 3.5 | 4 | 4 | 4.5 | 4.5 | 29 |

The plan was scored 31 by the Council before anything was built. The build has not reached that, and the Council will not say it has. The tester's reason, in its own words for the build row: Interesting "better records would raise it"; Surprising "limited by the records; more dated voyages would raise it". Half the lights are borrowed and one voyage is dated closely enough to sail. That is the tree, not the page.

## How it got here

Sixteen Council rounds. Eleven full outside tests of the build in a row, each by a tester who had not seen the others' reports, each followed by fixes and a new test of the new commit.

Blocking points per test: ten, ten, five, two, four, one, one, one, one, two, none.

- The placement rules had no violation in any of the eleven.
- One crash-class bug was found (the globe going blank after Home) and fixed in round 10.
- The fifth test found long-gap lines drawn solid against the Key, and one birthplace resolved to the wrong village; both fixed in round 11.
- From the sixth test on, every blocker was a sentence: the page saying something was not recorded when it meant the map had not read it. The cure was to read more (a dated arrival, emigration and baptism the tree states), to say "the map reads", to say once in the guide what that is, and to add a check that reads every panel, tab, caption and finding.

## The Council

**Cat.** I asked for a true "no" eleven times and got ten. I will take the yes. The risk that is left is another sentence of the same kind, and there is now a check for the forms we know.

**Owl.** The process held: no commit was called done on our say-so. The tested commit is the merged candidate; only documents change after it.

**Bear.** The owner asked for births, deaths and migration on the Earth, a camera that does not bounce, the other countries, and something left behind when a light goes out. He has all four.

**Rabbit.** The River changed too, in shared code: ages count birthdays, birth order is read from dates, a count of children is not shown where a child is living. Its 59 checks pass. That should be said to the owner plainly, because he asked that version 1 not be disturbed. It is on the branch, not on `main`.

**Wolf.** `main` is untouched. Nothing is published. No pull request has been opened. Merging is the owner's decision.

**Puppy.** Eleven testers, and the lights were in the right place every time.

**Simon.** Consensus: the Atlas meets the brief's test of "fully tested". The Council recommends it as ready for the owner to merge when he chooses, with the list below.

## Left for the owner

Not blocking. His to decide.

1. **The last frame** stands far back on the globe, so the remnants are small.
2. **Hollow lights and "last placed here" rings** are both open circles.
3. **The 1883 arrival note** says "with wife, 6 children"; only the man is placed by it.
4. **Free text the map does not read:** cemetery citations for four Polish relatives (so they are listed, not drawn); an undated "Died Christchurch"; a candidate christening in a note; a bare "St Martin".
5. **James Carter's death** is "after 1808"; his light goes out in 1808 though a son is born in 1816.
6. **James Finch, 1846 to 1848:** a move to Woodbridge is drawn across two years, though a record puts him in Sproughton again in 1848.
7. **Wording nits** the last tester listed: two guide sentences; the stop label "no placed record"; the People tab's "Nothing about them is in this page" (the data file does hold an unnamed stub for each living person, as the README says).
8. **Follow the journey** is slow on short hops; a caption can lag a year in play.
9. **Small screens:** a few overlaps on a sideways phone.
10. **The River** shows "Aged about N" one year high in three records. That is version 1's own code, on `main` today.
11. **"Beverley"** (born about 1948, no death recorded, flagged deceased in the tree) is named in the "not on the map" list. If she is living, the flag needs correcting in Iris.
12. **Voyage routes** (round the Cape; Panama after 1914) are convention, not checked against a source.
