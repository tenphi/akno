# First longitudinal baseline

This is the first bounded English retention/timeline slice of #66, evaluated through the built core,
socket and built client. It does not establish completion of the full issue. All source content is
invented; the published receipts contain no source excerpts or answers. Input expectations and output
judgments were reviewed against the original sources by the corpus-authoring Codex agent, without an
independent reviewer. Runtime verifier acceptance is not a quality label.

The source baseline is commit `2a0e641b83540014e353d57f00f5578af63997d5`, package version 0.16.8, on Node
22.22.0. Two fresh repeats per split run extraction-only and maintenance paths through 13 checkpoints:
eight retention checkpoints and five folder checkpoints. The maintained path receives three ordinary
dream cycles per checkpoint. Sources, model roles, budgets and production prompts were fixed before
these v2 measurements. Development and held-out splits ran concurrently; latency comparisons do not
isolate provider load.

## Results

**All four split/arm groups fail the declared gate.** Counts below are covered required propositions,
not counts of complete answers. Every checkpoint is reviewed, including missing output.

| Split       | Arm          | Memory | Timeline | Recall | Context | Answer |
| ----------- | ------------ | ------ | -------- | ------ | ------- | ------ |
| Development | Extract-only | 48/54  | 46/52    | 47/54  | 47/54   | 4/30   |
| Development | Maintained   | 53/54  | 51/52    | 52/54  | 51/54   | 18/30  |
| Held-out    | Extract-only | 47/54  | 45/52    | 46/54  | 46/54   | 9/30   |
| Held-out    | Maintained   | 38/54  | 36/52    | 48/54  | 38/54   | 9/30   |

Development maintenance answer coverage is 60% in each repeat; held-out maintenance ranges from
26.7% to 33.3%. Held-out maintenance memory coverage ranges from 59.3% to 81.5%. These wide changes
in a tiny corpus do not establish a maintenance advantage. Full per-run fractions are in the reports.

The failure ledger records 166 stage/checkpoint entries with missing coverage, reviewed errors or
ambiguous representation. The main findings are:

- **Correction coverage:** one retention update never becomes retained knowledge; the original schedule
  remains through the final checkpoint. Two later answers use that unrevised date as the schedule.
  The correction request did not supply the required replacement memory; its inner hold/rejection cause
  is not captured by this slice. Atomic replacement safety must not be mistaken for correction success.
- **Attribution:** one automatically retained update loses the named reporter entirely. That same
  candidate accounts for 16 natural qualification-loss incidences across four stages and four checkpoints.
  Possessive ownership wording and copied frames with an ambiguous date reporter lose attributed coverage
  under `representation`; they are not additional proven semantic false acceptances.
- **Admission versus fallback:** the maintained held-out folder can answer from an intact raw source
  while its initial timeline remains empty. A distinct appointment and update also remain unretained in
  one repeat. Raw-source retrieval does not mask these failures in memory/timeline coverage.
- **Answer coverage:** 29/64 measured answers are withheld: 16 draft rejections, ten typed unavailable
  verifications, two verification rejections and one no-eligible-evidence outcome. Partial answers also
  omit available schedules or corrections. A withheld draft is not captured here, so this is not a measured
  false-verifier-rejection rate or proof of which model stage caused the omission.
- **Seed and recovery:** the wrong caller-provided warranty is accepted in 8/8 trajectories, reaches
  broad recall/context in 7/8 and answers in 4/8. Explicit retraction plus corrected extraction removes
  the asserted wrong warranty and retains the correct duration in 8/8. Broad recall/context supplies the
  corrected duration in only 2/8 final checkpoints; answers supply it in 5/8. Recovery in storage is not
  sufficient downstream recovery. Tentative assistant guesses never become an established warranty.
- **Mechanics:** all 40 folder checkpoints preserve original source bytes; support hashes remain valid
  in all 104 checkpoints. All 24 replay/restart stability checks preserve active supports and durable
  identities. No distinct-appointment identity link crosses the two appointment identifiers. Later
  timeline clocks never convert a schedule into an occurrence. No full duplicate is judged; separately
  qualified copied frames may still remain as multiple rows, a bounded coalescing concern for #79.

There are 18 naturally produced semantic-error incidences (16 propagated attribution losses and two
stale answers) and 26 seeded incidences. The error's reviewed origin stays separate from the checkpoint
action: the natural attribution loss persists at a seeded checkpoint without becoming a seeded error.
All operation calls finish without a thrown operation failure; this does not mean every model call or
answer verification succeeds. The model receipts separately record ten returned failures.

