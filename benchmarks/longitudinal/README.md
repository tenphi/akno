# Longitudinal memory evaluation

Issue #66's first slice measures English retention/correction and source-folder timeline history through
built core → socket → built client. All inputs are invented. This is an opt-in measurement, not a production
scheduler or a guarantee of memory reliability. Ordinary CI needs no live model.

```sh
pnpm bench:longitudinal --freeze-inputs
pnpm bench:longitudinal --live --split development --runs 2
pnpm bench:longitudinal --live --split held-out --runs 2
pnpm bench:longitudinal --review bench-results/longitudinal-development-packet.json \
  --judgments bench-results/development-review.json --output bench-results/development-report.json
```

The freeze command records `longitudinal-v2`'s corpus fingerprint, source-based input review and declared gates
before outputs. The included input review is by the corpus-authoring agent, **not independent human review**.
Review sources, ordered checkpoints and expectations in `packages/core/src/bench/longitudinal-corpus.ts` before
egress. An independent reviewer can add an external review, but this first baseline must not claim one.

Two independent episodes in each split exercise:

- **Retention:** asserted schedules, unsupported assistant speculation, reordered unchanged replay, correlated
  copies, conflicting speakers, atomic source correction, loss of the last support, explicitly seeded
  provided-candidate contamination, explicit retraction/correction, restart/rebuild and world-clock queries.
- **Folder:** an empty declared source-folder timeline, source copies and alternative dates, explicit
  rescheduling, unchanged cycles and restart/rebuild. Source bytes must remain exact. Source corrections/retractions are tested in the retention track; the folder track adds a separate update notice and preserves the earlier source. Old schedules remain
  history; passing time alone never proves occurrence.

Each repeat starts fresh. Before each graded probe, pending index work is drained by closing/reopening the same built service, followed by ordinary indexing. The explicit rebuild checkpoint uses a normal rebuild. This is a settled-index lifecycle comparison; it does not measure hot-path readiness immediately after a write. `extract-only` uses ordinary automatic extraction/placement with maintenance off.
`maintained` uses the same configured roles, budgets and inputs with three normal dream cycles per checkpoint.
For the folder track the two paths deliberately differ: baseline extraction is invoked directly, whereas
maintenance must discover source files and create its own admitted companion. This compares complete paths,
not consolidation alone. Maintenance is delayed until all inputs in a checkpoint have arrived.

Only resolved providers and derive/answer/embedding roles are copied into an isolated fixture configuration.
No host folder rules, missions, knowledge content or write authority are inherited. Index summaries/facts,
expansion and reranking are disabled; all transforms other than timeline history, observe and reflect are off.
The manifest records these choices. Observe/reflect phases are attempted, but qualified source reports do not
provide the independent canonical fact leaves needed for an eligible observation. The report must expose
actual admission and zero observations instead of claiming positive observation/reflection coverage. Model
substitution, broader synthesis scenarios, relative-time interpretation and positive dependent-conclusion
recovery remain follow-up coverage. No private Brain migration is needed for this tooling.

## Review and grading

Raw packets in ignored `bench-results/` contain invented model prose, quotes, qualifications, queries and
answers. Inspect them locally; do not commit them as publication artifacts. Construct a judgment file:

```json
{
  "version": "longitudinal-review-v1",
  "packetFingerprint": "SHA256_OF_JSON_SERIALIZED_PACKET",
  "reviewer": { "kind": "agent", "id": "Codex", "sourceBased": true, "independent": false },
  "checkpoints": [
    {
      "key": "development-retention/extract-only/1/initial",
      "stages": {
        "memory": { "covered": ["ada-initial"], "errors": [], "abstention": "none" },
        "timeline": { "covered": ["ada-initial"], "errors": [], "abstention": "none" },
        "recall": { "covered": ["ada-initial"], "errors": [], "abstention": "none" },
        "context": { "covered": ["ada-initial"], "errors": [], "abstention": "none" },
        "answer": { "covered": ["ada-initial"], "errors": [], "abstention": "none" }
      }
    }
  ]
}
```

Every coordinate is required, including empty/unavailable outcomes. Match covered proposition IDs only when
both meaning and qualification are preserved in that stage's actual output. Runtime verifier approval is
not ground truth. `unjustified` means useful source-supported output was missing; use `unavailable` for a typed
failure (including an unavailable verifier on a degraded answer) and `not_measured` only for deliberately omitted answers. A withheld answer cannot promote an error.
Possible error codes: unsupported_promotion, qualification_loss, false_corroboration, stale_use, duplicate,
wrong_identity, source_mutation. Triage codes: missing_context, representation, retrieval, model_interpretation,
lifecycle, unknown. Do not infer a cause from a low aggregate score.

