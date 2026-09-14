# V67 semantic-generation design review

## Scope

This review uses the frozen V66 source, retained records, generated drafts and verifier traces. I did not inspect a grading receipt, call a provider, change runtime code, or use fresh held-out terms. The proposed scope remains one extraction call, one generation call and the existing per-block verifier. It adds no retry, schema field, lexical dictionary, deterministic synonym rule or semantic pass.

## Recommendation

Proceed with a prompt-only V67 revision, but make it procedural and place each instruction beside the field or branch that must use it. Repeating the current broad reminders is unlikely to help: V66 failed despite already saying that coverage roles must be preserved, ordinary hyphenated component words must be translated, measurements must not gain properties, and discussing must not become considering.

The smallest coherent revision has four parts:

1. Make the existing private `record_readings.selected_meaning` a compact target-language composition plan for translation. It must identify the material predicate and arguments before drafting prose. For a test or measurement, name the operation, tested object, tested/measured property if the source supplies one, and frequency/modifiers separately. For coverage, name the covered item/service and the coverer separately, explicitly recording an unspecified coverer as unspecified. For an ordinary compound, decide which bytes are protected identity and translate the remaining component vocabulary. This stays one free-text field under the existing 320-character limit; put material roles first and use `clarification_or_ambiguity` only for real source ambiguity.
2. Strengthen the existing answer alignment instruction at `object_and_mechanism`. Before choosing `preserved`, the verifier must state the source property and the actual target-language answer property separately. It must not collapse the two into a slash pair such as “integrity/continuity,” or silently read the source property back into a broader answer term. Keeping the same physical component while replacing a specified tested property with generic condition or integrity is `generalized`, unless the complete source itself establishes equivalence. That requires a negative object/mechanism alignment and the existing negative semantic dimensions. This is a meaning comparison, not a term dictionary.
3. Treat outer activity and embedded commitment as separate decisions during retention. Extraction should first identify the source's actual outer activity, preserve that predicate in readable text, and only then assign commitment to the embedded alternatives. A confidently reported discussion can contain tentative unsupported hypotheses. Tentative metadata for those hypotheses neither makes the discussion uncertain nor permits replacing discussion with private consideration. The verifier should compare the outer activity under `action_arguments` and evaluate the hypotheses' tentative commitment under qualification. This should replace or consolidate the two existing reminders, not add a third copy.
4. In `complete_record_rendering` translation only, when the model emits a report heading and the selected record supplies `report_source_display_phrase`, require the heading attribution to use that phrase exactly. Preserve proper-name bytes exactly. Do not require a heading, mechanically prepend text, apply the rule to ordinary multi-record composition, or let the phrase supply a missing embedded actor or report basis. The body and the complete block still pass the existing attribution, language, source alignment and semantic checks.

These changes should be made in the existing contracts:

- `ANSWER_READING_CONTRACT`: add the target-language role/property plan, conditional on translation.
- `ANSWER_ALIGNMENT_CONTRACT`: replace the loose object/mechanism comparison with the separate source-property/answer-property procedure and prohibit slash-style asserted equivalence.
- `ANSWER_RECORD_RENDERING_CONTRACT`: add the conditional exact heading-phrase rule and the preparatory coverage/ordinary-compound translation procedure.
- retention `SYSTEM` and `QUALIFICATION_CONTRACT`: consolidate the outer-activity/embedded-commitment rule next to the existing competing-hypotheses instructions.
- the retention verifier comparison: explicitly reject a changed outer activity while allowing tentative commitment for the embedded hypotheses.

Prompt versions should reflect every changed consumer: answer generation and verifier, plus retention extraction and verifier if both retention contracts change. Schema, model, pass, retry, routing and token ceilings remain unchanged.

## Why the property comparison needs the strongest wording

V66 gives a controlled inconsistency. The source and retained record name a monthly connector continuity test. Three Russian drafts use `проверку целостности разъёма`, while a fourth uses `проверку целостности цепи разъёма`. The private readings already use the same target-language terms as their drafts, so merely asking for a target-language reading does not fix the problem.

The verifier correctly rejects the broader wording once, at selected trace row 120: `object_and_mechanism.relation` is `generalized` and the detail says the continuity-test mechanism was lost. The same broader wording is accepted at rows 112 and 128. Row 112's comparison explicitly calls the draft a “connector integrity check” but then says no object changed. Row 128 avoids the decision by writing “integrity/continuity” as if the terms were established equivalents. Both return all positive dimensions and publish. The current shared semantic contract already tells the verifier to compare a component separately from property, method and result. The missing step is requiring it to expose the answer's actual property meaning before assigning the relation.

The revised instruction should stay general: an answer may naturally paraphrase a technical property, and the verifier should accept a source-supported equivalent. It should reject a lost restriction, not demand one preferred translation. No local synonym list can safely decide technical equivalence across languages.

## Why the translation plan belongs in the existing reading

The V66 coverage case shows four Russian drafts with the same reversed construction: `покрывается ли ремонтом приводного вала`. Their private readings already contain that construction. The local coverage-role floor correctly withholds every draft, but generation repeatedly reaches the floor with the wrong relation. A compact reading that first records “covered service: repair; coverer: unspecified; status: this record does not answer” gives the same model call a semantic plan before Russian case selection. The draft can then use active wording, a subject-preserving passive, or a nominal `вопрос о покрытии ремонта`; no particular phrase is mandatory.

