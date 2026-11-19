# Council report: the Atlas, round 14

Subject: the eighth full outside test in a row (commit `a548814`, a fresh tester asked to sweep the whole page for one class of sentence), and what was done.

## What the tester found

Verdict on `a548814`: **no**, on one class of point.

- The owner's four requests: met.
- Rules A1 to A11, by the tester's own checker over 437 years, 20,079 lights and two full play-throughs: **no violations**.
- Every first, last and most recounts true. No broken interaction. No console errors.
- All six points from round 13 fixed.
- Scores: 29.5 of 35 overall, 29 as a build.

Blocking, all one class (a sentence saying outright that something is absent when the tree says it somewhere):
- William Henry Carter's panel listed his 1857 emigration and, a few lines down, said "The map reads no dated record of this voyage".
- "No death is recorded" for a woman whose description says "Died Christchurch, New Zealand", with no date.
- "X has no recorded place" for four Polish people whose citations name a cemetery.
- The Poland panel's "have no place recorded".

## The Council

**Cat.** Round 13 fixed the cause for two patterns and left the other sentences as they were. That was half a job and the sweep found the other half. Now do the whole of it: every sentence on the page that asserts an absence is rewritten to say what the map reads, and a check reads every panel, caption, finding and the guide and fails on any bare "not recorded".

**Owl.** And the Carter sentence was simply a bug: the condition looked for the word "arrival" and his record says "emigrated".

**Rabbit.** The guide's list of what the map reads was short by two kinds. Make it exact.

**Wolf.** Eight testers. The owner should hear that the map itself has been clean for all eight, and that every blocker since round 10 has been wording.

**Simon.** Consensus: one sweep, one automated check so it cannot come back, test again.

## What was done

- Every absence sentence in panels, captions, findings, toasts, the guide and the README now says what the map reads: "The map reads no dated death", "no placed record of the kind the map reads", "The map reads no ship or sailing date for this crossing", and so on.
- The voyage sentence no longer claims the voyage is undated. Where the map has a dated arrival or emigration it gives the date; in every case it points to the River for the tree's notes.
- The guide's "What the map reads" lists every kind of record the map uses.
- A browser check opens all 322 person panels, the six country panels, the guide, every caption and every finding, and fails on a bare "not recorded", "no record", "the tree does not", "nobody wrote" and the like.

94 unit tests, the River's 59 browser checks and the Atlas's 160 pass.

## Next

A full outside test of this commit by a fresh tester.
