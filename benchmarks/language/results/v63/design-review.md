# V63 contractual-sense and epistemic-scope design review

I reviewed the prompt-only proposal against [`provisional-design-review.md`](provisional-design-review.md), the current retention, answer, shared semantic, and answer-alignment contracts, and the two V62 failure shapes. I made no runtime changes or provider calls.

## Recommendation

Proceed with a prompt-only consolidation. Do not add the provisional lexical floor. The common structural issue is an incompletely compared epistemic predicate: its grammatical subject, exact action, object/referent, and scope must travel together. This covers the contractual-term mistranslation and prevents a personal verification limit from being confused with neutral record-level nonresolution without making either vocabulary family authoritative.

The design should preserve these four distinctions:

1. `Ada has not read the service terms` — personal actor, reading predicate, terms object.
2. `Ada has no independent confirmation of Bo's report` — personal actor, confirmation predicate, report object.
3. `this is not a contractual condition Ada verified` — personal actor, verification predicate, contractual-condition object.
4. `the exception record does not establish whether repair is covered` — the record is the epistemic subject; this is not a personal nonverification claim.

These statements can coexist in one source but are not interchangeable. A generation instruction that merely repeats `contractual` can still attach the right noun to the wrong predicate. The contract should therefore require preservation of the complete predicate relation before giving the concrete contractual/physical-state contrast.

## Minimal wording changes

### Shared proposition scope

Consolidate the first epistemic bullet in `PROPOSITION_SCOPE_CONTRACT` around wording of this form:

> Treat each selected material epistemic limit as a scoped predicate. Preserve its grammatical subject or experiencer, exact action (read, examine, receive, confirm, verify, establish), object or referent (report, contractual term or condition, physical state, note, proposition), and the clause it qualifies. Do not replace a person's failure to confirm a report with passive unconfirmation, failure to verify a contractual condition, or a record's failure to establish an answer. Do not replace a record-level limit with a person's ignorance. Preserve separate predicates separately.

This should replace overlapping generic actor/object sentences rather than append another example-only paragraph. `PROPOSITION_SCOPE_CONTRACT` already reaches retention extraction, retention verification, answer generation, and answer verification, so this is the correct shared structural home.

The existing later bullet about Ada's no-answer state versus note-level inconclusiveness should add one concise boundary:

> For a source clause whose grammatical epistemic subject is the note, record, exclusion, or document, preserve that neutral subject. A direct self-attested source speaker is provenance, not the actor of the record's `does not establish/resolve` predicate and not a requirement to repeat the speaker in that clause. Conversely, source-speaker metadata cannot turn a personal `Ada has not confirmed X` predicate into a neutral record-level limit.

This directly resolves the V62 exclusion false hold. The source and retained E1 say the **exception record** does not resolve fan-motor repair coverage and does not assert contractual silence. The faithful answer says the same. The verifier incorrectly anchored `actor` to the separate Ada/bracket clause and marked Ada omitted, even though the selected epistemic actor/subject is the record. No attribution relaxation is needed: direct `self_attested` provenance already has no mandatory public wording, while named actors of material actions and `source_report` attribution remain required.

### Shared semantic comparison

Replace the current isolated contractual-sense sentence in `SEMANTIC_COMPARISON_CONTRACT` with an operational comparison:

> For every selected material epistemic predicate, compare its actor/experiencer, action, object/referent, and attachment before setting the booleans. Use the governing source context to resolve that object's sense. A contractual condition is a term or requirement, not the physical condition/state of a device; a report about a contractual condition is not a report about device state. Preserve a supported physical state when that is what the source actually describes. Contract vocabulary elsewhere in the record does not change an unrelated physical-state object.

Then make verdict consequences explicit without weakening the existing all-three requirement:

> A changed epistemic actor, predicate, object/referent, or attachment uses a concrete changed/omitted alignment and mismatch. Set `action_arguments_preserved=false` when the predicate's actor or object changes, `qualification_scope_preserved=false` when its epistemic attachment or personal-versus-record scope changes, and `proposition_supported=false` whenever the answer states an unsupported replacement meaning.

This would have rejected `сообщения о состоянии` for the right reason: it changes the object/referent of the unconfirmed report from a contractual condition to a state. It does not ban `состояние`, which remains valid for a physical condition or `индикатор состояния` when the source supports that object.

### Retention and answer generation

In `QUALIFICATION_CONTRACT`, replace the existing two-sentence contract-condition instruction with the same source-conditioned operational rule, shortened for generation:

> Keep the exact epistemic action and its object. When the governing source identifies that object as a contractual condition, term, or requirement, keep that contractual sense explicit in the generated clause or an unambiguous antecedent so translation cannot turn it into physical state. If the source distinguishes confirming a report, reading terms, and verifying a condition, do not collapse them.

