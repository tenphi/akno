# V54 independent code review — round 2

## Scope and result

I reviewed the complete uncommitted V54 diff from `bd4b7ec`, including the final budget/configuration and benchmark-report additions. I read the V54 trial plan and inspected the original-frame binding path, the new private reading/alignment schemas, answer generation and per-block verification, strict parsing, source-clock and tentative-language floors, the retention instruction, benchmark budget metadata, tests and documentation. I made no runtime or tracked-file edits and made no model/provider calls.

**Final assessment: clean; no blocking or actionable correctness finding remains in the reviewed diff.** The implementation keeps the new source comparisons subordinate to the existing three semantic verdict dimensions and retained-excerpt selection. It does not add a public schema, model pass, semantic retry, fallback, or acceptance path. The remaining limitations are explicit and appropriate for the exposed evaluation.

## Findings and resolutions during review

### Resolved — the original 1,024-token role cap defeated the larger audit requests

The first reviewed state requested `1_024 + 1_200 + 900 × framed citations` for verification and `1_024 + 512 × frames` for framed generation, but the committed answer-role ceiling was 1,024. `ModelClient` correctly uses the lower of task and role ceilings, so those larger requests were clipped. One framed verdict can reasonably need more than 1,024 tokens once the existing four comparison fields, mismatch details, excerpt selection and three source-alignment categories are included.

The final diff resolves this coherently:

- [config/default.jsonc](../config/default.jsonc) raises the committed answer-role default to 2,400 and documents latency/cost and fail-closed consequences;
- [config/local.example.jsonc](../config/local.example.jsonc) now uses the same 2,400 value, so the documented OpenAI overlay does not silently restore the obsolete ceiling;
- ordinary generation still asks for 1,024, while framed generation may request 512 more per frame and verification may use the larger role allowance ([answer.ts](../packages/core/src/ops/answer.ts));
- the existing unframed verifier request can also now use up to its 2,224-token task request. This is a real default cost/latency change and is accurately stated in the plan, changeset and language/discourse documentation;
- explicit lower caller limits still constrain generation, and the configured role remains authoritative for every call. The 777-token integration assertion verifies the actual lower-of-two behavior rather than incorrectly expecting a caller request above the role cap to pass through; and
- [bench-language.mjs](../scripts/bench-language.mjs) provides an explicit, validated, one-run `--answer-output-tokens` overlay. Reports record resolved answer and retention ceilings, and [language-review.ts](../packages/core/src/bench/language-review.ts) binds them into the review fingerprint and rejects mixed-budget report sets. The V54 plan explicitly says its 2,400-token results do not establish reliability for the service's preserved 1,024-token local override.

The 2,400 ceiling is a reasonable bounded default for the normal one- or two-frame case and preserves the detailed comparison fields. A block can cite as many as eight framed records, so an unusually large or verbose audit can still exceed it; that failure remains typed and closed rather than being repaired or accepted.

### Resolved — strict parsing initially lacked end-to-end malformed-output tests

The final [answer.test.ts](../packages/core/src/ops/answer.test.ts) exercises both truncated and trailing-content JSON in framed generation and verification. It establishes a null answer, no citations, the correct `invalid_draft` or `verification_unavailable` reason, and one first-pass request per phase with no retry. This covers the production transport path rather than merely unit-testing `JSON.parse`.

### Resolved — a cited framed record could initially mark every audit category `not_selected`

[answer-source-audit.ts](../packages/core/src/ops/answer-source-audit.ts) now requires at least one selected category per cited framed record. Its unit test keeps a genuinely incidental category unselected beside selected object/qualification comparisons and rejects a record whose actor, object/mechanism and qualification are all `not_selected`. This closes the empty-audit escape without making neighboring, unselected source text an answer obligation.

### Resolved — exact caller-cap test and documented example

My focused run of the intermediate diff found the mixed framed/plain integration test expected `max_tokens: 1111`, but the then-active 1,024 role cap correctly emitted 1,024. The test now supplies and observes 777. I also found the tracked local configuration example still pinned the answer role to 1,024 after the default was raised; it now says 2,400. Both were test/documentation defects rather than production acceptance defects.

### Clarified — cross-block frame mixing was prospective, not an observed call-path defect

An initial read of the private verifier helper suggested that a future multi-block batch could require one block to account for another block's frame. Tracing the caller showed that production has always invoked verification once per block. The final code makes this invariant unrepresentable at the helper boundary: `verifyDraftBlock` accepts one block, constructs its cited-frame map only from that block's validated citation IDs, and creates the exact alignment schema from that local map.

