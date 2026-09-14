# V57 bounded design review

## Recommendation

The proposal is coherent if V57 remains a narrow extension of V56's existing floors and one-record rendering path. I recommend:

1. Raise the complete-record current-canonical-text gate from 400 to 600 characters, retaining every other V56 eligibility condition and full fallback.
2. Add a source-conditioned exact reversal guard only for an unambiguous two-person reporter chain that is selected by the current retained record and corroborated by its exactly bound original frame.
3. Extend `coverageRolesSupported` only for the same-clause Russian uncertainty shape in which `ремонтом` becomes the coverage instrument while the source establishes repair as the covered object.
4. Admit the exact natural passive generic label `Сообщено ассистентом` and the exact temporal construction “understood from the moment of the source record,” with local clause/boundary and negation controls.
5. Clarify the existing retention and answer-verifier prompts about neutral discourse possession and frame-only recording acts.

None of these changes needs a public schema change, a new model pass, a retry, a changed semantic threshold, or a language guess. The existing generation language check, local guards, immutable source alignment, excerpt selection, complete-record scope, and semantic verifier must remain mandatory.

## Complete-record bound: 600 is a defensible pilot envelope

V56's report record is 405 canonical characters because the generated body is followed by visible status/attribution labeling. The current candidate cleaner bounds generated candidate text at 400 characters, while complete-record eligibility bounds the fully materialized current line at 400. The two limits therefore describe different objects. Raising the latter to 600 directly covers the observed 405-character record and provides room for ordinary visible labels without stripping or separately trusting those labels.

The rationale must not claim that 600 covers every possible 400-character candidate plus all labels. A source speaker can be sanitized to as many as 200 characters, and a record can carry more than one visible semantic label; a legal managed line can still exceed 600. That is acceptable for a bounded pilot because over-limit records continue through legacy composition. It should be documented as “current canonical record text up to 600 characters,” not as an exhaustive projection of every extraction-legal candidate.

Keeping one bound over the exact current canonical text is safer and simpler than splitting the managed status prefix from a 400-character body. Prefix splitting would create a second rendering unit, require a decision about translating English status labels separately, and make exact-copy comparison less direct. A 600-character total cap preserves the V56 invariant that the same text is selected, materialized, language-checked, and semantically verified.

The budget impact is bounded. A 600-character record remains well within the existing 2,000-character translation field and the explicit 2,400-token answer ceiling used by the trial. It adds no block and no call. It does expose more records to the fallible `copy`/`translate` choice: if the model selects `copy` for a different requested language, the server materializes the current source-language payload and the existing language check must withhold it. That is a safe availability failure, not grounds to infer language from script, configuration, or a historical receipt. Tests should prove 600 acceptance, 601 fallback, continued reference/HTML fallback, and exact canonical-byte materialization.

## Exact nested-reporter reversal guard

The existing attribution floor checks that the retained source speaker occurs in a reporting role, but it does not prove ordering between an outer source and a distinct inner reporter. A deterministic reversal guard is justified because the bad shapes are structurally explicit:

- required chain: `According to OUTER, INNER said ...` or `По словам OUTER, INNER сообщил ...`;
- rejected reversal: `According to INNER, OUTER said ...` or `По словам INNER, OUTER передала ...`.

Activation should require all of the following:

- one cited qualified `source_report` line with a non-generic, exact outer `source_speaker`;
- the selected current retained text names a distinct inner person as the reporting subject in the same bounded clause;
- the exactly bound original frame independently supports the same OUTER-to-INNER chain;
- both names are escaped and compared at whole-name boundaries after NFKC normalization;
- quoted/code spans and separate clauses cannot provide either reporting relation.

Requiring the retained record as well as the frame matters. A private frame can constrain a selected chain, but it cannot create a mandatory actor relation omitted from the retained proposition; the V56 question null demonstrates that boundary. Requiring frame corroboration prevents a malformed retained paraphrase from becoming the guard's authority. If either side is ambiguous, contains more reporters, uses generic roles, or lacks a same-clause pattern, the helper should defer to the mandatory semantic verifier.

The guard should reject only an observed exact reverse. It should not require every faithful answer to use one canonical reporting sentence. Existing acceptable forms such as “OUTER relayed INNER's report” remain semantic-verifier territory unless their roles are explicitly reversed. This keeps the new floor from becoming a general attribution parser.

Meaningful tests are the two correct EN/RU orders, both exact reverse orders, names elsewhere in the answer, a quoted reverse example, punctuation-separated names, a frame-only inner reporter absent from the retained record, and an unrelated second reporting clause. An integration test should establish local rejection before semantic acceptance can publish the reversed block; positive controls must still reach the existing semantic verifier.

## Russian repair-as-instrument coverage inversion

The current `coverageRolesSupported` activation is appropriately conservative: the source must establish repair as covered, quoted and separate clauses are excluded, and an independent source proposition in which repair covers something causes deferral to full semantics. The current rejected answer shape only recognizes another `ремонт` as the object after `покрывается ... ремонтом`, so it misses a source-conditioned inversion such as:

