# V50 code review — round 1

## Findings

No actionable correctness finding in the reviewed V50 implementation.

## Reviewed boundaries

### Multi-span audit and schema integrity

- `retentionFrameAudit` activates only for validated frames with two or more spans. It assigns candidate-local `F1..Fn` IDs from the cleaned frame and sends the original `item_id` and exact quote as input. The model returns only the private ID, interpretation, and bounded relationship enum; it does not reproduce source coordinates.
- The per-candidate dynamic Zod shape requires `span_audit` only when that candidate has a multi-span frame. Array length, enum membership, and unique IDs together enforce exact set equality. Missing, duplicate, foreign, extra, empty-interpretation, unknown-relationship, and truncated responses are covered as malformed verifier outcomes.
- Candidate verdict count/identity checks remain separate from span-coordinate checks. The three semantic booleans and mismatch consistency remain mandatory; `span_audit` cannot override a negative verdict.
- Single-frame candidates retain the prior path without `span_audit`.

### Batching, budget, and provider ceiling

- The implementation correctly uses the actual two-candidate verification batch. The request adds 160 tokens per required audited span on top of the existing per-candidate allowance. At the maximum two 16-span candidates this requests 8,544 tokens; no span audit is silently dropped to fit a smaller cap.
- Boundary tests cover 16+16, 16+1, and 1+1 frames, as well as a real `ModelClient` whose configured 1,111-token ceiling truncates the request and fails closed. The configured provider-role ceiling remains authoritative.
- No additional semantic call or retry was introduced. A malformed/provider failure aborts closed through the existing typed retention-verification degradation; a well-formed semantic negative holds the candidate without misreporting availability.

### Repair and source authority

- Audits are derived from each current candidate's cleaned `discourse_frame`, while `repair_obligations` retain the exact original position separately. The original candidate remains an obligation rather than evidence.
- The mixed admitted/repaired regression checks candidate order, unchanged admitted content, per-candidate frame mapping, full immutable source, and the exact original repair object. Duplicate quote bytes under different item IDs remain distinct coordinates.
- Existing relation closure and the one structural-repair transaction are unchanged.

### Deterministic floors

- The proposal-agency extension recognizes `proposed discussion attributed to NAME` as an unassigned description, but still activates only when readable source prose has a proposer. A separate correctly expressed active proposer satisfies the presence floor, while anonymous-source proposals defer to semantic verification.
- `coverageRolesSupported` is generated-answer-only in this integration and activates from a source clause in which repair is the covered subject. It strips quoted examples and splits independent/contrastive clauses. A source that itself states repair as covering means defers pairing to the semantic verifier. The floor holds the observed Russian repair-as-instrument inversion without rewriting it or accepting it without full verification.
- The nominal Russian assistant construction requires the qualified report noun, exact source label, punctuation boundary, and governed following proposition. Wrong-speaker, unrelated-object, missing-source, and following-clause cases remain rejected. It only satisfies attribution; qualification and semantic verification still run.

## Finite limits

The five-way span relationship is an auditable model judgment rather than proof, and the coverage/proposal/attribution helpers remain bounded lexical floors rather than general parsers. The implementation and documentation preserve those limits. I found no path by which those finite screens bypass the unchanged full semantic verifier, source authority, provider ceiling, or no-retry policy.
