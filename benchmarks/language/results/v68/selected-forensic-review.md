# V68 selected source-first forensic review

Runtime: `c60460d7f8f14020135454059996d632fff6fd46`
Evidence: `bench-results/language-selected-v68.json`, `bench-results/language-selected-v68-trace.jsonl`, `tmp/language-selected-output-packet-v68.json`, and the eight V21-development originals in `tmp/language-v21-blind-inputs.json`.
Scope: one frozen run, eight cases, 64 query coordinates. I did not inspect an output-grade receipt, call a provider, or alter runtime files. Runtime booleans and private readings were treated as diagnostics, not truth labels.

## Result inventory

The report publishes **41/64** answers: report 0, hypothesis 8, counterfactual 4, exclusion 7, assistant 7, fiction 7, undated 0, alternatives 8. The other 23 are 16 `no_eligible_evidence`, five `draft_rejected`, one `verification_rejected`, and one `generation_failed` caused by a language rejection. There is no case-level availability failure, routing failure, or source-byte change.

Against the complete original propositions, **six of eight retained sets are complete**. Report retains only the independent no-delivery denial and loses the main relayed report. Undated retains nothing. Hypothesis, counterfactual, exclusion, assistant, fiction, and alternatives retain their material source sets. The report's `usefulRetentionCoverage=7/8` is the benchmark's typed expectation measure; it is not the complete-set count.

My source-first assessment finds two accepted material answer defects and one additional public citation-selection defect:

- Assistant q7 changes connector **continuity** to connector **integrity** (`целостности разъёма`). This is the same property broadening for which the verifier correctly rejects q3; the positive q7 verdict is inconsistent with that source distinction.
- Fiction q3 says only `По словам Ada Marlow` and never preserves Ada's actual proposal to discuss the fictional case. Outer attribution is not the proposal act asked for by the focused query.
- Fiction q7 does preserve the proposal in its prose, but cites only `[memory/equipment:9]`, the fictional-promise record. The proposal is the separate `[memory/equipment:6]` record. The original frame behind the promise record contains both source items, so the sentence is source-entailed, but its public selected-record citation does not substantiate the proposal clause.

The other 38 published answers are source-faithful for the focused question. This is an independent forensic count, not an official usefulness score.

## Case audit

### `v20-held-report`: incomplete retention; eight downstream coverage losses

The original has two independently useful propositions: (a) Ada relays Bo's report that the agreement permits sending Zephyr QX-100 to the workshop to measure the latch gap, not replace/change the latch, while Ada has neither read the agreement nor independently checked Bo's account and only relays its meaning; and (b) Ada has not arranged delivery.

Initial extraction at trace row 2 represents both faithfully. Candidate 0 preserves Ada as outer reporter, Bo as inner reporter, permission, workshop destination, latch-gap measurement, the no-change clarification, and Ada's personal reading/checking limits. Candidate 1 faithfully preserves the separate no-delivery denial. Local validation admits candidate 1 but gives candidate 0 `discourse_uncertain`; row 4 repairs only wording (`not to change` to `not change`, expands `Bo's`), without changing meaning. Frozen `hasReportUncertainty` replay returns `false` for both exact candidate texts. The repaired main report never reaches the semantic verifier; row 5 verifies only the no-delivery denial and row 6 routes it to the existing Zephyr page.

The hold is false relative to the source. The readable text explicitly says Ada `has not read the agreement or independently checked Bo's account` and `only passes on ... without checking it herself`. This is a bounded two-part personal uncertainty construction, not missing uncertainty. Because the only retained record is irrelevant to the latch-report query, all eight answers correctly report `no_eligible_evidence` at the operation layer, but every one is a source-level answer-coverage loss over adequate original evidence.

### `v20-held-hypothesis`: complete; 8/8 faithful