The fiction rows support the ordinary-compound reminder only as a generation risk, not a localized diagnosis. Two Russian-target paths emitted an English block and were correctly stopped by the whole-block language check; two other paths translated `hinge-pin` successfully as `штифт петли`. The trace does not prove that the hyphenated component alone caused either failed language choice. The useful general instruction is therefore to separate protected names/identifiers from ordinary compound vocabulary in the private plan and translate the latter. The current whole-block language check remains the enforcement boundary.

`record_readings` must remain private and fallible. It cannot expand selection, resolve an ambiguity absent from the frame, or become verifier evidence. The answer verifier should continue receiving the immutable original frame and final block, not the reading. V66 itself shows why: a bad private reading can reproduce the same bad wording in public prose.

## Activity and metadata boundary

The built V66 alternatives source says Ada is discussing two hypotheses. The generated candidate says she is considering them. That changed material activity was reasonably rejected. At the same time, the verifier incorrectly treated `commitment: tentative` as uncertainty about whether the discussion occurred. The metadata properly governs the unsupported embedded hypotheses; it does not qualify the outer discussion act.

The prompts already state both principles in separate places. V67 should consolidate them into one ordered instruction and require the comparison to name both layers. The rule must be bidirectional: when the source says considering, considering is faithful; when it says discussing, discussion is faithful. It must not create a global preference for either verb, infer an unmentioned public discussion, or promote the alternatives to asserted facts.

## Report-heading boundary

In the V66 built report q5, a complete and otherwise faithful Russian block uses the heading `Пересказано Ada Marlow` and is stopped by the conservative attribution grammar. The same generation payload supplies `report_source_display_phrase: "По словам Ada Marlow"`, derived for that selected source-report record. Requiring that exact phrase only if the translation emits a heading is a lower-risk correction than broadening the reporter grammar to passive forms with indeclinable names.

The phrase is presentation guidance tied to the selected record, not new source authority. It cannot be used for an unqualified record, a sibling citation, a performed reporting action, or an embedded action actor. Because the model still emits the text, this change does not bypass language checking or exact source verification. It also avoids a new public field or server-side text insertion.

## Tests and evidence needed

Local tests should establish wiring and fail-closed behavior without pretending to prove model competence:

- Generation-message tests should show that a framed translation receives the current record, original frame, `record_readings`, and its own `report_source_display_phrase`; the phrase must remain absent from verifier input as a generation hint. Copy mode and ordinary multi-record composition retain their existing behavior.
- Rendering tests should cover a named outer source and a generic assistant source, exact proper-name spelling, a translated heading using the supplied phrase, a faithful body without a heading, and negative controls where a heading swaps outer and inner roles or borrows a sibling record's source.
- Source-audit fixtures should cover a named tested property versus a generic state/integrity answer, an equivalent technical paraphrase, the same component with a different property, and an unspecified property that remains unspecified. Negative alignments must still be mandatory and unpublishable. A stubbed all-positive semantic response only tests parser wiring; it does not establish that the model will detect the error.
- Coverage translation fixtures should vary active, passive and nominal grammar while keeping the covered service and coverer fixed. Include unspecified-coverer, reversed instrument, invented coverer and unrelated neighboring coverage controls.
- Retention fixtures should contrast `discussing` with `considering`, preserve each when actually sourced, keep tentative metadata on embedded alternatives, and reject a changed outer activity. Include quoted activity, a different actor/object, both activities explicitly present, and an accurate candidate with tentative hypotheses so the verifier does not falsely hold it.
- Ordinary-compound language controls should use invented generic component vocabulary and a protected product identifier, verifying that untranslated prose is withheld while the identifier remains exact. They should not encode a component dictionary.

After freeze, the declared semantic evaluation is still necessary. These tests can prove that failures remain withheld and that prompts/data reach the intended call; they cannot prove a free-text reading or verifier comparison is semantically correct.

## Budget and practical limits

The current prompts are already dense. Static template text is roughly 27.6k characters for retention generation, 26.3k for retention verification, 17.5k for answer generation with complete-record rendering, and 29.2k for answer verification before full dynamic source/evidence payloads and some embedded frame-contract text. `record_readings` are capped at 320 characters plus a 240-character nullable ambiguity note. The revisions should replace and consolidate existing paragraphs. Adding examples at several layers would consume attention and token budget without adding enforcement.

The proposal does not increase output bounds. Requiring a role plan can make the 320-character reading tight for long records, so the instruction should demand terse material roles first and leave ordinary narrative out. Do not increase the cap based on these cases.

The remaining material limitation is that all semantic distinctions are still model judgments. An all-positive but wrong verifier response remains schema-valid; V66 rows 112 and 128 demonstrate that. Within the requested no-schema/no-pass scope, a more explicit comparison procedure is the smallest defensible improvement. If the same property-generalization error survives a fresh evaluation, the next coherent design question would be a structured source-property/answer-property comparison, not a lexical exception or a retry. That larger schema and transport change is not justified as part of V67.
