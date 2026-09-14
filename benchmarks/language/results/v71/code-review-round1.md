# V71 independent code review — round 1

## Disposition

No actionable correctness blocker found in the reviewed diff against `8264afe`.

I reviewed the runtime paths in `write/retain.ts`, `ops/answer-record-rendering.ts`, and `ops/answer.ts`, the new polarity and rendering tests, both endpoint transport coverage, fixture migrations, and `benchmarks/language/v71-trial-plan.md`. I did not call a provider, inspect fresh held-out data, or modify runtime/test code.

## Retention polarity

The new `source_selected_polarity` is required inside every candidate-specific strict verdict branch. It is a closed `affirmed | negated` enum, and the existing exact verdict-ID/set validation remains in front of acceptance. Missing or invalid enums therefore fail the batch schema; duplicate and foreign candidate IDs remain atomic verifier failures.

Acceptance now requires the three existing semantic booleans **and** equality between the verifier's source-side classification and the immutable candidate polarity. A matching polarity cannot override another negative semantic dimension. A mismatch follows the existing semantic hold path and does not relabel the candidate, invoke repair, or trigger a retry. The `candidates.find(...)!` comparison is safe under the preceding exact-ID validation.

The prompt distinguishes the governing selected proposition from incidental negative language: personal nonaction and embedded denial, positive reports with personal limits, unresolved questions, rejected positive acts, and fictional/counterfactual positive predicates are covered by contrastive tests. Those tests supply their expected source polarity independently rather than deriving it from submitted metadata. Mixed-polarity two-candidate transport tests cover Chat and Responses schemas and malformed enum outcomes.

The exact/automatic caller-supplied attestation path remains outside model semantic verification, as declared in the plan. This is a finite pre-existing trust boundary, not a bypass introduced by V71.

## Structured Russian source-clock translation

Activation is narrow and source-readable: exactly one qualified framed record, Russian answer, unknown temporal precision, and retained prose that already satisfies the current deictic, source-relative-anchor, and unknown-clock predicates. Metadata or a private frame alone cannot activate it. Other languages, multiple records, missing frames, dated records, and incomplete clock prose retain their legacy schemas.

For an activated translation, the strict schema requires all three model-owned segments. Their maxima (1,200 + 400 + 398 UTF-16 units) plus the two inserted spaces preserve the existing 2,000-unit materialized-text ceiling exactly. Missing, empty, extra, foreign-ID, copy, legacy-text, and per-segment over-cap shapes fail closed. The server adds only two spaces and preserves the parsed segment order.

The complete joined text is selected by `additionalLanguageProse`, checked under the requested language before acceptance, materialized before local guards, and then passed through the existing full-source verifier and selection/alignment requirements. The integration tests exercise wrong period/direction, omitted nonacceptance/event/proposal-only/processing/calendar clauses, temporal-label scope, local clock failure, language failure, semantic failure, and exact-name preservation. No fallback or additional generation/semantic call is introduced.

When stored and requested languages match, the existing checked copy arm remains available. When configured knowledge language differs, `copy_allowed: false` leaves only the strict structured translate arm. This matches the declared policy without asserting that stored bytes have a language merely from configuration.

## Transport, budget, and limits

The structured clock branch is a strict object rather than a new union when copying is disabled; when copying is allowed it uses the existing supported `anyOf` union. Endpoint tests inspect strict-schema compatibility on both Chat and Responses. The 2,000-character materialized ceiling is unchanged, but character count does not guarantee fit within a token ceiling. Script, JSON structure, private readings, and model reasoning can still exhaust the configured output allowance. Only the frozen provider echoes and semantic probes can establish observed transport fit for their exact payloads; cap failures remain possible and deterministic schema tests do not establish model completion capacity, quality, or latency.

The source-polarity enum is a fallible verifier classification, not proof of source meaning. Likewise, segment names can encourage complete clock rendering but cannot prove it. Safety continues to depend on the unchanged local guards and mandatory semantic verifier. The plan states these limits accurately and does not claim the mocks establish model competence.
