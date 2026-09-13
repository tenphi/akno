# Independent integration preflight review

## Scope

I independently reviewed the completed `comparison-final.json`, `comparison-postvalidation.json`, `comparison-case-deltas.json`, `integration/selection.json`, `integration/declaration.json`, and the prior structural preparation review. I recomputed the relevant artifact and tool hashes, the isolated candidate proof, and the current configured model policy. I did not execute the live integration, generate model traffic, or change runtime or harness files.

## Binding verification

The selection is bound to the exact completed comparison score, comparison postvalidation, case deltas, and impact-hypothesis artifact. The comparison score is in turn bound to the exact postvalidation artifact. The corpus fingerprint is consistent across the score, postvalidation, and integration declaration.

The current isolated candidate proof exactly matches the declaration:

- commit: `963bf68e3cd07c687007dceaadb4ebb0434613e6`
- package tree: `51a4e04a1a62e36ef2a99d1e66de91da9ddad04eaefed486f96b620db0c565d2`
- Node: `v22.22.0`
- ABI: `127`
- lockfile: `5601a0ad49140516bd4c0afb4f346073d68105b86a74472c4f49102854700b22`

The declaration's hashes match the current corpus, source obligations, integration runner, worker, common case, candidate-proof helper, postvalidator, public validator, scorer, packet formatter, grade assembler, grading contract, and zero-egress control artifact. The current derive, answer, embedding, and expansion model IDs, enablement, output ceilings, timeouts, and reasoning settings exactly match the frozen model policy.

The zero-egress control is bound to the same candidate commit, contains its single expected case receipt, reports zero network attempts, and covers all eight query coordinates.

## Selection review

The completed comparison supports the decision to evaluate one targeted integration under the declared policy:

- No compared arm is rollout eligible. Every arm fails the zero-error and per-block/run coverage requirements.
- The broad V31 port gains five useful answers overall over V77, below the declared eight-answer threshold, while losing legacy-block coverage and retaining accepted answer errors. It does not show a consistent block advantage.
- V17 has stronger legacy coverage but materially weaker recent coverage and substantially more accepted errors, so the results do not support reverting wholesale.
- The selected isolated candidate is presented as a prospective combination of targeted fixes for observed case families and the shared ordinary-Markdown defect. The selection does not assign score credit to those unmeasured fixes.
- The requested integration preserves the frozen corpus, source-first obligations, model ceilings, two runs, all eight coordinates, 80% per-block/run target, separately reported 90% target, and prohibition on selective reruns or further live tuning.

The selection explicitly authorizes only this bounded evaluation. It does not claim that the candidate is reliable, that it passes rollout criteria, or that general rollout is approved. Those conclusions remain contingent on the independently graded and postvalidated integration results.

## Decision

Approved to execute the one frozen integration evaluation. The approval is bound to:

- declaration SHA-256 `3ae4fcb0115329ab38b593638f8ed7d59ccb62170a21f62bed157e041dc99e66`
- selection SHA-256 `68d45a5216e06c0ad1ca9b429bea0c4a4857b1245a38eb34bca202bd08c03d1a`

Any change to either artifact, the candidate proof, corpus, model policy, execution tools, analysis tools, grading contract, or control artifact invalidates this approval through the live runner's hash checks.
