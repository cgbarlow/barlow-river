# Brief: The River

## Where this came from

The original ask, 18 November 2026:

> review every collection in iris, come up with a set of criteria for an interesting, novel, surprising, delightful, engaging interactive, dynamic exploration based on the data sets. then rank each one in a scoring matrix across the criteria, and give me a visual mock up for the top 5

> obviously you'll need to come up with your best ideas for the individual collections for the mock ups

A Council of six advisors reviewed all 14 Iris collections and scored each on its single best concept. The Barlow Family collection came first with this concept. Full report: `docs/council-report.md`.

## The seven criteria

Each scored 1 to 5. The build should keep earning these.

| Criterion | Test | Score |
|---|---|---|
| Interesting | Is the data deep enough to reward a second look? | 5 |
| Novel | Does it show something the Iris canvas does not? | 4 |
| Surprising | Can it reveal something its author did not know? | 5 |
| Delightful | Is there a personal or playful pull? | 5 |
| Engaging | Is there a story with stakes? | 5 |
| Interactive | Are there real things to do? | 4 |
| Dynamic | Does it move, change over time, or respond live? | 3 |

Dynamic is the weak score. The year scrubber and play button are what lift it, so they are not optional.

## The concept

A family tree normally shows who descends from whom, and shows it with total confidence. This one shows two other things.

**Time.** The seven family lines are streams on a timeline from 1600 to today. A stream starts where its earliest known person is born. Two streams join where a marriage joins two lines. The Barlow line is the trunk.

**Doubt.** Where the tree is proven, the stream is solid. Where it is not, it is dotted. A case file sits beside the river for the open question: where did the Norwich Barlows come from? Each piece of evidence is a card marked ruled out, in doubt, or proven.

## What the user can do

1. **Scrub the year.** Drag the handle, or press play. People appear when born and fade when they die.
2. **Tap a person.** Opens their record: names, dates, places, photo, sources, notes.
3. **Switch the lens.** Three buttons.
   - By surname: one colour per line (the default).
   - By place: colour by where people lived. Norfolk, Kent, Cornwall, Staffordshire, Poland.
   - By certainty: colour by how well each link is sourced.
4. **Open the case file.** Read the evidence cards. Tap a card to light the people and links it bears on.
5. **Add a piece of evidence.** Stretch goal. See "Writing back" below.

## The seven lines

From the per-line views in Iris.

| Line | Head of line | Size |
|---|---|---|
| Barlow | Peter Barlow (1776 to 1862) | 82 people, 23 families |
| Finch | Edward Finch and Susanna Scribner | 89 people, 24 families |
| Carter | Herbert Graham Carter (1910 to 1991) and Eileen Doris Mildred Carter (1907 to 1978), married 1933 in New Zealand | 51 people, 13 families |
| Watkins | James Watkins and Elizabeth | 28 people, 9 families |
| Chmielewski | Jan Chmielewski (b. 1897) and Marianna Chmielewska (b. 1900) | 38 nodes in the view |
| Czeladka | Walenty Czeladka (b. 1896) and Antonina Czeladka (b. 1899) | 42 nodes in the view |
| Klos | Janusz Klos (c.1936 to c.2005) and his wife | 24 people, 9 families |

The Carter line has two ancestry views that act as tributaries: the Herbert Carter line (Kent and Norfolk) and the Samuel William line (Cornwall).

Whole tree: 214 people, 60 families, eight generations.

## The open case

From the Iris document "Hypothesis: the original Barlow village". Last reviewed there 13 October 2026.

- **Question.** Did the Norwich Barlows come from Barlow, Derbyshire or Barlow, Lancashire?
- **Ruled out.** Hugh Barlow as the son of Ranulph Barlow of Betley. Ranulph's will, proved 5 March 1639/40, names five children and no Hugh. The child link was removed from the tree.
- **In doubt.** The Staffordshire link. Noah was baptised 25 August 1654 at St Benedict, Norwich, son of Francis Barlow. The Mucklestone Francis was baptised 1638/9, so he would have been 15. Everything above the Norwich Francis is unproven for this line.
- **Proven.** Peter and Judith's three sons named Peter. Separate St Augustine baptisms in 1736, 1738 and 1745.
- **Earliest proven ancestor.** Hugh Barlow, c.1613, per the hypothesis document. Note the same document says the link from the Norwich Francis up to Hugh is unproven, so the build must decide where the solid line starts. The mockup draws it dotted from 1613 to 1654.

## Rules

1. **Living people stay private.** Every person record has `is_deceased`. Anything shared beyond the family shows deceased people only. Living people appear as an unnamed marker or not at all.
2. **Read only by default.** The exploration reads from Iris. It does not change the tree.
3. **Writing back.** If "Add a piece of evidence" is built, it follows the standing rule for the tree: update both nodes and edges so relationships stay intact, and reflect every change in the relevant line view and the Full Family Tree view.
4. **Email addresses are already redacted** in the import for possibly-living people. Keep it that way.

## What is not yet known

These were not checked during the review. Check them first.

(Since built. All five are answered in `docs/data-sources.md` under "What the build confirmed".)

- Whether every person record carries birth and death dates as fields. Dates and places do appear in the element description as text, for example "Born 1871 in New Zealand. Died 1949." That was seen on Carter and Klos records. The one record read in full (a 17th-century spouse) had no date fields. The build may need to parse the description, or read the GEDCOM fields if they exist.
- Whether places come in a form that can be mapped or grouped. Places seen so far are free text: Norwich, Warsaw, Brzeg, Wanganui.
- Who is living. Some records have a birth date and no death date. Check `is_deceased` on each rather than guessing from dates.
- Where the lines actually join. In the mockup, where and when streams merge is illustrative.
- How "certainty" is derived. Candidates: number of citations on a person, a flag on the link, or status taken from the hypothesis document.

## The mockup

`mockup/index.html` is a static picture of one moment: the scrubber at 1862, Peter Barlow selected, the case file open, lens set to surname. Colours, type and layout are a starting point, not a specification.

## A sensible first slice

Not a plan, just the smallest thing that would prove the idea.

1. Pull people and families for the Barlow line only.
2. Draw one stream with real birth years and a working year scrubber.
3. Add one join (the Finch line) from real marriage data.
4. Then the case file as static cards.
