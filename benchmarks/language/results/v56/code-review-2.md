# V56 independent code review — round 2

## Final disposition

Clean after fixes. I found no remaining code blocker in the bounded V56 diff. The complete-record route is limited to one live qualified managed line, one verified source frame, one evidence item and an explicitly resolved answer language. It preserves the public answer/context schemas, call count, strict framed JSON parsing, local guards and all existing semantic gates. Mixed, multiple, reference-bearing, HTML-bearing, unframed and unresolved-language evidence retain the legacy path.

The new retention exception now removes only its one exact permitted offered-action rejection before inspecting the rest of the original source. Clear residual rejection/retraction language, quotation/modal/fiction scope, caller-provided candidates and unsupported semantic verdicts remain held.

## Findings and resolution chronology

### Resolved — residual source retractions escaped the new retention floor

Initial code removed every `was/were rejected` occurrence from the complete source before applying `UNSAFE_DISCOURSE`. A later `The denial was rejected.` could therefore disappear with the allowed `The offered shipment was rejected.` and admit an asserted denial to semantic verification. Although the mandatory verifier could still reject it, the deterministic floor exposed a clear retraction to a fallible positive verdict and contradicted the intended boundary.

The first fix masked only the exact permitted neighbor frame in its own source item, preserving same-item and separate-item retractions. Follow-up review found natural residual variants outside the old adjacent phrase grammar, including `The denial was explicitly rejected.` and `Ada Marlow rejected the denial.` The final code applies a deliberately conservative residual `reject`/`retract`/`withdraw` lexeme check after masking only the permitted neighbor. New same-item, separate-item, passive-modifier and active controls all hold.

This final rule can conservatively hold an unrelated later rejection. That is an intentional availability tradeoff: the exception is an exact narrow admission floor, while the existing semantic verifier remains responsible for the admitted source. It does not claim general natural-language retraction recognition.

### Resolved — complete-record copy inherited a 2,000-character disclosure unit

Generated candidates are capped at 400 characters, but a live managed payload can later be edited or replaced by maintenance. The original `text.length <= 2_000` route would therefore allow substantially more current content to become an indivisible answer than the proposed pilot justified.

The final helper caps the canonical current text at 400 characters, including visible qualification labels. Longer records fall back to legacy composition and are not withheld. Documentation and the trial plan state the same boundary. Including labels in the cap is conservative and avoids a new status-prefix parser; it only reduces pilot coverage.

### Resolved — invalid protocol fixture

The initial `answer-record-rendering.test.ts` fixture declared an `AnswerContextItem` but used `memory.subject: null`, while qualified memory requires a string. It now uses the invented valid value `unresolved`, so the route test represents protocol-admissible evidence.

## Complete-record answer path

`answerRecordRendering` has the required deterministic eligibility boundary:

- a non-null resolved `en`/`ru` output language;
- exactly one evidence item and one frame;
- a page item containing exactly one qualified managed line;
- the frame keyed by that same opaque evidence ID;
- canonical readable text no longer than 400 characters;
- no bracket-bearing reference/citation syntax or HTML-looking tag.

The source frame map is produced by the existing live binding: retained memory ID, page/line tuple, live current payload equality, marker and payload hashes, one extracted support and verified archived evidence hash. The rendering helper uses only the current recalled line. It neither reads configuration to infer the text language nor substitutes receipt/frame/model-reading text.

Canonicalization removes one Markdown list prefix and boundary whitespace, while preserving visible status labels and all interior bytes. The same canonical string goes to the language check, local guards, answer anchors, verifier and output. Reference/HTML-bearing payloads stay on legacy composition so copied text cannot impersonate a server citation or inject an HTML element. Other Markdown presentation remains subject to the application's existing answer rendering/sanitization behavior; V56 adds no new authority or execution path for retained text.

The dynamic generation block is a strict ordinary `z.union`, which emits `anyOf`. The copy branch has only singleton `rendering_mode: copy` and the singleton evidence-ID array; it cannot contain model-authored text. The translation branch requires one bounded text field and the same one-ID array. Unit and integration tests confirm that the emitted schema contains no `oneOf` or `const`, and reject foreign/duplicate IDs, forged copy text, missing/empty/overlong translations, unknown modes and extra branch properties.

For copy, `additionalLanguageProse` validates the generated draft shape and supplies the server-owned canonical text to the existing `ModelClient` language check. The server materializes that same text only after strict framed JSON parsing. For translation, the ordinary generated `text` selection reaches the same language check. A wrong-language copy is withheld without switching branches or retrying. The model chooses copy versus translate; that choice is not treated as stored language provenance.