> Запись не определяет, покрывается ли ремонтом двигатель.

The smallest extension does not need a component list. Once the existing source activation proves a covered-repair proposition and the existing `repairCoverer` check finds no independent repair-as-coverer proposition, reject an answer clause only when a bounded uncertainty predicate and `покрывается ли ремонтом` occur in that same clause. In outline, the relevant structure is “record/source does not determine/establish whether … is covered by repair,” with no sentence, semicolon, colon, or adversative/coordinating-clause boundary between the uncertainty head and the inverted predicate.

This is more precise than rejecting every occurrence of `покрывается ремонтом`. It leaves the deliberately deferred control `Покрывается ли ремонтом ущерб? Ремонт двигателя обсуждается отдельно.` to full semantics, does not borrow a bare `ремонт` from another clause, and does not treat a quotation as the answer's proposition. If the source itself independently says that repair covers damage or a component, the existing deferral remains necessary because a type-level presence floor cannot pair two coverage events.

Tests should include the same-clause component/object positive hold, correct `гарантией покрывается ремонт` controls, quote and separate-clause controls, source-with-independent-repair-coverer deferral, and integration showing that a deferred ambiguous case still requires the semantic verdict rather than becoming locally approved. As before, floor success is not semantic approval.

## Two narrow lexical admissions

### `Сообщено ассистентом`

For a qualified generic assistant source report, `Сообщено ассистентом: ...` is an ordinary passive attribution and should satisfy the reporter-presence floor. The match should be exact and clause-local: a finite/passive reporting form immediately governs instrumental `ассистентом`, followed by a colon, comma-plus-content, `что`, or a complete clause boundary. It must not admit `не сообщено ассистентом`, quoted/code examples, `сообщено` and `ассистентом` in separate clauses, or a sentence in which the assistant performs another action. Named speakers and other passive constructions can remain verifier work.

This is a local extension to attribution recognition, not a weakening of `source_report` scope. Tentative, fictional, and other required qualifications still need their independent existing checks.

### “understood from the moment of the source record”

This phrase can express a source-relative clock and fits `hasSourceRelativeAnchor` when a deictic time and unknown calendar date remain separately explicit. The recognition should bind `understood from` directly to `the moment/time/date of` an optional `original`/`undated` `source record/note`, with a word/clause boundary after the source noun. It should not accept “the cause was understood from the source,” “understood from the moment of repair,” or `source record repair`, and quoted occurrences should not supply the anchor.

Callers already require the other source-clock dimensions: answer checking activates only when the selected line has deictic time, an anchor, and an unknown reference clock, and retention also requires the unknown-clock wording. Those checks should remain independent; the new phrase must not itself imply an unknown date.

## Prompt clarifications

The retention-verifier clarification should distinguish a neutral possessive identifying discourse provenance from an asserted action. `Ada Marlow's unresolved question` can identify whose question is retained without inventing that Ada wrote, recorded, asked aloud, or resolved it. The same allowance must not let `Ada's proposal/plan` stand in for the material claims that Ada proposed, adopted, rejected, or scheduled something. Embedded action agency remains governed by the existing personal-action floors and semantic verifier.

The answer-verifier clarification should state the selected-record rule directly: when complete-record rendering identifies an open question from the complete retained record, a recording act found only in the private original frame is not a required answer clause. If the retained record itself selects the recording act, or the answer asserts one, the verifier still must compare its actor. This resolves the V56 q6 failure without relaxing original-frame authority over selected actor, mechanism, qualification, or translation meaning.

These are prompt instructions to a fallible model. Tests should assert the mandatory schemas and local outcomes around them; synthetic model fixtures cannot establish that the wording improves semantic reliability. The frozen live evaluation after implementation remains the evidence for that.

## Verification and release boundaries

The focused test set should cover:

- 600/601 canonical bounds, exact copy materialization, translate completeness, language-check rejection, and reference-bearing fallback;
- nested reporter correct/reversed order in EN and RU, plus quote, clause, ambiguous-chain, and frame-only controls;
- same-clause repair-instrument inversion and the existing independent-coverer/quoted/separate-clause deferrals;
- passive assistant attribution negation and boundary controls;
- source-relative “understood from” positives with separate unknown-clock language and nearby non-temporal negatives;
- answer integration proving that all locally admitted positives still require the existing semantic verifier and that malformed structured outputs fail closed without retry.

The public answer and memory schemas do not need to change. The record-rendering schema remains the V56 strict `copy`/`translate` union, the copy server still owns exact current text, and the verifier still receives immutable answer/source anchors. Benchmark metadata should continue to record the explicit 2,400 answer ceiling so a longer-record result is not attributed to an unrecorded local override.

The principal risks are availability from a wrong rendering-mode choice, false activation from loose name/repair regexes, and prompt wording that accidentally elevates frame-only provenance into selected content. The activation and boundary conditions above keep those risks local. With them, V57 is a smaller and more defensible step than adding a language detector, general relation parser, extra semantic pass, or retry.