Rows 8-10 retain and route one complete proposition: Ada introduces the hypothetical three-month mesh-screen inspection premise, the missed-inspection consequence holds only under that premise, she does not know actual requirements, and no real missed inspection is reported. Rows 11-42 produce and verify all eight variants. Copy and translation branches keep Ada as the person introducing the analysis, the three-month frequency as a property rather than an event, the coupled consequence, actual-requirements unknownness, and no-actual-miss scope. No accepted defect or hold appears.

### `v20-held-counterfactual`: complete retention; 4/8 published, four false local holds

Rows 44-47 retain both the actual refusal/nonpurchase and the counterfactual fifth-year wheel-hub coverage, correctly attached to the optional extension and routed. The four English answers (q0, q2, q4, q6; rows 49, 54, 59, 64) faithfully preserve purchase as the unrealized antecedent, the conditional coverage consequence, fifth-year scope, no purchase, and no active coverage.

All four Russian drafts (q1/q3/q5/q7; rows 52/57/62/67) are withheld before the independent verifier. Direct replay of `hasNominalCounterfactual` on each exact draft returns `false`. Each draft nevertheless keeps the purchase/acquisition inside `нереализованный вариант` and the conditional `покрыла бы`/`был бы покрыт` consequence, then expressly states that purchase did not occur and coverage is not active. Q7's participle `приобретённое` remains within that unrealized modal clause and is followed by `Продление не было приобретено`; it does not assert actual acquisition. These are four conservative false holds from the bounded Russian counterfactual wording floor, not protected semantic errors.

### `v20-held-exclusion`: complete; 7/8 faithful and one justified draft rejection

Rows 69-71 retain the whole source: the warranty excludes the cracked support plate, this record does not establish whether drive-shaft repair is covered, and it makes no claim that the entire contract is silent. Seven published answers preserve those distinctions and keep the repair as the object whose coverage is unresolved.

Q3's unpublished draft at row 86 says `покрывается ли ремонтом приводного вала`, grammatically making drive-shaft repair an instrumental coverer. It never reaches the verifier. Rejecting this draft is justified: it reverses the required coverage roles. Q5's `покрывается ли гарантией ремонт приводного вала` and q7's `покрывается ли ремонт приводного вала` are faithful alternatives and are published.

### `v20-held-assistant`: complete; 7/8 published, one correct semantic hold, one accepted property error

Rows 104-106 retain the complete tentative assistant claim: monthly connector-continuity testing might be included; the assistant has read neither the agreement nor verified that interpretation; this is a possible contractual term, not an established obligation. The attribution, personal epistemic subject, contractual sense, tentative possibility, and non-established status survive.

Q3's draft at row 121 translates continuity as generic connector integrity (`целостности соединителя`). Row 122 explicitly marks object/mechanism `generalized`, both proposition and action false, and selection false. That is a justified semantic rejection of a bad draft, hence an answer-coverage loss rather than a justified source-level abstention.

Q7 publishes `проверку целостности разъёма` at row 137 despite the same source property. `Целостность` denotes integrity rather than electrical continuity, so this is an accepted material specialization/generalization error. Q1's `непрерывности соединения` and q5's `непрерывности разъёма` retain continuity; all English copies are exact and faithful.

### `v20-held-fiction`: complete; 7/8 published, one correct language hold, proposer/citation defects

Rows 140-143 retain both Ada's actual proposal to discuss and the complete fictional promise: Vulpine Mutual promises fictional Bo Winters free hinge-pin replacements during the first eleven days of ownership, only inside the invented case, with no real contract.

Q1's generated RU draft contains untranslated ordinary `hinge-pin`; rows 147-148 show `compliant:false` and `language_mismatch`. The token is not a protected source identifier. This is a correct language hold of a bad draft and a source-level answer-coverage loss.

Q3 (row 153) accurately renders the fictional promise but replaces Ada's proposal act with `По словам Ada Marlow`; this loses a material queried actor/predicate. It cites only the promise record. Q7 (row 165) says `который Ada Marlow предложила обсудить`, so its content is faithful, but it too cites only the promise record rather than the separate proposal record. Q0/q2/q4/q5/q6 preserve Ada's proposal and the promise roles; their optional omission of the no-real-contract sentence in q6 does not promote the promise because fictional scope remains explicit.

