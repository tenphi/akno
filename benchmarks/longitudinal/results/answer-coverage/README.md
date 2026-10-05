# Useful answer coverage

Akno #205 addresses unavailable audits discarding independently verified answer blocks.
The answer path now holds only the affected block, preserves other fully verified blocks,
and reports partial coverage with `answer_verification_failed` degradation and optional
`validation.unavailable_blocks`. Semantic rejection remains a separate count. A provider-level
failure stops subsequent calls; unattempted blocks remain unavailable. Held blocks are never
retried, repaired, returned, or allowed to lend evidence to a surviving block.

Composition states supported identity/count positively, avoiding added absence claims about
all records. Candidate readings must copy contiguous literal quotations rather than invented
ellipsis or distributively rewritten clauses. Comparison preserves the independent candidate's
fixed count, including an identified single case without an explicit numeral. Private ordinary
verdicts use brief phrases, retaining every predicate, role, qualification and exact-quote check.
Existing protected-value/discourse guards and installed budgets are unchanged.

The [invented controls](cases.json) and [review/targets](input-review.json) were frozen before
code/prompt changes. Corpus SHA256:
`b25f17fe1763bedde5c48cf6ded6e89b7558a7d2940f98f4c1b94e032c7840e7`.
The target is at least 4/5 useful faithful scripted candidates and 3/5 useful native compositions
in each of two final repetitions, with zero unsupported proposals returned and zero
source-reviewed accepted scope errors. These exposed development controls are not a held-out
accuracy estimate or independent human review.

| Cohort                                   | Faithful scripted answers | Native answers | Unsupported proposals returned |
| ---------------------------------------- | ------------------------- | -------------- | ------------------------------ |
| Released 0.18.7 baseline, one repetition | 4/5                       | 2/5            | 0/11                           |
| Final code, repetition 1                 | 4/5                       | 4/5            | 0/11                           |
| Final code, repetition 2                 | 4/5                       | 3/5            | 0/11                           |

The final cohort contains 42 coordinates and 15 source-reviewed returned answers with no
population/count, reporter or date errors. All returned protocol outcomes remain partial/degraded,
including retrieval degradation from deliberately disabled fixture roles and incomplete seeded
indexing. One separate-case answer returns three of four cases with an explicit unavailable-block
count; the other repetition's grouped draft is wholly unavailable. Native shared-event verification
also varies across repetitions. A compound faithful scripted comparison remains withheld under
the 1024-token ceiling. One competing-date native draft is rejected by the discourse guard, while
the other returns correctly attributed dates. These holds are not useful coverage or proof of
semantic rejection; no complete-answer or broader availability guarantee is claimed.

[Baseline receipts](baseline.json) and [final receipts](results.json) preserve actual returned
text, typed outcomes, validation counts, compiled hashes, per-call roles/latency, endpoint requests
and reported usage. Only `gpt-6-luna` performs live calls: answer ceiling 1024 output tokens, low
reasoning, 60-second timeout. Scripted composition and actual native composition are separate arms.
Valid observation lineage is seeded through ordinary projection; these controls do not establish
natural curation or general lifecycle quality. Embedding/expansion are disabled only inside the
isolated keyword fixture; production settings are unchanged. Source bytes remain unchanged.

The baseline makes 82 actual logical calls / 82 endpoint requests and reports 182629 chat tokens.
The final cohort makes 176 actual logical calls / 176 endpoint requests and reports 407823 chat
tokens, with zero unknown-usage calls in either cohort. Scripted composition calls are separately
counted: 16 baseline and 32 final. Cached input and reasoning output are subsets, not additional
tokens. Prices, missing usage, partial answers and debugging cohorts are never imputed or pooled.
An earlier iteration and stopped fixture/receipt attempts are excluded from these totals.

Deterministic controls distinguish rejection from unavailable audit, malformed audits before/between/
after valid blocks, unavailable source/candidate/comparison reads, a provider failure before or after
a valid block, retained rejection counts when no block survives, and actual/unknown usage accounting.
The existing correction/retraction/restart/rebuild and #199 population-boundary tests remain intact.
The [original frozen #199 negative controls](legacy-negatives.json) also pass: all 11 are
`verification_rejected`, with no returned text. This separate cohort makes 33 actual calls /
33 endpoint requests; its own exact usage is retained in the receipt. Publication,
pinned adoption and source-reviewed released controls are required before #205 closes.
