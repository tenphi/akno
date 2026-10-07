# Immutable temporal evidence for automatic retention

This invented, exposed development corpus uses source-author review, not independent review or a
population-accuracy estimate. Automatic retention now selects candidate-local IDs for its already
validated source frames and reads the original candidate text. It no longer generates either deciding
excerpt. Exact timing grounding, independent predicate/status/qualification comparison, typed metadata,
complete coverage and every other semantic guard remain mandatory. No model stage, verification repair,
automatic retry, source partition or budget change is added. Answer/source-reading contracts are unchanged.

The original eight-case corpus and runner are byte-identical to the prior released 0.18.12 cohort.
Five native useful cases cover a long receipt, corrected travel schedule, pending debit, tentative
delivery and a disputed multilingual report; another native case is a one-off task. Two initial
scripted proposals test unsupported delivery completion and author-to-owner inference. Both repetitions
are preserved for every coordinate. The prior released baseline is historical evidence, not a newly
paired baseline, and is kept separate from candidate and eventual released receipts.

The candidate returns five native useful records in 5/10 coordinates and two safely narrowed control
records. All seven were reviewed against the source. Delivery controls undergo existing structural
repair before verification: their qualified estimates are not semantic refusals or acceptance of the
original completed-delivery claim. Ownership returns nothing: one semantic refusal and one invalid
negative-evidence decision. The two task-only runs remain empty. No unsupported return was observed.

The prior released baseline returns seven native useful records in 6/10 coordinates. Its three
`time_witness_invalid` batches are absent in the candidate, which still has four
`context_witness_invalid` batches and one `negative_evidence_inconsistent` batch. These failures hold
nine records, including eight native records; two further records receive valid semantic refusals.
The tentative-delivery refusal correctly identifies omitted recipient context. This does not establish
an overall coverage, latency or accuracy improvement. Context/attribution false holds remain #217/#169;
partial recovery remains #219. Historical missing digest facts have not been recovered.

The separate additional control cohort tests scheduled-to-occurred promotion, borrowing a neighboring
booking date for an undated payment, and pending-to-settled promotion. Across six coordinates it returns
four source-supported narrowed records and two valid semantic refusals. All returned records were
reviewed, and none preserves the original unsupported assertion. Narrowed records are reported separately
from refusals. Both borrowed-date controls explicitly compare the undated completion against the added
date, even though that date appears elsewhere in the same source frame.

| Cohort                                   | Actual logical calls | Endpoint requests | Reported tokens | Scripted initial outputs |
| ---------------------------------------- | -------------------: | ----------------: | --------------: | -----------------------: |
| Prior released baseline, original corpus |                   28 |                28 |          349283 |                        4 |
| Frozen candidate, original corpus        |                   28 |                28 |          339491 |                        4 |
| Frozen candidate, additional controls    |                   10 |                10 |          119200 |                        6 |

All settled calls in these complete cohorts report primary usage and endpoint requests; unknown values
are zero-count observations, not assumed zeros. Cached input and reasoning output are reported subsets,
not additional tokens. Only gpt-6-luna is used live: installed maintenance timeout 600000 ms, no separate
role output limit, provider-default reasoning, retention generation allowance 32768, verifier concurrency
four and batch failure scope. Each deciding request retains complete original source context. Scripted
initial outputs are not live calls; later structural repair and independent verification are live.
Per-call receipts, batch diagnostics, input sizes and wall times remain in the separate JSON artifacts.

An interrupted earlier development run is excluded from acceptance evidence and never pooled or used to
replace repetitions. Four saved coordinates account for eight settled actual calls/requests and 92615
reported tokens. Additional interrupted in-progress call/request/usage is unknown. A prompt review then
made the existing typed time/status obligation explicit before rebuilding and freezing the complete
candidate above. This interruption is development cost, not evidence of zero further usage.

Several review/fix rounds cover immutable ownership, conjunction/shared-subject comparison, translated
calendar rendering, wrong/added/omitted dates, status promotion, incomplete decisions, strict endpoint
schemas, typed diagnostics, persistence/replay and unchanged retry authority. The complete local gate
passes build, lint, dead-code checks, 4917 tests, model-free and installed-package smokes, documentation,
formatting and repository safety. The isolated compiled client/server probe checks the actual strict
frame-ID contract and receipt persistence/replay through restart without extra calls. Publication proof,
pinned adoption and a fresh repeated released cohort are required separately before closing #222.
