# V77 bounded rubric adjudication — initial independent judgment

Scope: source/output-only review of five held-out case/runs from `tmp/language-v77-full-output-packet.json`, using the packet instructions and `tmp/v77-full-grading-contract.md`. I did not read either output grader, another forensic grade, runtime traces, private model verdicts, aggregate scores or target outcomes. I did not call a provider, run a benchmark, alter runtime, PR or issue state, or inspect any case outside the specified rows.

The completion gates necessarily fail coverage, so none of these judgments is chosen to reach a target.

## Rubric interpretation

I distinguish three questions:

1. **Source entailment:** does every retained or published proposition follow from the original source in content and scope? Empty retention is vacuously source-entailed; a null answer has `sourceEntailed:null` by schema.
2. **Usefulness/completeness:** does the complete retained set include every requested useful proposition, and does a focused retrieval/answer supply what its query asks for with required coupled limits?
3. **Qualification preservation:** does wording that remains change or strip the modality, attribution, disposition, polarity, fictional/counterfactual scope, actor attachment or source-clock bounds of a retained/published proposition?

An omitted **independent proposition** makes complete retention or a response incomplete but does not by itself make the propositions that remain falsely qualified. I therefore keep `qualificationPreserved:true` for an empty set, a null answer, or a partial set that merely lacks a separate record, while marking the relevant usefulness/coverage false. This follows the packet instruction: “Omission affects usefulness unless it changes a coupled scope qualification.”

An omitted clause that directly governs the interpretation of retained content is different. Removing the false antecedent from a counterfactual, the fictional-only frame from a story, the inner speaker from a report, or the explicit competing clock from a source-relative date can strengthen or redirect the proposition that remains. That warrants `qualificationPreserved:false`, even when the shortened statement is still individually source-entailed and introduces no unsupported fact.

## `v22-held-fictional-example`, run 1

### Source and retained set

The source has two useful acts:

- Ada: “am introducing an invented example for discussion; it describes no real agreement”; and
- inside that story, fictional Vulpine Mutual lends fictional Bo Winters a spare Zephyr QX-100 control dial for forty-four days after a fictional repair; the loan exists only in the story.

The retained set contains only the loan record. It says “In Ada Marlow’s fictional story,” keeps both fictional participants, the spare control dial, forty-four-day interval after a fictional repair, story-only loan and no-real-agreement limit. It does not explicitly retain Ada’s actual introduction-for-discussion act.

My case judgment:

- `retentionUseful:false`: the complete useful set lacks the actual introduction/discussion proposition requested by the source expectation.
- `retainedSourceEntailed:true`: every saved proposition is source-supported.
- `knowledgeLanguageCompliant:true`.
- `qualificationPreserved:true`: omission of the introduction act does not de-fictionalize the retained loan. The remaining text independently and repeatedly supplies the fictional/story-only/no-real-agreement scope.
- `unsafeFactualPromotion:false`.

### Retrieval and answers

All eight coordinates retrieve the same loan record. It contains the specific loan the query asks to identify, its actors, object, duration and fictional scope. I count `usefulQualifiedRetrieval:true` for all eight despite the incomplete complete-retention set: focused retrieval need not repeat the separate act of introducing the example when the retrieved record identifies the requested loan as Ada’s fictional story.

The four inferred-view coordinates are null:

- `en→en`, inferred;
- `en→ru`, inferred;
- `ru→en`, inferred; and
- `ru→ru`, inferred.

Each is an unjustified writable abstention and not useful. I assign `qualificationPreserved:true`: withholding everything loses coverage but publishes no scope distortion.

The four explicit-view coordinates publish the complete retained loan (`en→en`, `en→ru`, `ru→en`, `ru→ru`). Each is useful, source-entailed, language-compliant and qualification-preserving. Russian “диск управления” is a reasonable rendering of the source’s control dial in this context; it does not substitute a different tested component or mechanism.

## `v22-held-relative-unknown-date`, run 1

### Source and retained set

The source states an actual proposal to compare cleaning instructions **two weeks after the source record**, no agreed meeting, no date on the original record, no recoverable calendar date, and an explicit reference-clock contrast: “две недели отсчитываются от записи, а не от дня обработки.” It also makes clear that the uncertain calendar date does not make Ada’s act of proposing uncertain.

The retained record preserves Ada’s proposal, comparison object, two-week relation to the record, unknown record/calendar date, proposal-only status and no agreed meeting. It omits “not from the day of processing.”

My case judgment:

- `retentionUseful:false`.
- `retainedSourceEntailed:true`.
- `knowledgeLanguageCompliant:true`.
- `qualificationPreserved:false`.
- `unsafeFactualPromotion:false`.

The missing processing-clock contrast is not a separate neighboring fact like an appointment denial. It directly constrains the retained two-week timing proposition and is singled out by both the original and review expectation. “Two weeks after the record” plus “the record has no date” points strongly to the right clock, so the retained text does not assert a false date. But the grading contract requires source-clock limits to travel together; omitting the explicitly excluded competing clock makes the time qualification incomplete. The visible `Proposal · Tentative` label is not by itself a promotion: the body states an actual proposal and explains that the date, rather than the act of proposing, is unresolved.

### Retrieval and answers

Every coordinate retrieves that same incomplete record. Because the missing clause qualifies the exact relative-time proposition the query asks about, I count `usefulQualifiedRetrieval:false` for both answer-language rows of every query/view pair.

Coordinate judgments:

- `en→ru`, inferred: useful and qualification-preserving. It explicitly restores “Две недели отсчитываются от исходной записи без даты, а не от дня обработки,” then preserves unknown date, actual proposal and no meeting.
- `en→ru`, explicit: null, unjustified, not useful, `qualificationPreserved:true` as a coverage-only abstention.
- `en→en`, inferred and explicit; `ru→en`, inferred and explicit; `ru→ru`, inferred and explicit: nonnull and source-entailed, but not useful qualified answers and `qualificationPreserved:false`, because each repeats the time proposition without the explicit non-processing clock limit.

