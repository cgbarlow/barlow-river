# Council report: the Atlas, round 19

Subject: the thirteenth full outside test (commit `595aa84`, a fresh tester), and what was done.

## What the tester found

Verdict on `595aa84`: **no**, on one sentence.

- The owner's four requests: met.
- Rules A1 to A8 and A10 to A12: no violation. 1,539 negative sentences in 302 forms reviewed: none contradicted.
- Every count in every caption and finding recounted true, including all the captions added in rounds 17 and 18.
- The camera now stays within 8 degrees of the ship; the voyage caption is up for the whole crossing.
- Scores: **28.5 of 35 overall, 30 as a build.** Up from 29.5. The bar is 31.

Blocking:
- **D1.** The finding added in round 17, "Noah Barlow: 8 records in Norwich across 65 years", ended "Most lives here are two or three records." Of the 154 people with records of their own, 68 have one, 29 two and 22 three. "Most" is false on any reading.

Minor: the ship off screen for a fifth of a second at departure in "Sail with"; the Key did not show the white ring or the stars; the child-age line skipped undated children without saying so; "some time in that year" for a move between two consecutive years.

## The Council

**Cat.** That sentence was mine in spirit: a line added for colour, in a round whose rule was that every new sentence be counted. It was not counted. The rule stands and is now applied to this round's sentences one by one before the commit.

**Owl.** Replace it with the count. Then the tester's last column again, one item per criterion.

**Bear.** Thirty. One point to go, and the list says where.

**Simon.** Consensus as Owl says.

## What was done

| For | Change |
|---|---|
| D1 | The sentence is replaced by the count: "Of the 154 people on the map with records of their own, 68 have a single one." |
| Interesting | A new finding, counted by century of birth: how many of the people drawn are borrowed (1500s 2 of 5; 1600s 10 of 36; 1700s 61 of 101; 1800s 81 of 162; 1900s 14 of 18). |
| Novel | Each country's panel says from which year to which a light stands there on the map. |
| Delightful | Opening a finding about a voyage lands on the year before, with its people on shore and in view. The camera pulls back with the ship as it leaves, so it does not start off screen. |
| Engaging | A counted caption at 2000, so the last thirty years are not silent. |
| Interactive | The Key shows the white ring and the star, and each swatch shows how many people it lights. |
| Dynamic | Following a person, play slows into a voyage instead of jumping into it. |
| Minor | Child ages say "the first with a recorded date" when some children have none (River too). A move between consecutive years reads "between those two years". Clicking the very ends of the year track gives the first and last year. |

Each sentence added this round was checked against the data before the commit; one interpretive clause was cut for want of a count.

94 unit tests, the River's 59 browser checks and the Atlas's 160 pass.

## Next

A full outside test of this commit, with scores.
