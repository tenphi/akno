# V50 code review round 2 — initial

Reviewed the uncommitted V50 diff against `146fefc` without reading round 1 or any fresh V20 output. I made no implementation or tracked-file edits and made no live calls. The parent reported the full local gate green at 2,281 tests across 135 files; I also ran the focused retention-frame, coverage-role, proposal-agency, and answer tests (423 tests) and `git diff --check`, all green.

## Finding

### [P1] A terminally truncated verifier batch can be repaired and accepted

**Location:** `packages/core/src/write/retain.ts:827` (initial diff), calling `parseJsonLoose`; repair behavior is in `packages/core/src/models/client.ts:1222-1258`.

The retention verifier passes its response through `parseJsonLoose` before the new exact-set schema. That shared parser deliberately calls `closeTruncatedJson` and appends missing array/object delimiters. Consequently, a syntactically incomplete batch can pass every candidate and source-span check when the substantive verdict objects happen to be complete before the cut.

I reproduced this locally with one invented two-span candidate. The fake verifier returned the otherwise valid `{"verdicts":[verdict]}` body with its final `]}` removed. `runRetain` accepted the candidate (`candidates: 1`, `held: 0`, `degradedReason: null`) after `parseJsonLoose` restored the delimiters. The existing `truncated` test only returns `{"verdicts":[`, so it does not exercise this salvageable boundary. Chat Completions also accepts the returned content without consulting `finish_reason` (`packages/core/src/models/client.ts:693-712`), while the Responses adapter rejects a non-completed status separately.

This contradicts the V50 trial plan and documentation that incomplete or malformed verifier output fails closed. It matters even though all required verdict fields precede the cut: the system has received no complete batch assertion, yet the result can authorize retained writes.

The smallest coherent fix is local to retention verification: parse the verifier envelope with `JSON.parse` (or another complete, non-repairing parser) before applying the schema. Do not change `parseJsonLoose` globally because extraction and summary paths intentionally recover prefixes. Add a regression where a fully populated audited verdict is missing only the final root/array closers; require zero accepted candidates, `retain_verification_failed`, one verifier attempt, and invalid-response reporting. Trailing non-JSON content should fail at this strict boundary too.

## Other reviewed areas

- **Candidate-keyed schema and exact sets:** clean. Each candidate gets a literal discriminator. For audited candidates, exact array length plus the candidate-local frame-ID enum and uniqueness refinement implies the exact span-ID set, while permitting harmless response order changes. The later verdict count, map size, and membership checks reject missing and duplicate candidate verdicts. Identical quote bytes in separate items remain distinct because IDs bind positions rather than quote values.
- **Repair binding and source authority:** clean. Repair obligations are keyed to the repaired candidate's current ID using the original candidate position. The repaired candidate supplies its own validated discourse frame; the prompt states that the original candidate is a proposition constraint and never evidence. The focused test checks both candidate-specific frames and the exact original object.
- **Batch and token bounds:** clean for safety. Verification remains at most two candidates per call, adds 160 requested tokens per audited span, and `ModelClient` applies the configured role ceiling. The maximum validated two-candidate request is bounded. A low ceiling fails closed in the existing transport test. This can still reduce availability for two long frames, and the current code comment that two candidates fit the default ceiling is stronger than the worst-case bound supports, but the V50 plan explicitly keeps the ceiling authoritative and leaves runtime usefulness to the fresh evaluation.
- **No new semantic retry:** clean. The retention loop submits each semantic batch once. Chat transport retains only existing mechanical compatibility retries; the Responses adapter retains its existing bounded incomplete-token retry. V50 adds neither a rejection retry nor a second semantic judgment.
- **Coverage-role floor:** no blocking issue found. Activation is confined to unquoted, clause-local covered-repair source grammar; independent repair-as-coverer source clauses defer to the semantic verifier. The rejection matcher targets the observed Russian instrumental-repair inversion. Its intentionally narrow grammar misses other inversions, so it is a backstop rather than a general role parser; that is documented and does not create an acceptance path.
- **Nominal assistant attribution:** no blocking issue found. The added Russian form requires a supported reporter label, a bounded qualification, the reporting noun, punctuation, and following content. It remains subject to the complete attribution and semantic checks. Negative and punctuation-boundary controls cover the intended expansion.
- **Proposal agency:** no blocking issue found. The new nominal `proposed discussion/review/inspection/action ... attributed to` form prevents an attribution noun phrase from satisfying proposer presence. Actual active/passive/possessive proposer forms and independently anonymous proposals retain their existing exemptions. Unrecognized relative-clause grammar may conservatively hold a valid answer, but it cannot authorize an unsupported proposer.

## Assessment

The required source-span accounting, candidate-keyed exact validation, repaired-position obligation, source authority, bounded allowance, and narrow deterministic floors are coherent. The terminal-truncation acceptance above is a release blocker because it bypasses the stated malformed-batch boundary. After a local strict-parser fix and focused regression, I would consider this code-review scope clean, subject to the planned independent live evaluation of model judgment quality and long-frame availability.