The named-reporter follow-up is [#169](https://github.com/tenphi/akno/issues/169). Broad subject retrieval
coverage is evidence for [#160](https://github.com/tenphi/akno/issues/160); optional verification of
caller-provided candidates belongs to [#63](https://github.com/tenphi/akno/issues/63). Qualified-row
coalescing remains [#79](https://github.com/tenphi/akno/issues/79). #66 stays open for the declared gaps.

## Resource observations

| Split       | Arm          | Logical model calls | Calls without usage |
| ----------- | ------------ | ------------------- | ------------------- |
| Development | Extract-only | 263                 | 148                 |
| Development | Maintained   | 267                 | 122                 |
| Held-out    | Extract-only | 257                 | 140                 |
| Held-out    | Maintained   | 259                 | 117                 |

Summed operation time by track/arm ranges from 3.8 to 7.3 minutes; this sum excludes fixture/build and
review work and is not total pipeline wall time. Logical calls are not a physical HTTP retry count.
Provider token fields are missing for 527 calls, so aggregate tokens and cost remain null. Per-operation
receipts retain fields actually reported, background calls and summed model latency separately.

Unchanged retention replay records zero maintenance calls. Maintained folder unchanged/restart checkpoints
record 0–11 calls, including pending relationship-link work with applied changes. Three measured dream cycles
make calls while reporting zero applied changes. They may include unfinished relationship assessment;
inner hold/rejection causes are not captured. The fixture does not establish that all such calls were avoidable or that the whole unchanged
checkpoint had no useful progress. Empty source-file changes do not imply an empty relationship backlog.

## Evidence and measurement contract

- `input-review.json` binds the frozen v2 corpus, gates and review limitations before live egress.
- `development-report.json` and `held-out-report.json` bind the complete private packets by fingerprint,
  and publish source-reviewed proposition coverage, error codes, availability, inventory and operation receipts.
- `resources.json` summarizes logical calls, reported usage and operation latency. Missing usage remains
  null; no monetary cost or total pipeline wall time is inferred.
- `runner-fingerprints.json` binds the runner, scorer and corpus files by raw-byte SHA-256. The six compiled runtime
  artifact fingerprints in each report hash JSON-serialized UTF-8 file content, using the same helper as
  corpus and packet fingerprints. They are selected artifacts, not hashes of the entire package tree.
- `failure-ledger.json` lists missing proposition IDs, reviewed codes, origins and typed reasons without prose.

Raw packets and working judgments stay in ignored `bench-results/`. A fresh live run requires configured
providers and source-based review; see [the runner instructions](../../README.md). Deterministic smoke
checks verify transport, accounting and non-passing empty controls, not model quality.

## Interpretation limits

The broad subject query requires both separate same-day appointments in memory, timelines, recall and
context. The answer question names only one appointment; the distinct appointment is excluded from that
answer denominator. The non-temporal warranty is excluded from timeline coverage. Unsupported assistant
speculation and detection of the seeded wrong warranty are optional controls, not required durable facts.

The injected five-year warranty deliberately contradicts its quoted three-year source. Existing provided
exact placement trusts caller interpretation; acceptance here tests that documented boundary and downstream
propagation, rather than identifying an automatic extraction regression. Recovery explicitly retracts the
seed and submits the corrected source through automatic extraction. This is not autonomous error detection.

Every useful proposition must preserve speaker, event identity and schedule qualification. Passage of time
cannot establish occurrence. Attributed conflicting dates may remain in history; duplicate judgments exclude
ledger mirrors of the same identity and separately qualified assertion frames. Error totals count reviewed
stage/checkpoint incidences, not distinct real-world errors.

The index is settled by drain/reopen plus normal indexing before probes. This does not measure immediate
readiness after a write. Replay stability checks active support rows and durable memory identities, not every
ledger byte or relationship-link write. Folder copies are discovered as files; retention copies carry explicit
correlated source groups. The arms compare whole workflows, not a consolidation-only causal effect.
The focused-context check requires empty ambient pinned/timeline arrays; this single-subject corpus does
not independently measure resistance to unrelated evidence in a mixed-domain knowledge base.

Observation/reflection phases are attempted but lack positive admitted fact controls. Controlled source
clocks apply to retention; folder sources use absolute dates. World-clock advancement applies to timeline
queries only. Relative time, pronoun/scope interpretation, dependent synthesis, overview maintenance,
model substitution and broader #66 scenarios remain unmeasured. Two repeats give descriptive ranges only,
not a population reliability estimate or a model capability ceiling.

## Rejected exploratory measurement

The earlier v1 attempts used client-side async accounting that lost context at the socket boundary, and
probed before deferred embeddings settled with a structural-only rebuild. Their zero model-call results,
cache/cost conclusions and affected retrieval measurements are discarded. The server-side accounting repair
is covered by a real HTTP stub whose actual request count and reported token usage match the receipts.
V1 inputs remain frozen; v2 uses fresh held-out wording, identifiers and dates. No production model prompt
was tuned to the exposed outputs.