A schedule's date, identified appointment and speaker must match. Distinct speakers may retain incompatible
dates; choosing one without deciding evidence fails. Explicit rescheduling must preserve the old assertion
as history where it remains supported, with the update correctly qualified. Copies may add correlated
support, not independent corroboration. Speculation must stay hypothetical, even when an assistant's output
is reintroduced. The seeded wrong warranty is a caller-injected error, never an extraction error; report its
acceptance, propagation and recovery separately. The non-temporal warranty is excluded from timeline coverage. The distinct same-day appointment is required for broad subject memory/recall/context/timeline coverage, but excluded from the answer denominator because that question asks about the other explicitly named appointment.
Mirrored ledger/companion rows with the same durable identity are not duplicate memories.

For each stage, `seededErrors` lists the subset of `errors` caused by deliberately injected caller
contamination (default: empty). Mark origin from the reviewed source trajectory: a natural attribution
loss that persists into a seeded checkpoint remains natural, and a seeded error that survives recovery
remains seeded. The checkpoint's `seeded` flag describes the action, not the origin of all its errors.

The scorer rejects stale fingerprints, omitted/duplicate coordinates, unknown proposition IDs, coverage
without output, and skipped measured stages. Published reports project content-safe receipts and reviewed
codes; sources, answers, endpoints, credentials and provider errors stay out. Gates require zero accepted
meaning/qualification errors, intact sources/support hashes, stable replay, and useful memory/recall ≥90%,
context/answers ≥80%. Small repeated samples are descriptive; they cannot estimate population reliability or
establish a causal model advantage. A source-supported omission is not proof that a verifier falsely rejected a correct draft; the first slice reports missing coverage, not an independently measured verifier false-rejection rate. The first report may fail every gate and still establish an honest baseline.

Source `mentioned_at` is controlled for retention; folder extraction receives absolute dates in its frozen source text. World-clock advancement is exercised by timeline queries only, not by changing the clock of recall or answers.

Operation latency is end-to-end wall time. Model calls are observed without changing requests. Returned model-outcome failures are counted separately from source-reviewed semantic errors and typed answer rejections. Usage is summed
only when every call reports that field; missing usage stays null. No cost is invented. Summary/fact derivation is disabled. Embeddings may run asynchronously after a write; the explicit drain/index barrier settles them before graded probes. Accounting enters at the socket server boundary. Deferred calls retain the originating operation context and are counted after the final drain; background call counts and summed model latency remain separate from operation wall time. Missing provider usage remains null, and no total pipeline cost is inferred. Model-stage latency must not be substituted for operation time.
Production services and their pinned deployments remain unchanged.
The receipt field `cachedMaintenanceCalls` counts dream calls at unchanged-input/restart checkpoints;
it does not certify that every maintenance cache was warm or that relationship work was finished.

## Measurement repair before the first report

The exploratory v1 attempts were rejected as measurement evidence: async accounting was attached to the
client instead of the socket handler, reporting zero model calls despite real requests. They also probed
without draining deferred embeddings and used a structural-only rebuild. No v1 call, cache or cost conclusion
is retained. The corrected runner enters accounting on the server, drains pending work, indexes normally,
and has a deterministic HTTP regression proving that measured requests and reported token usage agree.
The exposed v1 sources remain frozen in `longitudinal-corpus-v1.ts`; v2 uses fresh held-out source wording,
identifiers and dates. Neither this repair nor grader repairs change production prompts or write authority.

The [first baseline](results/first-baseline/README.md) records 104 reviewed live checkpoints, unmet gates,
typed answer failures, usage gaps and the remaining #66 coverage.

## Lifecycle extension and controlled model comparison

The extension adds frozen English inference, discourse and overview trajectories. Read the
[completion report](results/lifecycle-baseline/README.md) before interpreting a score. It records
failed admission controls as well as useful output; it does not certify production reliability.

```sh
pnpm build
pnpm bench:longitudinal:lifecycle --corpus lifecycle --freeze-inputs
pnpm bench:longitudinal:lifecycle --corpus lifecycle --live --split development --runs 2 --derive-model MODEL --output bench-results/lifecycle/model-development-packet.json
pnpm bench:longitudinal:lifecycle --corpus lifecycle --live --split held-out --runs 2 --derive-model MODEL --output bench-results/lifecycle/model-held-out-packet.json
pnpm bench:longitudinal:lifecycle --review PACKET --judgments SOURCE_REVIEW --output SAFE_REPORT
pnpm bench:longitudinal:regressions
```