### `v20-held-undated`: complete source lost before verifier; eight coverage losses

Initial row 168 is faithful: Ada proposes reviewing repair terms in the month after the initial record, not after processing; the record date and calendar month are unknown; she has accepted no plan and organized no meeting. Metadata correctly keeps an asserted proposal with tentative unknown time. Local validation raises `time_unresolved`. Row 170 repairs to `next month relative to the initial recording, not processing; the recording date and calendar month are unknown` and preserves the negative plan/meeting clauses, but it also fails locally and never reaches semantic verification.

Frozen helper replay gives, for both exact candidates, `hasSourceRelativeAnchor=false` and `hasUnknownReferenceClock=true`. The failure is therefore the English source-anchor wording (`month after/next month relative to the initial recording`), not missing calendar unknownness, proposer agency, or semantic source loss. Both drafts are faithful under the original bilingual clarification. With no retained record, all eight `no_eligible_evidence` outcomes are downstream source-level coverage losses. V68's new Russian row-233 clock branch was not exercised by these English retention drafts; the exposed replay proves only the helper's capability on that prior Russian answer.

### `v20-held-alternatives`: complete; 8/8 faithful

Rows 172-174 retain one complete record with Ada actively considering a bent guide versus a loosened belt fastening as competing preliminary hypotheses, Ada selecting neither cause, and neither hypothesis having evidence. Rows 175-206 publish all eight variants. They preserve the two alternatives, Ada's consideration and personal nonselection, preliminary status, and evidence absence. The per-record tentative-scope clarification is exercised without making the consideration act tentative or established causes. No accepted defect or hold appears.

## Loss-stage summary and bounded next scope

- **Retention/local false holds:** main report (initial and repair) and undated proposal (initial and repair). These account for 16 `no_eligible_evidence` answers. Both sources are adequately writable; the downstream abstentions are operationally correct but not justified at source level.
- **Answer/local false holds:** four faithful Russian counterfactual drafts fail `hasNominalCounterfactual` before semantic verification.
- **Correct bad-draft holds:** exclusion q3 coverage-role reversal; assistant q3 continuity-to-integrity change; fiction q1 untranslated ordinary technical term.
- **Accepted defects:** assistant q7 repeats the continuity-to-integrity change; fiction q3 loses Ada's proposal act. Fiction q7 is semantically source-supported but has an incomplete selected-record citation.
- **Availability:** no case-level unavailability or routing failure. `generation_failed` is the observed fail-closed language mismatch, not a transport/schema failure.

The smallest coherent follow-up is structural consolidation at the already-existing boundaries:

1. Make report-uncertainty recognition preserve a closed subject-bound pair such as `has not read AGREEMENT or independently checked ACCOUNT`, followed by a bounded relay/self-check clarification, with positive finite retraction, new-subject, quote, and object-switch controls. Keep exact actor/object semantic verification mandatory; do not treat reading and checking as universal synonyms.
2. Normalize generated counterfactual expression around one canonical EN/RU proposition unit that binds unrealized purchase, conditional coverage consequence, explicit nonpurchase, and no-active-coverage scope. Extend a shared bounded floor only for that complete unit rather than adding isolated sampled words.
3. Have English retention generation use a canonical source-entry anchor (`next month measured from/after the undated original source entry, not processing`) already recognized by the independent relative and unknown checks. The repair diagnostic should identify the missing relative subguard rather than the generic `bare tomorrow` message.
4. Require the same material-property comparison consistently across sibling coordinates and keep proposer predicates attached to the actual proposer. When a multi-record answer asserts both proposal and fictional content, require selection/citation of both retained records; original private frames may verify truth but should not make the public citation mapping appear complete.

These changes need no new model call, retry, threshold, schema relaxation, or weaker semantic/language gate. The observed 41/64 production and two accepted material defects do not justify a fresh held-out/full trial from this run.
