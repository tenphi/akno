# Longitudinal lifecycle baseline

This completes the bounded evaluation in [#66](https://github.com/tenphi/akno/issues/66),
alongside the [first timeline/retention report](../first-baseline/README.md).
There are **736 additional reviewed checkpoints**, two repetitions per split/arm/model,
with 325 Akno deterministic regression tests and 50 separate Luna health tests.
All **48 model/split/arm groups fail** the declared quality gates. Delivering an honest
baseline completes the evaluation; it does not establish that production memory is reliable.

## Artifacts and reproduction

- [reports.json](reports.json): exact contracts, corpus/input-review/packet fingerprints,
  source-based reviewer identity, per-group gates and coverage denominators.
- [checkpoints.jsonl](checkpoints.jsonl): all coordinates, meaning/error origins and first
  observation/propagation, recovery, typed outcomes, useful coverage and safe operation receipts.
- [resources.json](resources.json): each repeat's coverage and operation-stage resource totals,
  including unchanged-input maintenance cost and missing usage.
- [deterministic-regressions.json](deterministic-regressions.json): source fingerprints and
  325 passed test outcomes. Scripted production-path mechanics, not live-model quality.
- [luna-health-regressions.json](luna-health-regressions.json): pinned host source/test receipt;
  reachable/writable, paused maintenance, latest failed full cycle, independent phase success
  and unavailable status remain distinct. No Luna code change was needed.
- [manifest.json](manifest.json): production base, published runner/source fingerprints,
  evidence boundaries and follow-up ledger. Publication hashes do not pretend to be
  retrospectively captured per-run instrumentation hashes.

Use the [documented commands](../../README.md#lifecycle-extension-and-controlled-model-comparison).
For each selection below, freeze the input manifest before egress, then run development and
held-out splits with `--runs 2` for both derive IDs. Each invocation contains both arms.
Review full raw checkpoint prose against the authored corpus; pass that source-based review
to `--review PACKET --judgments REVIEW`. Raw packets stay in ignored `bench-results/`.
The committed metadata ledger retains every judgment but deliberately omits source/model prose.

```sh
pnpm build
pnpm bench:longitudinal:lifecycle --corpus inference-leaf-control --freeze-inputs
pnpm bench:longitudinal:lifecycle --corpus inference-leaf-control --live --split development --runs 2 --derive-model gpt-5.6-luna --output bench-results/inference-leaf-control/luna-development-packet.json
pnpm bench:longitudinal:lifecycle --corpus inference-leaf-control --live --split held-out --runs 2 --derive-model gpt-6-luna --output bench-results/inference-leaf-control/next-held-out-packet.json
pnpm bench:longitudinal:regressions
```

The example is two matrix cells, not the complete comparison. Repeat the other model/split
cells and the other selections. Live runs require configured provider access; ordinary CI
uses deterministic no-model and local HTTP controls. No fixture uses the private Brain.

## Fixed pipeline and declared interventions

Production behavior is from `716547c36c881cf05c020e59ef343ba8f7655591` (#170); these changes
add internal evaluation tooling. Eleven compiled artifact hashes bind production prompts,
schema and socket/client code. Derive compares `gpt-5.6-luna` and `gpt-6-luna`; answer remains
`gpt-5.6-luna`, embeddings `text-embedding-qwen3-embedding-0.6b`. Provider identity is a hash,
never an endpoint or credential. Model IDs are configured aliases, not a provider's immutable
snapshot guarantee. The derive role couples extraction, retention verification, observation,
scope assessment, reflection and curator decisions; this is not a consolidation-only comparison.

All fixtures are isolated and invented English sources. Retrieval budget is 6000 tokens,
answer request budget 2400 (the recorded answer role caps output at 1024), three bounded dream
cycles per maintained checkpoint, twelve items/files, 65536 write bytes. Expansion, reranking,
index summaries and unrelated maintenance transforms are off. Automatic context explicitly
excludes ambient pinned/timeline history. Inference enables fact indexing; discourse/overview
use their recorded ordinary qualified-prose paths. Declared source clocks and a fixed fixture
process clock exercise selection/generation/verification; this is not an OS timer/mtime test.

| Selection                | Checkpoints | Indexing / authority                                                                    | Interpretation                                                                                                  |
| ------------------------ | ----------: | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `lifecycle`              |         272 | Natural indexing, zero high-risk writes                                                 | Frozen inference, discourse, overview baseline; identity and write-admission gaps explicit                      |
| `inference`              |          96 | Natural indexing, explicit canonical subjects                                           | Fresh inference sources after the original identity admission gap                                               |
| `inference-control`      |          96 | Script all page fact derivation; seed valid L2                                          | Leaf-admission calibration; generated pages receive no indexed facts; L3 writes lack the correct namespace role |
| `inference-authorized`   |          96 | Same all-page index control; inference namespace allowed                                | Exposed-source authority control; not evidence of live L3 graph-fact recovery                                   |
| `inference-leaf-control` |          96 | Script only six source leaves; ordinary indexing elsewhere; inference namespace allowed | Valid L2 lineage plus live downstream generation/read/recovery control                                          |
| `overview-authorized`    |          80 | Natural indexing; twelve high-risk writes allowed                                       | Exposed-source membership/time control after correcting the original write-budget precondition                  |

The four controls reuse exposed sources and are **not fresh held-out quality estimates**.
They are never pooled into the original natural-extraction score. Corpus, budgets, policies,
review rules and production code stay fixed within each comparison. Failed controls stay
published; changing authority cannot be relabeled as improved model quality. Model seeds and
prices are unavailable. Two repetitions support descriptive counts/ranges, not confidence
intervals, causal superiority or population reliability. Concurrent load also prevents a
controlled model-speed comparison. Input/output review is by the corpus-authoring Codex agent,
not an independent human or model judge. Ambiguous output is conservatively excluded from
positive coverage; an omitted qualifier is not automatically an accepted invented fact.

## Gates and useful coverage

Predeclared gates require zero accepted unsupported meaning/qualification errors, intact
protected source leaves, zero semantic duplicate growth on unchanged replay, focused context,
available operations, and **at least 80% useful positive coverage in every stage**. A negative
ambiguity/exclusion check cannot compensate for missing supported output. Memory positives
require a durable bounded L2 or L3; raw leaf text alone cannot earn that score. Recall/answer
may earn coverage from complete qualified raw evidence without proving a stored reflection.
`false_hold` means missing useful source-supported output, not an independently measured
verifier false-rejection rate. A typed unavailable stage receives no semantic coverage.

Every group fails. Sources remain byte exact at every graded checkpoint, context remains
focused, and no reviewed natural full semantic duplicate grows on unchanged replay. Some
unchanged cycles finish previously unadmitted work; inventory growth is not automatically a
duplicate. Caller-seeded observations can overlap valid naturally generated patterns: those
duplicate incidences retain seeded origin and are not extraction errors. External discourse
input is supplied through retention; its fixture files are writable destinations, not protected
source leaves. The source-byte gate for that track does not claim a filesystem source audit.

The tables below aggregate two repetitions only within the same fixed experiment/split/arm.
Each entry is covered/required positive propositions, not a count of correct tokens or rows.
Per-repeat denominators, stage outcomes and resources are retained in the linked artifacts.

### lifecycle

| Derive | Split       | Arm          | Memory | Recall | Context | Answer |
| ------ | ----------- | ------------ | ------ | ------ | ------- | ------ |
| 5.6    | development | extract-only | 15/42  | 21/42  | 10/42   | 14/34  |
| 5.6    | development | maintained   | 14/42  | 20/42  | 10/42   | 17/34  |
| 5.6    | held-out    | extract-only | 16/42  | 22/42  | 10/42   | 18/34  |
| 5.6    | held-out    | maintained   | 19/42  | 25/42  | 10/42   | 21/34  |
| 6      | development | extract-only | 16/42  | 22/42  | 10/42   | 16/34  |
| 6      | development | maintained   | 18/42  | 24/42  | 10/42   | 19/34  |
| 6      | held-out    | extract-only | 24/42  | 29/42  | 10/42   | 21/34  |
| 6      | held-out    | maintained   | 24/42  | 30/42  | 10/42   | 17/34  |

### inference

| Derive | Split       | Arm          | Memory | Recall | Context | Answer |
| ------ | ----------- | ------------ | ------ | ------ | ------- | ------ |
| 5.6    | development | extract-only | 0/6    | 0/6    | 0/6     | 0/4    |
| 5.6    | development | maintained   | 0/6    | 0/6    | 0/6     | 0/4    |
| 5.6    | held-out    | extract-only | 0/6    | 0/6    | 0/6     | 4/4    |
| 5.6    | held-out    | maintained   | 0/6    | 0/6    | 0/6     | 3/4    |
| 6      | development | extract-only | 0/6    | 0/6    | 0/6     | 0/4    |
| 6      | development | maintained   | 0/6    | 0/6    | 0/6     | 0/4    |
| 6      | held-out    | extract-only | 0/6    | 0/6    | 0/6     | 2/4    |
| 6      | held-out    | maintained   | 0/6    | 0/6    | 0/6     | 3/4    |

### overview-authorized

| Derive | Split       | Arm          | Memory | Recall | Context | Answer |
| ------ | ----------- | ------------ | ------ | ------ | ------- | ------ |
| 5.6    | development | extract-only | 10/20  | 16/20  | 10/20   | 10/18  |
| 5.6    | development | maintained   | 16/20  | 16/20  | 16/20   | 10/18  |
| 5.6    | held-out    | extract-only | 10/20  | 16/20  | 10/20   | 10/18  |
| 5.6    | held-out    | maintained   | 18/20  | 18/20  | 18/20   | 12/18  |
| 6      | development | extract-only | 10/20  | 16/20  | 10/20   | 12/18  |
| 6      | development | maintained   | 20/20  | 20/20  | 20/20   | 12/18  |
| 6      | held-out    | extract-only | 10/20  | 16/20  | 10/20   | 14/18  |
| 6      | held-out    | maintained   | 20/20  | 20/20  | 20/20   | 10/18  |

### inference-leaf-control

| Derive | Split       | Arm          | Memory | Recall | Context | Answer |
| ------ | ----------- | ------------ | ------ | ------ | ------- | ------ |
| 5.6    | development | extract-only | 0/6    | 2/6    | 0/6     | 2/4    |
| 5.6    | development | maintained   | 1/6    | 2/6    | 0/6     | 1/4    |
| 5.6    | held-out    | extract-only | 0/6    | 2/6    | 0/6     | 4/4    |
| 5.6    | held-out    | maintained   | 2/6    | 2/6    | 0/6     | 0/4    |
| 6      | development | extract-only | 0/6    | 2/6    | 0/6     | 1/4    |
| 6      | development | maintained   | 0/6    | 2/6    | 0/6     | 1/4    |
| 6      | held-out    | extract-only | 0/6    | 2/6    | 0/6     | 3/4    |
| 6      | held-out    | maintained   | 0/6    | 2/6    | 0/6     | 3/4    |

## Findings and ownership

- **Later deciding turns/current correction:** seven discourse trajectories first expose an
  accepted stale decision, with eighteen answer-stage incidences across later checkpoints.
  Five expose an eligible stale booked departure after correction, with twelve memory/recall/
  answer incidences. Explicit booking retraction plus rebuild recovers the latter in all five,
  bounded by three cycles and drained indexing. The deciding-turn errors remain unresolved;
  removing unrelated bookings is not recovery. [#172](https://github.com/tenphi/akno/issues/172).
- **Overview preconditions and freshness:** the original zero-high-risk-budget overview
  cannot establish a failure of authorized writes. With the recorded allowance, all eight
  maintained controls add the new member; five classify past schedules correctly. Three retain
  Upcoming through rebuild, adding eighteen stale memory/recall/context incidences. The eight
  extraction-only controls intentionally do not maintain the page and add forty-eight baseline
  stale incidences. No reviewed answer invents occurrence. [#171](https://github.com/tenphi/akno/issues/171).
- **Inference admission/usefulness:** original canonical-identity controls do not admit the
  intended L2 seed. Explicit canonical natural sources still miss complete useful L2/L3
  memory and often omit qualified evidence. These cannot prove higher-tier recovery. Valid
  leaf controls admit all three seeded L2 dependencies in all sixteen trajectories; after
  correction/removal their affected eligibility clears and remains excluded after rebuild.
  Partial naturally generated observations remain useful but do not earn all-subject coverage.
  [#174](https://github.com/tenphi/akno/issues/174).
- **Readable stale reflection:** the leaf-only control produces three correctly bounded L3
  pages in eight maintained trajectories. Their old conclusion remains factual/answer-eligible
  in reads after support changes/removal, and two remain in recall through rebuild: fifteen
  incidences across three error trajectories. No indexed L3 fact rows were produced, even with
  ordinary indexing elsewhere. This measures prose/read eligibility, not proven traversal of
  an eligible L3 graph fact. No reviewed answer reuses that stale conclusion. The earlier
  all-page-index authority control has three additional stale-page trajectories/twelve
  incidences with a declared indexing confound. [#173](https://github.com/tenphi/akno/issues/173).
- **Sample-scope loss:** one leaf-control observation turns two recorded journey sessions
  into an ongoing pre-departure practice. It propagates into memory/recall across three
  checkpoints (six incidences); removing its leaves makes it ineligible within the three-cycle
  checkpoint bound. It is a natural error even at the seeded checkpoint. [#174](https://github.com/tenphi/akno/issues/174).
- **Retrieval/context:** explicit inference automatic context is empty in these runs; broad
  recall often misses two leaf sessions, and readable principles need not be retrieved.
  Record selection/completeness boundaries before attributing this to a model's intelligence.
  [#160](https://github.com/tenphi/akno/issues/160). Qualified related rows are not automatically
  full duplicates; coherent integration remains [#79](https://github.com/tenphi/akno/issues/79).

`first_observed` names the first reviewed checkpoint/stage, not a proven internal creation
call. Later same-meaning use is `propagated`. Recovery is source-reviewed and explicitly bounded;
these probes do not continuously observe the exact detection instant. Negative tests preserve
unresolved actor/source-clock ambiguity, document scope, unselected proposals and assistant
speculation; the first timeline report separately measures named reporters, correlated supports,
conflicting dates, rescheduling and caller-injected wrong-fact contamination. Its failed gates
and [#169](https://github.com/tenphi/akno/issues/169) attribution follow-up remain unchanged.

## Resources and review rounds

Operations have measured end-to-end wall latency. Summed model latency is separate and may
exceed wall latency through concurrency/deferred work. Summed operation wall time omits
inter-operation overhead and must not be called complete checkpoint latency. `calls` counts
logical model invocations; endpoint request counts are nullable. Scripted index interceptions
are counted separately and incur no reported provider usage. Provider failures differ from
semantic failures and typed answer holds. Missing token fields make their aggregate null;
no dollar cost is invented. Unchanged-input maintenance calls, held/applied items and operation
time are retained so expensive no-progress work remains visible without claiming every cache
was warm. [resources.json](resources.json) contains each repeat and stage, permitting honest
min/max comparisons; the raw invented provider/model prose stays private to the local run.

Review/fix rounds corrected canonical identity preconditions, disclosed high-risk/namespace
write limits, separated all-page versus leaf-only derivation, and added indexed-fact versus
readable-page counters. Scorer review rejects stale/input-review hashes, incomplete or reordered
coordinates, changed error origins, fabricated recovery, positive scores without output,
unavailable-as-success and arbitrary receipt prose. Local HTTP tests prove exact request/usage
accounting and that nonleaf indexing is live only in the leaf control. These repairs improve
measurement; no production prompt, model setting or private write permission was tuned to pass.

## Acceptance coverage and remaining limits

| #66 requirement                                                         | Delivered evidence / limit                                                                                                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versioned bounded sequence and policy/prompt/schema/model artifacts     | Frozen corpus and input review, exact compiled contracts, complete checkpoint ledger; seeds/cost unavailable explicitly                                               |
| Unchanged input, correction/retraction, downstream use, restart/rebuild | Both arms and splits; actual reads/recall/focused context/answers with settled indexing                                                                               |
| Creation versus propagation/detection/recovery                          | Stable per-trajectory error IDs; first observed/propagated plus observed recovered/unresolved bounds; no invented exact detection time                                |
| Correlation, speculation and stale dependents                           | First timeline baseline plus discourse and admitted L2/L3 controls; unsupported features #64/#65 remain gaps                                                          |
| Useful coverage and false holds                                         | Positive stage denominators, negative checks excluded, unavailable distinct, always-abstain smoke fails                                                               |
| Fixed extraction-only/model comparison                                  | Two derive substitutions, fixed answer/embedding, two repeats, declared coupled role and exposed intervention controls                                                |
| Triage and honest failed baseline                                       | Source-based codes and #169/#171–#174/#160 ownership; unknown boundaries remain unknown                                                                               |
| Overview and stopped-maintenance additions                              | Live admitted overview/time/quote/table/member controls; deterministic missing-scope/legacy-link/adoption/rollback/pause/recovery tests; separate Luna health receipt |

Positive L3 generation and downstream stale use are now exercised where admitted; fully
eligible live L3 graph-fact traversal/recovery remains an explicit unmeasured boundary.
Longer horizons, independent review, isolated generator/verifier substitutions and new
hypothesis/scenario behavior are follow-ups, not implied capabilities or evaluation prerequisites.
There is no production package behavior change, changeset, service restart or Brain migration.
