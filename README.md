# The River

An interactive exploration of the Barlow family tree. Fourteen generations drawn as streams that join at each marriage, with a case file beside it for the one question the tree cannot yet answer: where did the Norwich Barlows come from?

Status: built and working. Data is a snapshot exported from Iris on 18 November 2026.

![The whole river, by surname](docs/screenshots/river.png)

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints. `npm run build` writes a static site to `dist/` that can be hosted anywhere.

## What you can do

1. **Scrub the year.** Drag the year on the river or the track below it, or press play (space bar). People light up when born and go dark when they die. The river ahead of the year is shown faintly, people included, and tapping one takes you to their year.
2. **Tap a person.** Their record opens: dates, places, photo, sources, research notes, family, and their life in a few sentences worked out from the people around them ("The 2nd of 7 children. Married at 25. Outlived Elizabeth Short by 18 years."). Their ancestors and descendants light up. "Follow the water" sends a pulse from them downstream to the present.
   - **Related to…** Pick any second person and it says how the two are connected: "3rd cousin once removed", or step by step through marriages when there is no shared blood.
   - **Namesakes.** There are twelve Peter Barlows. One tap lights them all.
   - **What rests on a link.** Every link to parents says how many ancestors depend on it. For a doubted link: "If this link is wrong, 2 people upstream, back to 1612, are not this family's."
3. **Switch the lens.** By surname, by place, or by certainty (keys 1, 2, 3).
4. **Open the case file.** Nine evidence cards, ruled out, in doubt or proven. Tapping one moves the river there and lights the people and the water it bears on. "Walk the evidence" steps through them upriver.
5. **Read the findings.** Counted from the tree by rule, and the ones that belong to a place are starred on the river itself. What it shows: the river reaches New Zealand in 1855, one couple had 14 children, 14% of people cite a record. And what is worth a second look: a parent who would have been 15, a name given twice in six families, people marked living in a generation born before 1921.
6. **Add a piece of evidence.** A draft card, saved in your browser only. It produces a change request to apply in Iris. The site never writes to the tree.

Also: search by name (`/`), zoom and pan, deep links (the address bar carries the year, person, lens and card), and a short guide behind the `?` button.

On a wide screen, play starts close on the headwaters and pulls back as the river grows. On a phone the camera travels with the year.

![The case file open on the family that was ruled out](docs/screenshots/case-file.png)

## The Atlas: the same tree on the Earth

A second mode, at `atlas.html`. The River shows time and doubt. The Atlas adds place. Brief: `BRIEF-ATLAS.md`.

1. **Press play.** A light comes on where each person was born and goes out when they die. Where a death place is recorded, an ember stays. The camera follows the family, and turns to the other side of the world when it goes there.
2. **Two ways to draw the Earth, or both.** A globe, and two shores: Britain and New Zealand drawn large with the ocean folded away, and small insets for Poland and the United States. On a wide screen, globe and shores side by side (keys G, S, B). The globe's camera stays with the family in Europe, crosses to New Zealand once, with the one voyage the records date closely, and stays there.
3. **Tap a light.** The places the records put that person, in order, each with the evidence: born, baptised, census, married, the birth of a child, buried. Then each move, with the years it could have happened in. "Follow the journey" plays that one life.
4. **Tap a place.** Who was born there, who died there, who is only recorded there, and from when to when.
5. **See every country.** A row above the map names each country in the records and counts the lights lit there that year: England, New Zealand, Wales, Poland, Ireland, the United States, and anyone at sea. On the globe, a country out of view is named at the rim in the direction it lies. Tap either to go there and see who it was.
6. **Switch the lens.** By surname, by the first place each person is drawn, or by how well the place is known.
7. **Stars on the map.** A finding that belongs to a place is starred there from the year it happens. Tap it to read it.
8. **Read the findings.** The first of the family in New Zealand, the life that ended farthest from where it began, a couple recorded on both sides of the world in one year, and a move the tree itself doubts.

