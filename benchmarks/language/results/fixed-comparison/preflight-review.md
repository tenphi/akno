# Akno fixed-comparison preflight review

## Disposition

Approved for one live comparison of V17, V31, and V77 using the declared fixed corpus. I found no remaining material fairness, source-authority, or semantic-instrumentation blocker in the reviewed runner.

This approval covers the comparison run only. It does not approve a winner, a runtime change, a merge, or a claim of general reliability.

## Reviewed scope

- `run.mjs`, `worker.mjs`, and `common-case.mjs`
- `freeze.mjs`, `declaration.json`, and `candidates.json`
- `corpus.json` and `source-first-obligations.json`
- the completed zero-egress control and the historical candidate build receipts cited by the declaration preparation

The fixed corpus contains 22 predetermined cases: 10 writable and one read-only case in each of the legacy and recent blocks. Two runs and eight query/view/requested-language coordinates produce 352 answer observations per candidate. Corpus IDs and source-obligation IDs are unique and match one-for-one; every obligation entry is approved and contains retention propositions, coupled qualifications, and role/polarity/time/property requirements.

## Fairness and isolation

The final runner applies the same loaded service configuration to every candidate and asserts Luna for derivation and answers, with a 2,400-token derivation ceiling and 1,024-token answer ceiling. Each arm imports its own built public API and protocol. The frozen candidate proof binds the candidate commit, tracked package and lock-file cleanliness, absence of untracked package files, combined core/protocol source and distribution bytes, resolved candidate-local protocol distribution, lock-file hash, absolute Node 22 executable, ABI 127, and a successful candidate-local SQLite load.

The runner recomputes those proofs before creating the live start marker. It also binds the exact corpus file and current source-obligation file to the declaration. The corrected requested-language rule grades each answer against `requestedAnswerLanguage`, independently of the query language.

Candidate execution is sequential within each case and uses a predetermined Latin rotation across case/run positions. This prevents the three arms from competing concurrently for provider capacity while balancing which arm runs first. There are no selective retries.

## Semantic evidence

The common case procedure is identical across arms. It isolates each case's knowledge and state directories, retains and replays the same source, rebuilds the index, reads the retained qualified lines, runs the same recall/context/answer matrix, checks authored-source and read-only bytes, and records typed retention, degradation, availability, retrieval, and answer outcomes.

The worker records model inputs, parsed outputs, usage and endpoint-request receipts as well as public retain/read/recall/context/answer/index results and throws. That is sufficient to localize ordinary model, schema, semantic-verifier, and public-operation failures without using a candidate's positive verifier booleans as source truth. The source-first obligation file remains the grading authority. Full retained-set completeness and focused-answer usefulness are explicitly separate.

The zero-egress control completed for all three arms with eight coordinates, stable bytes, no network attempts, and the expected unavailable result. This exercises historical API loading, the common procedure, IPC, and the rebuilt native dependencies under the declared Node runtime.

## Findings resolved before approval

1. The original launcher trusted ignored historical `dist` files and did not enforce the absolute Node/ABI environment. `freeze.mjs` and the live proof recheck now bind source, distribution, protocol resolution, lock file, executable, version, ABI, and native SQLite loading for every arm.
2. The original `Promise.all` made the declared rotation concurrent, allowing cross-arm provider contention. The final runner executes the rotated order sequentially.
3. The original live check trusted the corpus's embedded fingerprint and did not recheck the source-obligation bytes. The final declaration and runner bind both exact files.
4. The original language principle implied that query language determined output language. It now requires the explicit requested answer language for every crossed coordinate.

## Limits to preserve in interpretation

- `semanticsMatch` is a narrow metadata diagnostic, not an entailment grade. Final comparisons must use source-first review of retained text and answers.
- The broad case catch can collapse an uncaught public-operation exception to `evaluation_operation_failed`; such a case must count as availability loss. The worker trace is diagnostic evidence, not a basis for treating the failure as a sound semantic rejection.
- The corpus is a fixed exposed regression comparison. It supports choosing among these implementations under common conditions; it is secondary generalization evidence.
- Known shared ordinary-prose factual-admission defects cannot distinguish the arms. They remain a mandatory shipping fix with separate verification if the selected arm still contains them.
- Selection must retain the declared zero accepted source, qualification, language, and promotion errors. Coverage, complete retention, retrieval, and availability remain separate metrics; pooling stronger cells cannot rescue a weak block/run.

Subject to those limits, the live three-arm comparison is ready to launch once.
