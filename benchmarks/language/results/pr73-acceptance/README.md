# PR 73: full retrieval and independent source review

The bounded query-view fix is measured, and ordinary Markdown now has independently reviewed evidence with
an active vector index and configured reranker. **Issues #61/#62 are not jointly complete.** Cross-language
retention still omits source meaning, and the runtime verifier still accepts unsupported translations.
The full repeated development/held-out acceptance matrix has not passed or been executed on corpus V23.

The [machine-readable summary](summary.json) counts the frozen results below. It does not grant release
eligibility. The earlier [82/84 focused capture](../pr73-live/README.md) and
[historical fixed comparison](../fixed-comparison/README.md) remain unchanged; their different pipelines,
budgets and grading procedures must not be pooled with these results.

## Runtime and review

The retained runtime uses `memory-view-v9`, `prose-v3`, answer generation V68 and answer verification V48.
Bounded English/Russian constructions now recognize relayed messages, assistant speculation, unrealized
benefits, fictional discussion and competing hypotheses. On the exposed V22 query set, inferred views improve
from **36/44 to 44/44**. Positive and negative regressions cover clause boundaries and mixed-language
precedence. This is deterministic view selection, not a live-model interpretation score.

All sources are invented. The independent `gpt-6-astra` reviewer did not author the corpus or tune the runtime.
Its [calibration](independent-calibration.json) passes 14/14 positive/negative controls. Nano's earlier
[13/14 calibration](nano-calibration.json) incorrectly rejects a valid Russian paraphrase and does not qualify
it to establish the acceptance gate. Input and output reviews are preserved separately. Review judgments are
fallible model adjudication, not ground truth.

The low profile uses `gpt-5.6-luna` over Responses with low reasoning, 2,400-token retention/answer ceilings,
120/60-second retention/answer timeouts and zero provider retries. Retrieval uses `text-embedding-3-small`
with 1,536 dimensions and the configured Luna LLM reranker: low reasoning, 1,600 tokens, 30 seconds, top eight,
2,400 characters per item, irrelevant results excluded. Expansion, graph expansion and index model
summaries/facts are disabled. Separate deterministic tests cover graph and maintenance boundaries.

The medium profile changes retention to medium reasoning, 8,192 tokens and 180 seconds, and answers to
medium reasoning, 4,096 tokens and 120 seconds. Its reranker and embedding settings stay the same. This is
an explicit configuration experiment; score differences are not attributed to code changes.

## Independently reviewed results

| Measurement                          | Complete retained sets | Useful answers | Accepted unsupported answers |          Useful unique retrievals | Useful auto-recall contexts |
| ------------------------------------ | ---------------------: | -------------: | ---------------------------: | --------------------------------: | --------------------------: |
| Low, four exposed cases, once        |                    2/4 |          29/32 |                            2 |                             16/16 |                       16/16 |
| Medium, same four cases, once        |                    1/4 |          21/32 |                            3 |                             12/16 |                       12/16 |
| Ordinary Markdown, four cases, twice |  Not a retention trial |          47/48 |                            0 | See frozen retrieval observations |                       24/24 |

Retrieval and context are counted once per query/view, independently of the two requested answer languages.
The answer matrix uses English/Russian queries, English/Russian answers and inferred/explicit views. The
ordinary supplement uses English/Russian/mixed queries and English/Russian answers. The summary also
reports per-query-language, per-answer-language and per-case counts.

The low diagnostic preserves the separate coverage limitation and both competing hypotheses. It omits an
independent unpacked-device fact from the nested report and the actual act of introducing a fictional example
for discussion. Two Russian fictional-loan answers substitute a narrower or broader component for the source's
control dial. One coverage answer is null because required verification is unavailable. All 275 HTTP calls
succeeded: transport success does not establish a valid verification result.

The medium diagnostic retains only the coverage exclusion and loses its coupled sleeve/contract-silence
limits. Its eight coverage answers are source-entailed subsets but incomplete, with qualification marked
incomplete by the reviewer. It also omits the nested independent fact and fictional introducing act, and
publishes three unsupported Russian fictional-loan answers. No answer is null; all 264 HTTP calls succeed.
Neither profile has an accepted answer-language violation or promotion of fictional/reported content to fact.

The ordinary supplement covers an English assertion after an empty sibling heading, an English assistant
report, a Russian assistant report and a mixed-language hypothesis. **18/18 factual-negative controls**
withhold the embedded nonfactual claim from both answers and auto-recall. All 47 published answers preserve
source meaning, qualification, requested language and supporting citations. The single miss is a false hold:
English report, run two, mixed query, Russian answer (`draft_rejected`), with no availability degradation.
Source files and bytes remain stable through indexing, rebuild and reads in **8/8** case-runs. This closes
the focused auto-recall evidence gap in the earlier structural-only run, which activated 0/42 times. The
profiles differ, so this is evidence that configured retrieval works, not an isolated causal speed/quality gain.

Both retained diagnostics preserve files, replay outcomes and archived support records across restart/rebuild
in 4/4 case-runs. The low archive has five support records and ten quote parts; medium has four records and
eight quote parts. Their evidence hashes and exact source-item substring matches are checked. These records
prove the stored quotation bytes, not original unique span boundaries or complete retention of every source
proposition. In particular, the missing introduction can remain in archived evidence while absent from saved
knowledge. That is still incomplete retention.

## Rejected verifier experiments

A candidate V49 audit asked for counterexamples in both translation directions to detect broadened/narrowed
component meaning. A frozen-draft comparison submits the same 14 supported and two unsupported published
drafts once to V48 and once to the candidate, using Luna low reasoning with a 4,096-token role ceiling.
**Both accept all 14 supported drafts and both errors.** The change was withdrawn; production remains V48.
Its compiled candidate snapshots remain as evidence of the unsuccessful experiment.

