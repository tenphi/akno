# V77 terminal full-trial source-first forensics

Reviewer: independent Sol review (`/root/language_blind_review`)
Frozen runtime: `a67faa3fd3a6f59450a35c4af1d66baa96fee4e8`

Detailed preserved reviews:

- [Development initial](language-v77-full-development-forensics-initial.md)
- [Development final](language-v77-full-development-forensics-final.md)
- [Held-out initial](language-v77-full-held-out-forensics-initial.md)
- [Held-out final](language-v77-full-held-out-forensics-final.md)

## Split results

| Split | Case-runs / cells | Complete writable retained sets | Published useful / published | Nulls | Typed unavailable cells | Accepted errors | Bytes / replay | Ordinary correct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Development | 22 / 176 | 16 / 20 | 115 / 115 | 61 | 2 | 0 | 22 / 22 | 22 / 22 |
| Held-out | 22 / 176 | 15 / 20 | 105 / 106 | 70 | 0 | 1 | 22 / 22 | 16 / 22 |
| Combined | 44 / 352 | 31 / 40 | 220 / 221 | 131 | 2 | 1 | 44 / 44 | 38 / 44 |

Both splits also contain two read-only case-runs (16 cells) that correctly retain nothing and return policy/no-evidence results. They are outside the writable-set denominator.

## Decision-changing findings

The terminal measurement does not support full acceptance. Retention is incomplete in 9/40 writable case-runs. Development loses both undated records, report run 2's governing report, and alternatives run 2. Held-out loses both nested reports, both assistant-speculation records, and rejected-plan run 2's independent appointment/transport denial. These are source-true losses rather than justified knowledge absence.

The one accepted public error is held-out counterfactual run 2 q5. It cites and states only Ada's non-enrollment, while the query asks for the unrealized internal-spring benefit. It is source-true and correctly translated but nonresponsive. Trace rows 1857–1865 (answer 798; verifier 801) show the accepted path.

Development publishes no material errors in my source-first assessment. Its 45 writable source-true nulls comprise 32 consequences of missing governing retention and 13 answer-stage failures/holds. Held-out has 54 writable source-true nulls: 32 from governing retention loss and 22 later query/view or verifier abstentions. Across both splits, therefore, 99 nulls withhold answerable writable source content; 32 nulls are the correct read-only policy outcomes.

Two development coordinates are typed unavailable: report run 1 q5 after verifier timeout (trace row 145/call 60), and rejected run 2 q7 after verifier request failure (row 3044/call 1304). Held-out has none. Generation failures and local/semantic rejections are distinct from typed availability.

All 44 source trees remain byte-stable and replay successfully. Ordinary projection is correct throughout development. Held-out ordinary mismatches occur for both nested-report, both assistant-speculation, and both competing-hypothesis runs. The first four accompany retention loss. The competing-hypothesis retained prose remains correctly tentative and source-faithful, so those two mismatches are classification/projection failures rather than factual promotion.

## Interpretation boundaries

I use the focused-supported-subset contract: an answer may omit an unrelated retained neighbor, while every asserted clause and coupled qualification must be supported by its own cited record. Under that rule, focused fictional-promise answers need not repeat the separate proposal act when they retain story-only/no-real-agreement scope. That boundary should remain explicit if another adjudicator treats proposal-to-discuss as coupled.

Private verifier narratives and positive booleans are fallible diagnostics. The source and public answer determine correctness. No provider echo, heuristic flag, or noncanonical-eligibility proxy was counted as semantic evidence.

## Terminal scope

No rerun or tuning is warranted within V77. Any later revision should be a separately declared change. Evidence supports prioritizing proposition-complete retention for nested reports, assistant speculation, undated clocks, and competing alternatives; independent factual-neighbor preservation for rejected plans; and query-predicate selection so a true antecedent fact cannot replace the requested counterfactual consequence. Existing source-semantic and language gates should remain mandatory.