The existing multi-block verifier behavior tests establish one request and stable `B1…B12` identity per block; the new mixed framed/plain test establishes that only the framed citation needs a source alignment while both citations remain in ordinary semantic evidence. A separate two-frame/two-block regression was intentionally omitted because it would duplicate an invariant now encoded in the function signature. If batching is ever reintroduced, disjoint frame sets need a new regression before that change ships.

## Binding, authority and gate review

The authoritative original frame remains the existing optional map returned by `retentionSourceFrames`; V54 does not weaken its live tuple/marker/payload/archive-hash checks or its complete-frame and aggregate character limits. Generation receives exact frames only for successfully bound evidence IDs. `answerReadingSchema` requires the complete framed-ID set exactly once, including when the model chooses no draft blocks. Readings are discarded before verification and never enter the result, context, citations or verifier prompt.

After deterministic draft validation, each verifier call derives `citedFrames` from that one block's unique, known evidence IDs. `answerAlignmentSchema` requires exactly that framed-ID set, with one actor, object/mechanism and qualification comparison per record. Source anchors must occur byte-for-byte in that record's bound frame; answer anchors must occur byte-for-byte in the current block. Missing, duplicate or foreign coordinates, foreign quotes, absent answer anchors, `generalized`, `changed` and `omitted` relations all fail. A `not_selected` entry cannot carry answer text and cannot consume all three categories for a cited record.

These anchors are locating evidence, not a deterministic semantic proof. Short repeated substrings and a model's category choice can still be fallible. The prompt and docs say so. Safety continues to require all of the following independently:

1. deterministic draft guards;
2. `proposition_supported`;
3. `action_arguments_preserved`;
4. `qualification_scope_preserved`;
5. consistent comparison/mismatch detail;
6. positive retained-excerpt selection; and
7. a complete supported source alignment for every framed citation.

Thus a false semantic dimension, unselected retained excerpt or negative alignment always withholds the block; no positive audit can override another negative gate.

Mixed framed and unframed citations are handled coherently. Both remain in the cited evidence and existing semantic comparison, while only exact bound frames enter the new schema. Generation must read every available frame, but verification audits only frames actually cited by the current surviving block. Source frames and audit prose remain private.

I also inspected the emitted endpoint schemas offline through the real `toEndpointSchema` serializer. One- and two-ID reading/alignment shapes use ordinary string `enum` IDs and nullable `anyOf` fields, with no discriminated `oneOf` or `const` shape like the earlier incompatible retention transport. Runtime Zod refinements enforce uniqueness and semantic consistency after transport.

## Other V54 changes

The new Russian source-clock expression is bounded to a counting verb, `от самой`, optional source modifiers and a record/note noun. The negative tests prevent an unrelated inspection/detail clock and punctuation-separated noun borrowing. It only satisfies the existing source-relative floor; unknown-date language and full semantic verification remain independently required.

The new `гипотетическ...` branch requires an agreeing form directly before `гипотеза` or `версия`. Cross-clause hypothetical components do not satisfy it, and answer integration still requires the full semantic verifier. It broadens the preliminary language floor for the exact exposed form without authorizing a hypothesis as fact.

The retention change is prompt-only and narrowly tells generation to preserve the grammatical coverage object, including component versus damage/service/repair roles. It changes no deterministic hold, source-span audit, placement rule, schema or retry. Its semantic effectiveness appropriately remains for the independently graded live evaluation rather than a synthetic stub assertion.

## Validation evidence

My final focused run passed **545 tests in 6 files**:

- `packages/core/src/ops/answer-source-audit.test.ts`
- `packages/core/src/ops/answer.test.ts`
- `packages/core/src/timeline/source-clock.test.ts`
- `packages/core/src/bench/language.test.ts`
- `packages/core/src/bench/language-review.test.ts`
- `packages/core/src/bench/answer.test.ts`

I also confirmed `git diff --check` is clean and inspected the generated one-/two-ID audit JSON schemas offline. The parent reports the final complete gate passed with **2,430 tests across 139 files**, build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed-package smoke and repository safety. The parent also reports the compiled invented stub dry reproduction passed in `tmp/v54-compiled-dry.log`. I did not independently rerun the complete gate or treat the dry stub as semantic reliability evidence.

No live corpus or provider call had started when this review completed. The fresh exposed evaluation remains necessary to measure whether the fallible model comparisons improve semantic retention and useful-answer coverage within the declared 2,400-token budget.