Using Nano high reasoning on the same 16 drafts with V48 yields four correct accepts, one false hold and
11 unavailable verification results. Both unsupported drafts are unavailable, not successfully rejected.
No Nano verifier role is added. The [independent experiment audit](independent-experiment-review.json)
confirms the fixed inputs, earlier labels and counts. These are verifier-only diagnostics; they measure no
new generation or retention and cannot replace the end-to-end gate.

## Fresh corpus and acceptance status

Corpus V23 promotes the exposed V22 held-out sources to development and adds eleven fresh held-out content
and wording variants of the same scenario structures. It is not evidence of new structural difficulty or
arbitrary multilingual generalization. The development source judgments are explicitly transferred from the
pre-output V22 review. The new held-out sources were independently reviewed before any live execution.
An ambiguous Russian component in the initial draft was clarified before freezing; the original rejected
input/review and the corrected input/review are all preserved.

The final [input review](v23-input-review.json) approves 22/22 source/expectation pairs, bound to corpus hash
`fa6e306b8c2c0d4b001c19af8c00011710964d429e09938f5f367b06105be663`.
**V23 has not been run live.** A runtime/profile must be settled before consuming its held-out cases.

The [acceptance plan](../../pr73-acceptance-plan.md) still requires two complete runs per split, at least
80% complete retention and useful retrieval and 90% useful answers per split/run, at most 5% availability
failures, zero accepted semantic/qualification/language/promotion errors, stable bytes and replay. The
selected diagnostic cases cannot pass that gate, even where a pooled answer percentage exceeds 90%.

| Issue requirement                                                                                        | Current evidence                                                                                            | Status / limit                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| #61 owner-controlled English policy, unset/upgrade behavior, discovery and independent response language | Config/model-language tests; `prose-language.test.ts`; frozen language and ordinary outputs                 | Implemented; live evidence is bounded to the declared English target                                                      |
| #61 exact quotes, existing identities, supplied exact candidates and policy-bound replay                 | Persisted support/hash audit; retention, model-language, revision-language and production integration tests | Exact bytes/replay supported; complete source meaning still fails                                                         |
| #61 cross-language meaning, qualified retrieval and correct answers                                      | Independent low/medium reviews with per-language counts                                                     | **Not accepted:** omissions and accepted translation errors; full repeated V23 matrix pending                             |
| #61 generated maintenance prose and labels                                                               | `models/language.test.ts`, `maintenance/revision-language.test.ts`, observation/reflection/curation suites  | Deterministic policy/authority coverage; these live runs disable model index derivation                                   |
| #62 factual exclusion and useful ordinary assertions/qualified inspection                                | Ordinary 47/48 answers, 24/24 contexts, 18/18 safe factual negatives; fact/graph/maintenance tests          | Supported within bounded scanner scope; one useful answer falsely held                                                    |
| #62 deciding context, stale projection invalidation, direct editor changes and rebuild                   | `kb/prose.test.ts`, `test/prose-language.test.ts`, derive-managed-memory and graph integration tests        | Heading/quote/transcript/mixed/fenced/truncated cases covered; oversized frames remain inspectable with typed degradation |
| #62 unchanged file set and source bytes; original source language preserved                              | Ordinary 8/8 and retained 8/8 byte/replay checks; whole-tree integration tests                              | Passed for measured cases; no source rewrite or semantic classifier required                                              |
| Overall release acceptance                                                                               | Frozen corpora, independent review and complete-matrix adjudicator                                          | **Not complete.** No closing references added for either issue                                                            |

## Evidence and reproduction

- `diagnostic-a/` and `diagnostic-b/`: low-profile frozen sources, manifests, case artifacts, reports and receipts.
- `diagnostic-medium/` and `diagnostic-medium-rest/`: same exposed cases with the declared medium profile.
- `ordinary-full/`: two full focused ordinary runs and all negative controls.
- `diagnostic-public-*.json`, `diagnostic-review-*.json`, `context-review-*.json`, `ordinary-public.json` and
  `ordinary-output-review.json`: exact public review packets and independent judgments. Earlier subset
  packets remain unchanged; the all-case packets are the aggregate authority.
- `specificity-comparison/`, `nano-verifier-comparison/`: fixed draft inputs, variant module snapshots,
  per-result verdicts, public provider messages and transport receipts. Reasoning items and credentials are excluded.
- `diagnostic-runtime/`: original measured runner/module snapshots and the summary reproduction script.
  The unsuccessful candidate is not the retained runtime. `retained-runtime-check.json` verifies the current
  intent/answer/audit production modules match the measured ones; later benchmark additions change the full
  build hash. Manifests keep the original hashes and are never rewritten to suggest a later run occurred.
- `view-matrix.json` and `built-check.json`: final built view comparison and isolated CLI/client socket
  startup/restart checks. They use no models and are not additional live-quality samples.

Use `node scripts/measure-language-acceptance.mjs --live --config CONFIG --corpus v23 --split development
--runs 2 --output NEW_DIRECTORY` for a future complete run; use a separate new directory for held-out.
The config must select all required authorized model roles. Every run uses isolated temporary knowledge bases,
records the resolved model profile and corpus/runtime hashes, saves completed cases incrementally and refuses
to overwrite an existing output directory. `--case` explicitly creates a diagnostic selection.
Use `node scripts/measure-language-reliability.mjs --live --config CONFIG --full-retrieval --path ordinary
--output NEW_DIRECTORY` for the ordinary supplement.

Final validation: build/typecheck, lint, knip, all **4,039 tests** across 154 files, **34 smoke checks** and
repository safety checks pass. Build-only redeploy and a separate isolated built socket startup/restart
check are recorded here. This checkout has no configured live service; no existing service was restarted.
