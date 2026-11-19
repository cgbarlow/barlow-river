# Council report: the Atlas, round 13

Subject: the seventh full outside test in a row (commit `0dde5e1`, a fresh tester), and what was done.

## What the tester found

Verdict on `0dde5e1`: **no**, on one point, with a caveat the tester stated itself.

- The owner's four requests: met.
- All eleven rules, every whole year and two full play-throughs, by the tester's own checker: **no violations**.
- Every caption, finding and count recounts true. All 619 stops are backed by a record. No console errors from the page.
- The blocker from round 12 is fixed for the person it named.
- Scores: 28 of 35 overall, 27 as a build.

Blocking:
- **D1.** William Henry Carter's panel said "The records here do not date the voyage". The tree's own description of him says "Emigrated to Wellington in 1857". The same cause in Mary Ann Seaman's panel: "birthplace not recorded", where her description says "Baptised 5 Mar 1815 at Westfield". The tester's caveat: these facts sit in the free-text description, which the map did not read; if that is out of scope, the point is minor.

Minor: an order of two same-year records the dates do settle; a ring's wording for four people whose death record names only a county or country; two Welsh places keyed "Elsewhere in England"; "c. 1808" for "after 1808" in lists; "b." for a baptism date in one header.

## The Council

**Cat.** The tester is right to block and right about the cause. For three rounds the false sentence has been the same sentence: the page saying "no record" when it means "no record I read". Fixing the people one at a time will not end it. Two things will. Read the dated, placed facts the descriptions state. And never say "no record": say what the map reads, and say once, in the guide, what that is.

**Owl.** Both. The descriptions hold nineteen dated sentences; two patterns among them are a date, a place and nothing to interpret: "Baptised D at P" and "Emigrated to P in Y". Read those two. Do not parse the rest.

**Rabbit.** And the guide should send people to the River for the notes.

**Wolf.** Tell the owner plainly: seven testers. The blockers went ten, ten, five, two, four, one, one. The last two were one sentence each.

**Bear, Puppy.** Agreed.

**Simon.** Consensus: fix the cause, not the instance; fix the five minors; test again.

## What was done

| Point | Fix |
|---|---|
| D1, the cause | The map reads a baptism or emigration that a person's description states with a date and a place. Mary Ann Seaman is now placed at Westfield by her baptism; William Henry Carter is in Wellington from 1857. |
| D1, the wording | No sentence says "no record" or "not recorded" outright. They say what the map reads. The guide has a new paragraph, "What the map reads", and points to the River for notes. |
| Same-year order | Two records in one year with full dates are given in order. |
| Ring wording | "At the last place the map has for them." |
| Welsh places | Keyed "Elsewhere". |
| "after 1808" | In lists, search and tooltips too. |
| Baptism in a header | "bapt." |

94 unit tests, the River's 59 browser checks and the Atlas's 158 pass.

## Next

A full outside test of this commit by a fresh tester.