What it will not pretend to know:

- **A solid light has a record.** It is never drawn anywhere before a record puts the person there, and it dims the longer it is since the last one. A hollow light has no record: the person is drawn where a close relative with a record of their own was last recorded, never earlier than that relative's first record. A child drawn with a parent goes where that parent is next recorded, until sixteen; otherwise a hollow light never moves. A haze is a place known only to a county or country; a country is drawn just offshore, marked "somewhere in". Eighteen people have no place and nobody to borrow from. They are listed, not drawn.
- **A loose year stays loose.** Where the record says "c. 1823", the page says "about 1823", gives no age, and never draws a voyage as sailing on it.
- **When a move happened is almost never recorded.** Where the records pin it to within three years, the light travels. Otherwise it stays where it was last recorded and appears at the new place only in the year a record finds it there.
- **Sea routes are custom, not record.** A voyage to New Zealand is drawn the way ships went at the time: out round the Cape of Good Hope, and through Panama once the canal had opened. The line is not the course of any one ship; where a note in the tree names a ship, it is in that person's record in the River.
- **What stays after a light goes out.** Where a death or burial names a town or parish, an ember. Otherwise a fainter open ring where the light was last placed, which says only that the map last had the person there.
- **Living people are not on the map.** No light, no place.

How it is made: `pipeline/gazetteer.ts` places every place name in the tree by hand, so no family data is sent to a geocoding service. `pipeline/atlas.ts` builds `public/data/atlas.json` from the published `river.json`, never from the raw export, so the Atlas cannot publish anything the River does not. Anyone who died from 1950 on is shown to the town only. The basemap is Natural Earth, bundled (`scripts/build-land.ts` writes it, coarse for the world and detailed for Britain, Ireland and New Zealand); nothing is fetched from a map service.

## How the river is drawn

This replaces the mockup's illustrative joins with real ones.

- **The river is the ancestry of the youngest generation.** Each direct ancestor's line is a stream. Each ancestral marriage is a place where two streams join, drawn at the year of the marriage. Where the marriage year is not recorded it is estimated from the first child.
- **The Barlow line is the trunk.** The other six named lines join it. Smaller springs (Din, Blomfield, Short, Julian, Seaman and about forty more) feed the line they marry into and take its colour.
- **Everyone else rides in the stream of the ancestors they descend from.** The water is as wide as the number of people alive in it that year.
- **Doubt is drawn.** Solid water has a source behind it. Dashed water is a link the tree itself calls a hypothesis. Dotted water is disputed. A flag marks how far up the trunk the evidence runs without a break: ten generations, to John Barlow the worsted weaver.
- **What was ruled out is cut off.** Ranulph Barlow's family, once thought to be Hugh's parents, sits above the river as an oxbow lake with the link crossed through.
- **Before Hugh, three guesses.** The trunk rises from three ghost headwaters: Barlow in Derbyshire, Barlow in Lancashire, or a local Staffordshire line.

## Privacy

The tree holds 109 living people. The rule is enforced when the data file is built, so nothing private ever reaches the page.

- A living person is stored as an opaque id, their links, and a position estimated from their relatives to the nearest decade. No name, date, sex, surname, place or text.
- `is_deceased` decides. A record with no flag counts as living unless it carries a date more than 120 years old.
- Marriages with a living partner have no date.
- Notes and descriptions are published only for people born before 1900 or dead before 1950, and any text that names a living person (by full name, or by a first name only living people have) is dropped.
- The raw Iris export is never committed. `data/raw/` is in `.gitignore`.

`npm test` checks all of this, including a scan of the published file for every living person's name when the raw export is present. The tests also run on every push.

What still shows: the shape of the tree. An unnamed light sits under its named, deceased parents. Decide whether that is acceptable before sharing the link beyond the family.

## Refreshing the data

1. Export the set from Iris: `export_set(set_id="4a2f4562-c930-4fb8-a2cc-0862e6f040bf", format="json")`. Save the result as `data/raw/iris-export.json`.
2. Run the build and the tests:

```bash
npm run data
```

```bash
npm test
```

3. Commit `public/data/river.json` and `public/data/atlas.json`. `npm run data` builds both. If the tree has a place name the gazetteer does not know, the build stops and lists it: add it to `pipeline/gazetteer.ts`.

The case file cards in `src/casefile.ts` are written by hand from the Iris document "Hypothesis: the original Barlow village". When that document changes, update the cards. A test fails if a card points at someone who is no longer in the tree.

## What is here

| Path | What it is |
|---|---|
| `BRIEF.md` | The original build brief |
| `pipeline/` | Iris export to `public/data/river.json`: dates, places, certainty, privacy, leads |
| `src/model/layout.ts` | The river layout: streams, confluences, widths, positions |
| `src/model/kin.ts` | How two people are related, a life in sentences, namesakes, what rests on a link |
| `src/river.ts` | The SVG drawing and the camera |
| `src/main.ts` | The page: timeline, panels, search, deep links |
| `src/casefile.ts` | The open case: evidence cards, tests, story captions |
| `src/evidence.ts` | Draft evidence and the Iris change request |
| `tests/` | Unit tests. `npm test` |
| `scripts/smoke.cjs`, `scripts/smoke-atlas.cjs` | End-to-end tests in a real browser, one per mode. `npm run verify` runs the unit tests, builds, serves the build and runs both |
| `BRIEF-ATLAS.md` | The brief for the Atlas |
| `pipeline/gazetteer.ts`, `pipeline/atlas.ts` | Places set by hand; stops, borrowed places and findings for the Atlas |
| `src/model/journey.ts`, `src/model/geo.ts` | Where a person was in a year; distances and sea routes |
| `src/atlas/` | The Atlas page: `scene.ts` (what is lit), `stage.ts` (globe and two shores), `main.ts` (the page) |
| `mockup/atlas/` | Three working mockups made to choose the Atlas's direction. A and C were built; B, the flat world map, was dropped |
| `pipeline/facts.ts`, `pipeline/leads.ts` | The findings |
| `docs/data-sources.md` | Where the data lives in Iris and what shape it is in |
| `docs/council-report.md` | The Council review that chose this concept |
| `.campaign/` | The Council reviews: five for the River, and those for the Atlas (`council-report-atlas-*.md`) |
| `mockup/` | The original static mockup |

## Publishing

Nothing is published. The built site has been tested served from a `/barlow-river/` sub-path, the way GitHub Pages serves it, and passes every browser check there. `.github/workflows/publish.yml` builds the site and puts it on GitHub Pages, but only when someone presses "Run workflow" on the Actions tab (Pages must be switched on for the repository first, with GitHub Actions as the source). Read the Privacy section before pressing it.

## How the Atlas was reviewed

The Council reviewed the plan, then three mockups, then the build over six rounds, each after an outside tester had been through it. Eight outside passes in all. The reports are in `.campaign/council-report-atlas-*.md`; the last is `council-report-atlas-final.md`.

The last four outside passes checked the placement rules for every person in every year and found no violations. The final full test scored the Atlas 27.5 of 35 on the seven criteria, and 29.5 judging only what the page does with the data it has. Much of the gap is the records: about half the lights are borrowed and only one voyage is dated closely enough to draw sailing.

Where no death is recorded (145 of the 322 people on the map) the light goes out seventy years after birth and leaves no ember. The guide says so.

The voyage routes (round the Cape before 1914, through Panama after) are a convention drawn from general knowledge, not checked against a source.

## Not done

- Writing evidence back to Iris directly. The draft and change request are as far as it goes, on purpose.
- Photos load from Cloudinary and are only shown for the nine deceased people who have one. `npm run verify` checks a real one loads when the image host can be reached.
- The place lens groups free-text places into ten regions. About a third of people have a recorded place. The rest take the place of a close relative and are drawn hollow.