The materialized `{text, evidence_ids}` draft enters the unchanged `validateDraft` path. Citation identity, protected values, attribution, proposal/personal-action agency, discourse qualification and fiction checks remain mandatory. The verifier receives the immutable source/answer anchors, full bound frame, retained excerpt and `rendering_scope: complete_retained_record`. Its prompt requires every readable retained clause and forbids frame-only additions. Excerpt selection, actor, object/mechanism, qualification, proposition support, action-argument preservation and qualification-scope preservation remain conjunctive acceptance requirements.

`rendering_scope` strengthens the existing verifier instruction; it is not a deterministic clause parser or a new proof. In particular, translation completeness and the copy/translation branch choice remain fallible model judgments. The implementation and docs state that limitation and do not relax any negative semantic result.

The selected-neighbor policy is explicit and tested: a short independent clause already inside the retained payload is copied with the complete record, while an adjacent private original-frame clause is not. This is a deliberate bounded disclosure choice for this pilot. More than one evidence item, more than one frame, mixed framed/unframed evidence and multi-record fiction cannot enter the route, so no record concatenation or cross-citation grouping is introduced.

## Leading independent denial

`leadingIndependentDenial` applies only to automatically generated candidates with exactly one support and one frame. The candidate must be a self-attested user, negated active claim. Its exact support must begin its source item and the exact frame; the support must match the closed English booking/arrangement grammar, and the remainder must be exactly one separately named offered/proposed action rejection.

Existing span cleaning and `spanCoveredByFrame` preserve item identity and exact source membership before this exception runs. The helper additionally requires the permitted frame at the start of that same item. It replaces only that unique frame occurrence with the support denial, reconstructs the complete structured source without modifying other items, then rejects all remaining unsafe discourse, rejection/retraction/withdrawal language and unresolved hypotheses. Quotes, hypothetical introductions, modal rejection, ambiguous `this/assertion` rejections and provided candidates stay held in the regression set.

Passing this helper only bypasses the coarse `UNSAFE_DISCOURSE` hold. It does not admit the memory: the unchanged full-source, candidate-keyed semantic verifier still must return all mandatory positive dimensions, and its negative test produces a verification-stage hold with no repair or retry. The exact vocabulary and word order are intentionally narrow; unsupported passive or non-English variants remain conservative availability losses.

## Budget, API and lifecycle

The answer operation still makes one generation call and one first-pass verifier call for its sole emitted block. The already configured language check remains part of the existing `ModelClient` behavior; copy does not add a detector or retry. Generation retains the framed allowance, the answer role remains bounded by its configured ceiling, translation text remains capped at 2,000 characters, and the copied current payload is capped at 400 characters. Ineligible pilot inputs use the prior schema and behavior rather than failing the request.

No public `AnswerInput`, `AnswerContextItem`, `AnswerOutput`, citation or managed-memory schema changes. Rendering mode and private `complete_record_rendering` data are absent from output. Current context inclusion behaves as before. No knowledge-base or receipt bytes are changed by answering.

## Verification reviewed

Meaningful coverage includes:

- copy, translation, empty selection, wrong-language, forged-copy, semantic-negative and excerpt-selection-negative paths;
- exact downstream language prose, canonical copied output and ordinary citation rendering;
- complete retained neighbor versus excluded private-frame neighbor;
- reference/HTML, long, ordinary, multi-line, missing-frame, foreign-frame, multi-record and unresolved-language fallbacks;
- strict provider schema shape and malformed branch objects;
- existing framed truncation/trailing JSON fail-closed behavior;
- retention admission with both positive and negative semantic verdicts and no repair;
- quotation, hypothetical, modal, ambiguous rejection and same/separate-item retraction negatives.

My final focused run passed **596 tests across three files**:

```text
packages/core/src/ops/answer-record-rendering.test.ts
packages/core/src/write/retain-language.test.ts
packages/core/src/ops/answer.test.ts
```

`git diff --check` passed. Parent-reported validation before the last residual-floor tightening was 2,500 tests across 140 files plus the repository gates; the focused and full final rechecks were still running when this review was written and should be appended as the freeze receipt rather than inferred here.

Freeze verification: the final full suite passed 2,502 tests across 140 files after the residual retraction fix. Build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed-package smoke and repository safety passed. Compiled dry controls passed; post-commit redeployment and provider controls remain separate required steps.

Frozen runtime affce0db9eea99d9f18020dc32cc8b6ee82988a6 was built and restarted with its socket ready. Compiled copy/translation, language, source/selection, strict JSON, retention-denial and existing qualification controls passed. Both invented actual-provider schema controls passed. CI 34307181238 and Documentation 34307181241 completed successfully before the declared exposed probes started.
