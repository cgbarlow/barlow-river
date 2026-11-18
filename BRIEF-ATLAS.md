# Brief: The Atlas

A second mode for The River. Same tree, same timelapse, drawn on the Earth instead of on a timeline.

## Where this came from

The ask, 18 November 2026:

> conceive of a new mode for barlow-river that does the same timelapse on either a flat map or a globe or both so we get to see births and deaths and migration over time, follow the same criteria and approach as version 1, having the council review the plans at the start and to check the output and to iterate on the council's findings. don't disrupt the current version on main until we've fully tested this.

## The seven criteria

The same seven as version 1 (`BRIEF.md`), each scored 1 to 5. The Council scores the plan, then the build.

| Criterion | Test |
|---|---|
| Interesting | Is the data deep enough to reward a second look? |
| Novel | Does it show something the River does not? |
| Surprising | Can it reveal something its author did not know? |
| Delightful | Is there a personal or playful pull? |
| Engaging | Is there a story with stakes? |
| Interactive | Are there real things to do? |
| Dynamic | Does it move, change over time, or respond live? |

## The concept

The River shows **time** and **doubt**. The Atlas adds **place**, and keeps the other two.

- **Births.** A light comes on where a person was born, in the year they were born.
- **Deaths.** The light goes out where they died, and leaves a faint ember so the map remembers.
- **Migration.** When the records put a person in one place and later in another, the light travels between them along an arc. The arc stays as a trace. Over four centuries the traces add up: Norwich parishes, then Woolwich and London, then the long line to New Zealand in the 1850s, and a separate thread from Poland.
- **Doubt.** A place the record states is a solid light. A place borrowed from a close relative is a hollow one. A place known only to a county or a country is a soft haze, not a pin. A person with no place at all waits in a tray marked "place not recorded" and is never put on the map by guesswork. When a move happened is rarely recorded; the records only say "here by this year". The page says so.

## Globe, map, or both

One control, three settings.

- **Globe.** The Earth turns to follow the family. During play the camera starts over Norfolk and, when the first ship leaves, turns with it to the other side of the world.
- **Map.** A flat world centred so that England and New Zealand are both in view and the voyage does not wrap.
- **Both.** Globe and map side by side (stacked on a phone held upright), linked: same year, same selection, same hover.

Switching between globe and map unrolls one into the other.

## What the user can do

1. **Scrub the year or press play.** Same track, same keys as the River.
2. **Tap a light.** Opens the person: dates, places in order with the year each is known from, what kind of record puts them there, and a link to their full record in the River.
3. **Tap a place.** Lists who was born, lived and died there, and when the family first and last appears there.
4. **Switch the lens.** By surname, by place of birth, by certainty of place.
5. **Follow one person.** Their journey plays alone, stop by stop.
6. **Read the findings.** Counted from the data: the first to cross, the longest journey, the place with the most births, the family whose children were born in three countries, people who died farther than 10,000 km from where they were born.
7. **Go between modes.** Any person in the Atlas opens in the River and the reverse. The year carries over.

## What the data can bear

Measured on the published data file (deceased people only).

| | |
|---|---|
| Deceased people | 340 |
| With at least one recorded place | 110 |
| With a region inferred from a relative (River's rule) | 220 |
| Distinct place strings | 104 |
| People whose own records show a move between towns | about 36 |
| Families with a recorded marriage place | 36 |

Two thirds of people have no place of their own. That is the central risk and the central honesty test. Extra evidence the Atlas can use without guessing: a child's recorded birthplace puts both parents there that year; a marriage place puts both partners there.

## How it will be built

- **Separate page.** `atlas.html` beside `index.html`. The River's code path is not touched except for one link to the Atlas and one "See on the map" link on a record.
- **Gazetteer by hand.** `pipeline/gazetteer.ts` maps every place string in the tree to a name, latitude, longitude and precision (parish, town, county, country). No geocoding service: no family data leaves the build. A test fails when a new place string is neither mapped nor on a short ignore list (the GEDCOM has occupations in some place fields).
- **Derived from the published file.** `public/data/atlas.json` is computed from the already privacy-filtered people, so the Atlas cannot publish anything the River does not.
- **Basemap.** Natural Earth land outlines (public domain), bundled. No tiles, no outside requests.
- **Drawing.** d3-geo projections on a canvas. Hit-testing and keyboard stepping kept in step with the canvas so every person is reachable without a pointer.
- **Voyages.** A move between Europe and New Zealand is drawn along the usual sea route of its era (the Cape before 1870, Suez after), marked as the customary route and not a record of that voyage. Short moves are straight arcs.

## Rules

The four rules of `BRIEF.md` stand. For the Atlas, rule 1 becomes:

1. **Living people are not on the map.** No light, no place, no count by place. The page says how many living people are left out.
2. Read only.
3. Nothing written back.
4. Nothing redacted is restored.

Added for the Atlas:

5. **Street addresses are not published for anyone who died after 1950.** Their places are shown to the town.
6. **No place by guesswork.** Every light on the map can say why it is there.

## Not disturbing version 1

Work stays on the branch `claude/sweet-brown-e2amxn`. `main` is not touched. Nothing is published. The River's 59 browser checks and its unit tests must still pass unchanged alongside the Atlas's own.

## Order of work

1. Gazetteer, stops and journeys, with privacy and coverage tests.
2. Globe and map drawing, year scrubber, births and deaths.
3. Journeys, traces, camera.
4. Person and place panels, lenses, findings, links between modes.
5. Phone layouts, keyboard, guide.
6. Outside testing, Council review of the build, iterate.

## What was decided after the mockups

Three mockups were made before the build (`mockup/atlas/`): A, a globe; B, one flat world map; C, two shores. The Council reviewed them (`.campaign/council-report-atlas-mockups.md`) and the owner said to carry on with its consensus.

- **A and C are built. B is dropped.** At world scale England and New Zealand are one blob each. "Map" in this brief now means Two Shores.
- **The camera does not bounce.** In the mockups the globe swung between Britain and New Zealand whenever the balance of lights shifted. The owner asked for that to stop. The camera now stays in Europe, crosses once, and stays in New Zealand.
- **Other countries are shown.** Asked for by the owner during the build: a row of countries with counts, pointers at the globe's rim, and insets on Two Shores for Poland and the United States.
- **Globe to map does not unroll.** That was the first thing the Council said to cut, and with Two Shores as the map there is nothing to unroll into.
