---
created: 2026-11-19
council-type: standalone
---

# Council Report

Closing round on The Atlas. Earlier rounds: `council-report-atlas-plan.md`, `-mockups.md`, `-post-build.md`, `-round-3.md`, `-round-4.md`. This round takes the fourth, fifth and sixth outside passes together.

## Animal Perspectives

### Bear — Vision & Direction
- The Atlas does what the brief asked: births, deaths and migration over time, on a globe, on a flat map of two shores, or both. It keeps the River's second idea, doubt, and makes it the visual language: solid, hollow, haze, dimming.
- It has a beginning, a middle and an end now: Norfolk, one crossing told while the ship is at sea, and a last frame that stands back from the Earth and says the living carry on unseen.

### Cat — Risk & Scope
- The rule I asked for at the plan stage, no place by guesswork, took four rounds to make true. In the last three outside passes it was checked for every person in every year: no solid light before a record of the person's own, no hollow light anywhere but where a living relative with a record of their own was, counts that match the drawing, nothing about the living. Zero violations each time.
- Not demonstrated: the last round of fixes (the ending, the mid-century captions, the count of children drawn with their parents, the wording leftovers) was checked by the automated suite and by eye, not by an outside tester.
- Known and left: a small zoom dip between 1673 and 1698; the load-time hint can sit over a rim pointer for a few seconds; on a phone the last two country chips need a swipe that nothing signals.
- For the owner: "Beverley", born about 1948 with no death recorded, is flagged deceased in the tree. If she is living, the flag needs correcting in Iris; she is currently named in the list of people not on the map. And the voyage routes (Cape before 1914, Panama after) are drawn from general knowledge, not checked against a source.

### Owl — Process & Structure
- Council on the plan, Council on three mockups, then build, then five rounds of outside test, Council and fix. Six outside passes in all. Unit tests rose from 27 to 84 and Atlas browser checks from 74 to 112, one for each defect fixed. The River's 59 checks passed unchanged throughout.
- The River was touched in three small places: a link in its header, a link on its person record, and the code that keeps those links on the year being shown.
- Nothing is merged and nothing is published. That is the owner's call.

### Puppy — Opportunities & Momentum
- Things worth showing someone: the globe turning with the 1874 ship; "nobody is recorded coming back"; the 94-year silence; tapping a family line in the Key; the last frame.
- Left on the table, all possible with the data in hand: surfacing the leads as marks on the map, as the River does with stars; captions during "Follow the journey" for people who never sail.

### Rabbit — Resources & Stakeholders
- A phone gets the whole thing: both views, the Key, a header that leaves the map the screen, a sheet that does not hide the person selected.
- No map service, no geocoder, no tiles: the basemap and every coordinate are in the repository.

### Wolf — Cohesion & Balance
- Every country in the records has a chip, a count, a panel and a first-appearance caption, Wales included. Poland is nearly dark and the page says why.
- Eighteen people are not drawn at all. That is more than at the start, and it is the honest number.

## Consensus

The outside testers' scores, which the Council adopts and does not round up:

| | Fifth pass | Sixth pass | Sixth pass, as a build |
|---|---|---|---|
| Interesting | 4 | 4 | 4.5 |
| Novel | 4 | 4 | 4.5 |
| Surprising | 4 | 3.5 | 4 |
| Delightful | 3.5 | 3.5 | 4 |
| Engaging | 3.5 | 3.5 | 4 |
| Interactive | 4.5 | 4 | 4.5 |
| Dynamic | 4.5 | 3.5 | 4 |
| Total of 35 | 28 | 26 | 29.5 |

"As a build" judges only what the page does with the data it has. The concept was scored 31. The build has not reached it, and both late testers put much of the gap down to the records: two thirds of people have no place of their own, one voyage is dated, there are no ship names and no photographs tied to places. The River reached 35 because its data, lines of descent, is complete; place is not.

Against the brief: both views and both together; births, deaths and migration over time; the seven criteria scored at every round; the Council before, during and after; main untouched. Done. Against "fully tested": the rules are verified for every person in every year by three outside passes; the last fixes are verified by the automated suite only.

## Recommended Next Steps

1. Owner: confirm whether "Beverley" is living, and correct the flag in Iris if so.
2. Owner: decide whether to merge the branch. Nothing has been merged or published.
3. If the Atlas is taken further: stars on the map for the leads; captions when following someone who never sails; a scroll cue on the phone's row of countries.
4. Better scores need better records: dated arrivals, ship names, places for the Polish lines.
