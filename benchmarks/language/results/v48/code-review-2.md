# V48 independent code review — final

Preserved the initial review as `tmp/language-v48-code-review-2-initial.md` and reviewed the revised V48 implementation. This was read-only; I made no runtime edits or live model calls.

## Disposition

Clean within the requested scope. The prior high-priority answerability-boundary finding is fixed; I found no remaining actionable blocker.

## Excerpt-selection enforcement

When any cited evidence in a verification call has a retention frame, the live verifier schema now requires:

- `selected_by_retained_excerpt: boolean`
- `unselected_content: nonempty string | null`

Parsing fails if the selection object is absent. The consistency check requires `selected_by_retained_excerpt` to be true exactly when `unselected_content` is null. Acceptance then requires selection true in addition to the original proposition, action-argument and qualification booleans. A negative selection therefore withholds the block even when all original semantic dimensions are true; missing or contradictory selection fails closed as an invalid structured verdict. No rejected block is retried.

This closes the earlier gap: the frame may constrain the meaning of a proposition selected by the retained excerpt, but an adjacent source-true fact found only in the frame no longer has an acceptance path under a conforming verdict. The tests exercise the concrete frame-only `amberfin` addition with a missing selection object, an explicit false selection, and both inconsistent true/detail and false/null pairs. They also assert that the rejected phrase does not escape in the public result.

The selection check remains a fallible model judgment, as the revised documentation states. It is nevertheless a real enforced contract rather than prompt-only guidance: the schema and acceptance conjunction make malformed, missing, inconsistent or negative judgments fail closed. It uses the same verifier call, model and block isolation, with no retry or acceptance override.

Calls without any source frame retain the prior verifier schema and behavior. Since answer verification is already one block per call, the conditional requirement cannot be accidentally satisfied by a framed sibling block while leaving an unframed block unaudited.

## Provenance and live binding

The strengthened lookup now additionally requires the receipt mode to be `extract_automatic` and the support `input_hash` to equal the receipt's `source_hash`. This excludes provided-mode or mismatched-source archives even if other ids happen to align.

The live payload comparison is byte-exact against the recalled indexed line, while the stored marker/payload hashes remain checked. The executable cases cover whitespace and line-ending changes as stale when the index/evidence is not refreshed, plus CRLF after reindex and an actual file rename as valid live projections. Current projection lookup, unique memory id, marker id, single extracted binding, receipt/candidate/proof tuple, support lifecycle, archive hash and path containment remain required.

Retraction, forget and evidence pruning continue to remove optional frame access. Missing, ambiguous, duplicate, stale, empty, oversized, provided or mismatched state falls back to retained payload only rather than failing recall or answer generation.

## Bounds, privacy and contracts

- Frames remain complete: at most 1,200 characters each and 4,800 total in retrieval order, skipped rather than clipped.
- Generation receives bounded frames with retrieved evidence; verification receives only frames for that block's cited evidence ids.
- Frames and `unselected_content` remain internal model payloads. Public context, citations and `AnswerOutput` do not expose them.
- Evidence-token accounting includes the selected frames.
- The bounded English unresolved-question normalization remains sentence/clause constrained and still proceeds through mandatory semantic verification.
- Prompt/version changes are consistent with the revised verifier contract. Public protocol schemas, storage format, model selection, quality gates and thresholds are unchanged.
- The V48 plan and language documentation now accurately describe both the enforced selection field and its limit as a model judgment rather than a proof.

The remaining finite risk is ordinary verifier error: a model may incorrectly assert that frame-only content was selected by an excerpt. That risk is visible to the required structured audit and remains subject to independent source-only output grading; it is no longer an unrepresented acceptance condition in code.

## Final bounded follow-up

Reviewed the final conjunction/comma-boundary and Zod-refinement changes. No new actionable finding.

The English unresolved-question body now recognizes conjunctions only as whole words, so substrings such as `command` no longer terminate normalization. Treating a comma as a boundary prevents a comma-spliced independent denial from being swallowed with the interrogative scope. The paired command test confirms that a legitimate matching-source question reaches semantic verification for either verdict, while comma, semicolon, sentence and explicit conjunction contrasts retain the separate denial for deterministic screening. This is intentionally conservative: parenthetical comma-heavy questions may still false-hold, but no unsafe acceptance path is introduced and the complete accepted draft remains subject to semantic verification.

Moving selection consistency into `EXCERPT_SELECTION_SCHEMA.refine` preserves the reviewed invariant and improves type inference. A safe-parsed framed verdict cannot reach the acceptance filter with a missing or inconsistent selection pair; the later parse is redundant defensively but cannot change acceptance semantics. Negative selection still withholds, malformed selection still fails closed, and no retry or additional call was added.

The parent reports the final full suite at 2,193 passing tests and the build passing. I did not independently rerun those checks.