All nonnull answers otherwise use the requested language, preserve Ada’s actual proposal, the two-week source-record anchor, unknown calendar date and no-agreed-meeting status, and make no unsafe factual promotion.

## `v22-held-rejected-plan`, run 1

### Source and retained set

The source establishes a proposal to take Zephyr QX-100 to a calibration room to measure its rotation-stop angle, Ada’s rejection and lack of intent to act under it, no reserved appointment, no arranged transport, and a final reiteration that the proposed measurement remains rejected.

Run 1 retains:

1. the complete rejected proposal, destination, exact measurement purpose and Ada’s lack of intent; and
2. the independent no-appointment/no-transport denials.

The last source sentence repeats the already explicit rejection and need not become a third record. My case judgment is `retentionUseful:true`, `retainedSourceEntailed:true`, `knowledgeLanguageCompliant:true`, `qualificationPreserved:true`, `unsafeFactualPromotion:false`.

### Retrieval and answers

All eight coordinates retrieve and publish the rejected-proposal record. The question asks which proposal Ada rejected. The answers preserve rejection, Ada as rejector, the calibration-room destination, rotation-stop-angle measurement purpose and lack of intent. They may omit the separate no-appointment/no-transport record in a focused answer; those denials are not needed to identify the rejected proposal and their omission does not imply that an appointment or transport exists.

I mark all eight retrievals and answers useful and qualified, with source entailment and requested language preserved. Russian “калибровочная лаборатория/комната/помещение” and “угол остановки/ограничителя/ограничения вращения” are natural variants retaining the calibration destination and rotation-stop-angle purpose rather than changing the action or measured property.

## `v22-held-rejected-plan`, run 2

### Source and retained set

Run 2 retains only the rejected proposal and Ada’s lack of intent. It entirely omits the independent propositions “No appointment has been reserved” and “no transport has been arranged.”

My case judgment:

- `retentionUseful:false`: the complete requested useful set is missing both independent arrangement denials.
- `retainedSourceEntailed:true`.
- `knowledgeLanguageCompliant:true`.
- `qualificationPreserved:true`: the omission is coverage-only. It does not change the rejection, intended destination/purpose, Ada’s agency or lack of intent in the record that remains, and the retained text does not assert that an appointment or transport exists.
- `unsafeFactualPromotion:false`.

### Retrieval and answers

All eight coordinates retrieve and publish the retained rejected-proposal record. As in run 1, this focused record completely answers which proposal Ada rejected. The absent appointment/transport statements are useful source facts but are not coupled scope qualifications for this query.

I mark all eight retrievals and answers useful, source-entailed, language-compliant and qualification-preserving, with no promotion. Complete-retention failure does not automatically make focused retrieval or answer failure.

## `v22-held-counterfactual`, run 2

### Source and retained set

The source states actual non-enrollment in an optional corrosion plan and a counterfactual benefit: if Ada had enrolled, internal-spring replacement after thirty-three months of use would have been free. The plan was not enrolled, so the consequence is unrealized and not current coverage.

Run 2 retains both propositions separately. The counterfactual record keeps the false enrollment antecedent, internal-spring object, thirty-three-month usage interval, free replacement consequence, actual non-enrollment and unrealized result. My case judgment is `retentionUseful:true`, `retainedSourceEntailed:true`, `knowledgeLanguageCompliant:true`, `qualificationPreserved:true`, `unsafeFactualPromotion:false`.

### Retrieval and answers

The four inferred-view coordinates retrieve only the actual non-enrollment record. That is source-entailed context but does not supply the requested unrealized internal-spring benefit, so all four have `usefulQualifiedRetrieval:false`.

- `en→en`, inferred; `en→ru`, inferred; and `ru→en`, inferred are null: unjustified writable abstentions, not useful, `qualificationPreserved:true` as omission-only.
- `ru→ru`, inferred publishes only “Ada Marlow не включила свой Zephyr QX-100 в необязательный план защиты от коррозии.” It is source-entailed and correctly qualified but nonresponsive, hence not useful. Its failure is selection/usefulness, not a qualification error.

The four explicit-view coordinates retrieve the complete counterfactual record, so all four have `usefulQualifiedRetrieval:true`.

- `en→en`, explicit; `ru→en`, explicit; and `ru→ru`, explicit publish useful, source-entailed, language-compliant and qualification-preserving answers. They preserve the false antecedent and unrealized consequence rather than asserting current coverage.
- `en→ru`, explicit is null: unjustified, not useful, and `qualificationPreserved:true` as a coverage-only abstention.

## Consolidated disposition

The disputed omission rule should be applied as follows:

- **Coverage-only with `qualificationPreserved:true`:** missing Ada’s distinct introduction act in fictional-example run 1; missing independent appointment/transport denial records in rejected-plan run 2; null answers; and the counterfactual inferred answer that states only accurate non-enrollment.
- **Qualification loss with `qualificationPreserved:false`:** the relative-unknown-date retained record and every answer that repeats its two-week timing proposition while omitting the source’s explicit “not from processing day” clock contrast.
- **Focused answer/retrieval remains useful despite incomplete complete retention:** the explicit fictional-loan answers and all rejected-plan answers. They answer the query with their necessary scope even where another independently useful source proposition was not retained.
- **Complete retention is not rescued by focused answers:** fictional-example run 1 and rejected-plan run 2 remain incomplete retained sets; relative-unknown-date run 1 remains incomplete in a coupled temporal qualification.

This initial adjudication should remain preserved before consultation of either full output grade or any other forensic interpretation.