Repeat both splits with the comparison derive model and the same answer/embedding roles. Each invocation
contains extraction-only and maintained arms, with two fresh isolated repetitions. Raw packets and
source reviews belong under ignored `bench-results/`. The public scorer projects fixed coordinates,
typed judgments, counters and contract metadata; it never copies source text, answers, provider errors,
credentials or endpoints. Freeze the input review in the output directory before any live invocation.
Review the authored sources and expectations before egress, and assess every checkpoint against them.
The checked-in review identity describes this baseline's author review, not independent adjudication.

Select `--corpus inference` for explicit canonical subjects and an unrelated speculative distractor.
Select `inference-control` to script **all page fact derivation** and seed three valid L2 dependencies;
observation, scope, reflection, curation, retrieval and answer calls remain production operations.
Generated pages receive no indexed facts in this control, so it cannot establish live L3 graph recovery.
These are calibration controls on exposed sources, not fresh held-out quality measurements.
`inference-authorized` adds the required `observations/**` inference role to that control.
`inference-leaf-control` scripts only the six designated leaf pages, leaves generated-page fact
derivation live, and includes that inference role. This separates leaf admission from live L3 indexing.
`overview-authorized` runs the overview episodes with a twelve-item high-risk write allowance.
Freeze each selection in its own output directory. Never pool these authority/index interventions
with the original natural-extraction results.

An inference trajectory has six checkpoints, with three bounded maintenance cycles at each; an
overview trajectory has five. Corrections modify a reviewed leaf and reindex it normally; retractions
remove its assertion. Restart/rebuild then tests that excluded dependencies do not return. The fixture
world clock changes page selection and generation context without waiting months. It is not a test of
OS timer/mtime behavior or a multi-day service deployment. Delayed maintenance is an unchanged-input
checkpoint that can finish previously unadmitted work, not a claim that every inventory increase is
a duplicate.

The derive role couples extraction, retention verification, observation, scope assessment, reflection
and curator decisions. Substituting it measures that coupled role, never consolidation alone. The
scripted-index controls remove fact-extraction coupling to different extents; generator and verifier substitutions cannot be separated
without changing the existing production role contract. Corpus/policies/budgets remain fixed within
each comparison, and the compiled production artifacts bind embedded prompts and schema. Provider
seeds and prices are unavailable, so seed/cost stay null. Two repetitions support descriptive min/max
and per-repeat denominators, not a confidence interval or a population ranking. Concurrent provider
load makes measured latency descriptive rather than a controlled speed comparison.

Required positive coverage is an all-or-nothing authored proposition at each stage: a durable L2/L3
output for memory, sufficient qualified evidence for recall/context, and explicit supported meaning
for answers. Reading leaf sources can satisfy retrieval/answer coverage without demonstrating a stored
reflection. Negative exclusion/ambiguity checks stay outside the useful-positive denominator. A withheld
source-supported output is a missed-coverage (`false_hold`) coordinate, not proof that a runtime verifier
incorrectly rejected a particular draft. Typed unavailable verification never earns semantic coverage.
The gate requires zero accepted meaning errors, exact source bytes, no semantic duplicate growth on
replay, focused context, available operations, and at least 80% positive coverage **in every stage**.

Error IDs follow one meaning through stages/checkpoints. `first_observed` is the first reviewed
checkpoint, not proof of the precise internal creation time; subsequent use is `propagated`.
Detection/recovery receipts name the observer and bound, and may remain unresolved. A three-cycle
checkpoint plus drained indexing gives an upper bound on recovery, not the exact failing model call.
Seeded wrong facts, caller-seeded duplicate controls, and naturally generated errors remain distinct.
Current unsupported hypothesis/scenario features (#64/#65), independent review, longer horizons and
component-specific model substitutions are declared limitations, not implied capabilities.

The regression command records existing invented production-path suites for admission, positive L3
reflection and dependency removal, blocked-only plans followed by independent work, co-located
observations, overview scope/quotes/tables/time, adoption rollback and maintenance recovery. Scripted
regressions prove mechanics, not live-model quality. Luna's focused health tests are a separate receipt;
they are not a test of Akno's live memory generation.
