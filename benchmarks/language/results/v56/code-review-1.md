# V56 code review — round 1

## Findings

### High — exact copy can emit model-authored citation-looking Markdown because no presentation guard exists

`packages/core/src/ops/answer-record-rendering.ts` materializes the entire current managed payload, and `packages/core/src/ops/answer.ts` then passes it through `validateDraft`. That function validates evidence IDs, values, attribution, discourse, agency, and semantic status, but it does not reject citation labels or general Markdown/HTML-looking presentation. The normal generator is merely instructed not to write citation markers; in `copy` mode the generator never supplies the text and cannot follow that instruction.

A current qualified line such as an otherwise valid invented record ending in `[other/page:99]` can therefore be copied into the answer and then receive Akno's real citation suffix as well. The copied bracketed string is mutable public prose, not a validated `AnswerCitation`, but appears citation-like to the user. This is the exact presentation/injection boundary called out as required coverage in `tmp/language-v56-design-assessment.md`; the new tests cover a forged copy **field**, but not forged citation/Markdown content already present in the canonical retained payload.

Keep the pilot ineligible when its canonical payload contains answer-renderer citation syntax, storage markers, or another presentation form that the normal generated-answer contract forbids, and use the unchanged legacy route. Do not silently sanitize arbitrary payload bytes after the model selects `copy`; that would violate the declared exact-copy boundary. Add an operation test proving a citation-like managed payload is not emitted as a copied answer and that no forged citation enters `result.answer`/`result.citations`. If the UI renderer has a separate authoritative sanitizer for HTML, cite and exercise that exact path rather than assuming it.

### Medium — “exact current readable payload” is not actually the emitted text because `validateDraft` trims it

`answerRecordRendering` removes only the verified leading list marker and otherwise preserves `line.text`, including leading/trailing readable whitespace. After materialization, `validateDraft` stores `block.text.trim()`. The copy test uses a payload with no boundary whitespace, so it misses this difference. A managed line with trailing spaces (or a presentation-preserving leading span after marker removal) is language-checked as one string but emitted as another.

Either define the canonical payload as the marker-stripped **and trimmed** value before both `additionalLanguageProse` and materialization, and update the design/docs to call that exact canonical value, or preserve the canonical value through the copy route without the legacy trim. Add a boundary-whitespace test that compares the language-check excerpt, verifier `answer_segments`, and emitted pre-citation block to the declared canonical value. The source file bytes need not be modified.

### Low — the new provider schema shape lacks a transport-level regression

`answerRecordBlockSchema` correctly uses two strict `z.union` branches, which should serialize as supported `anyOf`, and singleton enums avoid `const`. The tests exercise Zod parsing and operation stubs but do not inspect the actual schema sent through `ModelClient`/the endpoint-schema conversion. This exact boundary previously failed when a locally valid union serialized to unsupported `oneOf`.

Add one transport-schema test for the V56 draft schema asserting no `oneOf`, strict branch objects (`additionalProperties:false`, all properties required as appropriate), and successful copy/translate demotion through the actual ModelClient path. This is a regression gap rather than evidence that the current schema is malformed.

## Reviewed boundaries without further findings

- Pilot activation is narrow: exactly one evidence item, one bound live source frame, one qualified page line, and a resolved `en`/`ru` answer language. Documents, observations, multiline results, mixed/multiple evidence, missing frames, and unresolved language retain the legacy path.
- The copied value comes from the currently recalled `line.text`, not an archived frame, receipt, model echo, `record_readings`, question, or proposed destination. Requiring the same evidence ID in the sole source-frame map preserves the live provenance binding established by `retentionSourceFrames`.
- Copy contains no model-authored text. Both branches are strict; unknown fields, copy-with-text, translate-without-text, wrong/duplicate IDs, and invalid mode fail parsing. Materialization occurs before every existing local guard and the independent source verifier.
- `additionalLanguageProse` re-parses the complete draft and submits the exact canonical copy value to the existing language check. A false language verdict holds the operation; there is no copy-to-translate retry or unchecked fallback. Translate text remains covered by normal generated-prose checking.
- `rendering_scope: complete_retained_record` is private verifier input and `rendering_mode`/`complete_record_rendering` do not enter public output. The private original frame is never materialized into answer text.
- Translation retains the full current record as its declared unit, while the original frame only constrains meaning. Existing excerpt selection, immutable anchors, three category relations, three semantic booleans, protected-value checks, attribution/discourse/agency guards, and normal citation assembly remain mandatory.
- The branch adds no model call, semantic retry, detector, public schema, model change, or output-ceiling change. At most one block and one evidence ID reduce generation shape size.
- Proper-name preservation is explicit in the contract. Exact names also remain visible to existing language-reference and protected-value checks.

## Finite policy scope

The pilot intentionally discloses the complete current retained line whenever the model selects it, including independent clauses in that line. This is a stated policy tradeoff, not an implementation bypass, and the new operation test documents it only indirectly through a single-clause fixture. A dedicated relevant-plus-independent-neighbor fixture would make that disclosure decision durable. Translation completeness remains a fallible verifier judgment.

## Round-1 fix recheck

All three findings are resolved in the revised boundary.

1. `answerRecordRendering` now makes the constrained route ineligible for bracket-bearing citation/link text and HTML/comment-like text. The integration case proves that such a retained payload uses the legacy schema, emits only the model-selected relevant clause, produces exactly one server-owned citation, and leaks neither the forged reference nor the private frame neighbor. The complete-record policy is also explicit and tested for a safe retained independent clause: when the pilot is eligible, both retained clauses are language-checked, verified, and rendered, while a frame-only neighbor remains private.
2. Canonicalization is now defined before language checking and materialization: remove the leading list marker, trim boundary whitespace, preserve interior spelling/spacing and the visible qualification label. Unit and operation assertions bind the generation payload, language-check excerpt, verifier answer segments, and emitted pre-citation content to that canonical string. The ordinary answer renderer's later trim is therefore idempotent rather than a second mutation.
3. The live HTTP fixture inspects the actual request schema at the adapter boundary, accepts either supported schema envelope, requires a strict two-arm `anyOf`, checks each branch's required fields and `additionalProperties:false`, and rejects `oneOf`/`const`. This covers the prior transport failure class rather than only local Zod parsing.

The fixture-server error capture is also sound: callback assertion failures are preserved for `afterEach`, while the request receives a closed 500 response instead of leaving the operation hanging. The added folder filter only isolates the intended invented evidence in the integration test.

No further actionable finding in this recheck. I did not independently execute the focused or full checks; this disposition is based on inspection of the revised implementation and tests.

Freeze verification: the final full suite passed 2,502 tests across 140 files after the residual retraction fix. Build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed-package smoke and repository safety passed. Compiled dry controls passed; post-commit redeployment and provider controls remain separate required steps.

Frozen runtime affce0db9eea99d9f18020dc32cc8b6ee82988a6 was built and restarted with its socket ready. Compiled copy/translation, language, source/selection, strict JSON, retention-denial and existing qualification controls passed. Both invented actual-provider schema controls passed. CI 34307181238 and Documentation 34307181241 completed successfully before the declared exposed probes started.