The answer-generation translation paragraph should use the same final two sentences rather than a separate example list. “Explicit” should allow natural equivalents such as `contractual term`, `condition of the service terms`, `условие договора`, or an unambiguous pronoun whose immediate antecedent is one of those. It should not require literal repetition of one adjective in every clause.

For the V62 report shape, the safest rendering keeps the actual confirmation object:

> `Ada Marlow не читала условия обслуживания и не имеет независимого подтверждения сообщения Bo Winters об этом условии договора.`

This preserves the report as the confirmation object and contractual condition as the report's referent. Wording such as `не имеет подтверждения того, что это условие договора` is less safe because it can change the confirmed proposition into whether the item qualifies as a contract condition. The prompt should not prescribe that form.

### Answer alignment

Strengthen `ANSWER_ALIGNMENT_CONTRACT` without changing its schema:

> For a selected epistemic limit, `actor` compares the grammatical actor, experiencer, or record/note subject of that epistemic predicate; it is not automatically the outer reporter or `source_speaker`. `object_and_mechanism` compares the exact epistemic action and its object/referent, including report versus contractual term versus physical state. `qualification` compares personal versus record-level scope and the clause to which the limit attaches. Direct self-attested provenance alone does not require repeating the source speaker. A personal source actor still cannot be omitted or replaced by a passive/global limit.

Add one consistency sentence:

> If a material actor or epistemic object is genuinely changed or omitted, return the corresponding negative relation, semantic mismatch, and false dimension; do not mark `action_arguments_preserved=true`. Do not manufacture an omitted actor by treating provenance metadata as the actor of a neutral record-level predicate.

The current runtime already fails closed when any alignment relation is `changed`, `generalized`, or `omitted`, even if the model returns positive semantic booleans. This clarification improves the judgment; it does not alter consistency enforcement or let a negative alignment pass.

## Authority and false-hold risks

- **Contract mention is not activation.** A contract can discuss a device's physical condition, and a status display legitimately contains `состояние`. The comparison must bind the sense to the selected epistemic predicate and object. Neither query wording, another citation, metadata subject/page, nor mere lexical co-occurrence can establish that binding.
- **Report and condition are different objects.** “No confirmation of the report” must not silently become “the condition is unverified.” If the source separately supplies both limits, preserve both or a faithful combined relation. The shared instruction should not encourage collapsing them.
- **Neutral subjects must be source-stated.** Only a source that makes the note/record/document the epistemic subject supports neutral `does not establish/resolve` wording. A person's uncertainty cannot be rewritten that way. This prevents the exclusion correction from weakening personal actor preservation.
- **Self-attested provenance is not a repeated-name obligation.** Requiring Ada in each directly authored neutral clause creates the V62 false hold. This does not affect source-report attribution or named actors of proposals, choices, checks, confirmations, and other material actions.
- **Prompt-only remains fallible.** These changes improve first-pass interpretation but prove no semantic outcome. All source anchors, retained-excerpt selection, alignment categories, semantic booleans, and consistency checks remain mandatory; no retry may repair a rejected result.

## Versioning and meaningful checks

Because the shared scope/comparison text reaches every model role, bump retention extraction, retention verifier, answer generation, and answer verifier prompt versions. Update the benchmark version matrices and dry protocol expectations. No response schema, model, pass count, token ceiling, retry, routing rule, or public protocol changes.

Meaningful local checks should cover behavior of the existing enforcement rather than pretend a stub establishes model reliability:

- Capture extraction and retention-verifier prompts to confirm the consolidated actor/predicate/object rule reaches both roles and the schema is unchanged.
- Capture answer generation and verifier prompts, including complete-record and ordinary multi-record paths, and confirm existing query/frame/selection inputs are unchanged.
- Preserve a fail-closed answer integration where a returned material `actor=omitted` or epistemic-object `relation=changed` cannot pass even if the model also returns positive semantic booleans.
- Add the neutral contrast where the source and answer both make the exception record the nonresolving subject; a verifier response marking that record subject preserved remains structurally acceptable without an Ada repetition requirement.
- Keep a personal negative control: source `Ada has not confirmed the report`, answer passive `the report is unconfirmed`. A negative verifier response must still withhold.
- Retain source-language contrasts for a contractual term, physical device state, and status display. Local fixtures can verify prompt/dataflow and mandatory negative verdict handling; only the frozen independent source evaluation can assess whether the model interprets those contrasts reliably.

## Conclusion

The proposed prompt-only scope is coherent if it is framed as preservation of a complete epistemic predicate, not as mandatory lexical repetition. Consolidating the shared contracts is preferable to another narrow floor: it directly addresses both observed failures, preserves source authority, and leaves every existing gate intact. The main implementation constraint is to keep `report`, `contractual condition`, `physical state`, and `record nonresolution` as distinct possible objects rather than treating them as interchangeable forms of uncertainty.
