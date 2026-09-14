# V54 code review — round 1

## Disposition

No actionable correctness or safety finding in the reviewed V54 diff.

The implementation preserves the intended authority chain:

- `record_readings` is required only when source frames exist, covers the exact unique framed evidence-ID set, is parsed before blocks are admitted, and is discarded rather than forwarded to verification, public results, or persistence.
- The verifier independently receives the original retained excerpts and bound frames. Each one-block verification call requires the exact cited framed-ID set and separate actor, object/mechanism, and qualification entries.
- Source and answer anchors are checked as exact substrings of the corresponding frame and block. Missing, foreign, duplicate, malformed, generalized, changed, or omitted required alignments fail closed.
- `not_selected` requires a null answer quote and cannot license asserted answer text. It remains available for a genuinely inapplicable category or incidental frame detail.
- Alignment success is conjunctive with the existing proposition, action-role, qualification, and excerpt-selection checks. It cannot override any negative legacy verdict.
- Answer verification remains one call per generated block, with no rejected-block resubmission, semantic retry, or fallback to the older framed schema. Strict JSON parsing prevents truncated-tail salvage.

The per-call budgets are structurally consistent with the existing batching: generation adds a bounded allowance per framed record unless the caller supplies an explicit ceiling, and each verifier call contains one block plus only that block's cited frames. The configured provider-role ceiling remains authoritative. A low caller-supplied `max_answer_tokens` can now fail to fit mandatory readings, but honoring that explicit ceiling is correct fail-closed behavior rather than silently overriding it.

The source-clock addition is bounded to counting from `самой ... записи/заметки`, with the device/detail and cross-sentence negative boundaries intact. The Russian hypothetical-version floor is head/agreement bound and remains only a prerequisite to the unchanged semantic verifier. The retention prompt's coverage-object guidance preserves the source subject rather than authorizing a synonym or repair.

## Finite limits

The three alignment annotations remain fallible model judgments, as documented. Exact quote presence proves coordinates, not semantic equivalence; the independent booleans and prompt contract still carry that decision. A verifier could incorrectly mark an outer reporter name as a preserved action actor or call a material item `not_selected`; the implementation does not claim deterministic semantic proof and does not weaken the prior gate.

The 240-character anchor cap means a material source clause longer than that must be represented by a shorter exact substring. This is compatible with the locating-anchor design, but it should remain documented as a bounded audit rather than complete span coverage.

One useful nonblocking regression would exercise a single generated block citing both framed and nonframed evidence, asserting that readings cover all globally available framed records while verifier alignments cover exactly the framed IDs cited by that block and do not demand an alignment for the nonframed ID. The current implementation follows that rule, but the changed tests primarily cover all-framed and single-frame paths.

## Final bounded recheck

Clean. The final additions preserve the reviewed design:

- Each cited framed record must now have at least one category whose relation is not `not_selected`; an all-inapplicable entry fails schema validation before acceptance. Individual incidental categories may remain `not_selected`, so this does not create exhaustive source-frame coverage.
- The default generation allowance of 512 tokens per framed record is a reasonable bound for the required 320- and 240-character readings plus JSON overhead. Explicit caller limits and the configured provider ceiling still win, so transport can fail closed under a smaller ceiling; this remains a capacity allowance, not a semantic guarantee.
- The mixed framed/nonframed integration proves that generation reads the framed record, a block may cite both records, and verification requires alignment only for the framed citation while retaining both citations. The explicit `max_answer_tokens` case also confirms that the runtime does not silently expand a caller ceiling.
- `verifyDraftBlock` now expresses the already-enforced singleton call invariant directly. Block IDs, citations, per-block frames, call count, and aggregation behavior are unchanged.
- The hypothetical adjective pattern no longer contains the mismatched feminine-case alternative; its bounded head/agreement behavior and mandatory semantic-verifier path remain intact.

These checks establish contract wiring and fail-closed transport behavior. They do not certify the model's semantic alignment labels, which remain fallible comparison judgments conjunctive with the existing verifier dimensions. No actionable finding remains.

## Budget and evaluation-contract recheck

Clean. The final budget adjustment is wired consistently:

- The committed answer-role default and local example are 2,400 tokens. Ordinary unframed generation still requests 1,024; framed generation and one-block verification request their calculated larger budgets, capped by an explicit caller limit and the configured role ceiling.
- The benchmark CLI validates `--answer-output-tokens` as an integer from 1 through 8,192 and applies it through the final `loadConfig` override only to `models.answer.max_output_tokens`. It does not rewrite service configuration or replace retention/provider/model fields.
- Reports record the resolved answer and retention ceilings. The review packet fingerprint includes them when present, preserves historical reports that lack the field, rejects differing budgets between repeated reports, and makes an earlier output review stale when a limit changes.
- Generation and verification use strict JSON for the new framed contracts. The transport-stub regressions cover truncated and trailing responses in both phases; neither is repaired into acceptance. The explicit 777-token test confirms that the caller cap is honored.
- The V54 plan and public documentation accurately distinguish the 2,400-token trial/default from a still-configured 1,024-token live overlay and acknowledge additional cost, latency, and fail-closed truncation risk.

The 2,400 value is capacity, not a proof that every maximum-size multi-frame audit fits. Provider ceilings and verbose outputs can still withhold an answer, and a benchmark run at 2,400 does not establish reliability for a service explicitly kept at 1,024. Those limits are stated rather than hidden. No actionable finding remains.
