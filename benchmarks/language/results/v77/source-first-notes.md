# V77 full evaluation: source-first semantic obligations

Status: sealed first-pass source review. These notes were derived only from `language-v22-blind-inputs.json` and `v77-source-grading-contract.md`, before inspection of any runtime output, trace, verifier decision, prior grade, aggregate result, or implementation. They are source obligations, not runtime verdicts.

Corpus: 22 cases, comprising 20 writable cases and 2 read-only admission cases. Each runtime answer must later be judged independently at all eight query-language × answer-language × explicit-view coordinates. Paired coordinates may share a retrieval grade only where the retrieved material is the same. A nonnull answer must answer the query, remain entailed by the original source, use the requested answer language apart from canonical proper names, and carry every qualification coupled to the proposition it selects. A null answer is never useful; its source-entailment and language-compliance fields are null, and abstention is source-justified only when the original source itself does not permit an answer. For read-only admission holds, policy may correctly prevent retention and answering even though the source is understandable; this must not be described as absent knowledge or service unavailability.

## v20-held-report — writable

- Core proposition: Ada Marlow actually relays Bo Winters's report that the agreement permits sending Zephyr QX-100 to a workshop to measure the gap at the latch.
- Coupled semantic scope: Ada is the outer relayer; Bo is the inner claimant; permission is reported rather than verified. The intended service is measurement of latch gap, explicitly not replacement of the latch.
- Epistemic obligations: Ada personally has neither read the agreement nor independently checked/verified Bo's account. These are personal limits and do not establish universal lack of verification.
- Independent negative fact: Ada has not arranged delivery of her device. This does not imply that nobody arranged anything, nor that service occurred.
- Actor/action/property/time constraints: keep the agreement as permitting shipment, the workshop as destination, the latch gap as measured property, and avoid inventing a date or converting the report into completed work.

## v20-held-hypothesis — writable

- Core proposition: Ada Marlow introduces a hypothetical rule under which the Zephyr QX-100 mesh screen is inspected every three months.
- Coupled consequence: only under that assumption, missing such an inspection would breach the assumed rule.
- Epistemic/discourse obligations: Ada does not know the real requirements; this is conditional analysis, not an established maintenance duty and not a report of an actual missed inspection.
- Actor/action/property/time constraints: Ada performs the introducing act; three months is a recurring-frequency property, not an event date.

## v20-held-counterfactual — writable

- Core proposition: if Ada Marlow had purchased the optional repair extension, a wheel-hub repair in the fifth year would have been covered.
- Coupled false antecedent and actuality: Ada declined and did not purchase the extension; therefore the described coverage is unrealized and is not her current coverage.
- Complete-retention obligation: useful retention includes both the actual refusal/nonpurchase and the counterfactual benefit. A focused answer still must preserve the false antecedent and no-current-coverage scope.
- Actor/action/property/time constraints: Ada is purchaser/nonpurchaser; coverage concerns wheel-hub repair; “fifth year” is an ordinal duration within the counterfactual, not a calendar date.

## v20-held-question — writable

- Core proposition: Ada Marlow has an unresolved question whether regular seal lubrication is included in the Zephyr QX-100 servicing contract.
- Coupled uncertainty: Ada has no answer; neither inclusion nor exclusion of that service is established.
- Scope constraints: the source does not establish silence of the whole contract and does not say Ada externally asked, wrote, or sent the question.
- Actor/action/property/time constraints: Ada holds the question; the property at issue is contractual inclusion of regular lubrication; no service event or date is asserted.

## v20-held-exclusion — writable

- Core proposition: Ada Marlow asserts that the Zephyr QX-100 warranty does not cover a cracked base plate.
- Coupled separate limitation: this exclusion record does not settle whether drive-shaft repair is covered, and it does not establish that the entire contract is silent.
- Polarity and relation constraints: preserve the negative coverage polarity. The warranty is the covering instrument and cracked-base-plate damage/repair is excluded; do not reverse the relationship or infer either inclusion or exclusion for the drive shaft.

## v20-held-assistant — writable

- Core proposition: the assistant tentatively suggests that Zephyr QX-100 servicing might include a connector-continuity test each month.
- Coupled epistemic limits: the assistant personally has not read the service agreement and has not verified the interpretation.
- Modal/status constraints: it is only a possible contractual term, not an established obligation, performed test, or device state. Personal unread/unverified status must not become a global claim of absent examination or evidence.
- Time constraint: monthly is a recurring service frequency, not a dated event.

## v20-held-fiction — writable

- Core proposition: Ada Marlow actually proposes discussing an invented case in which fictional Vulpine Mutual promises fictional Bo Winters free Zephyr QX-100 hinge-pin replacements during the first eleven days of ownership.
- Coupled discourse scope: the promise exists only inside the made-up case. No real agreement or promise is created, and proposing discussion does not establish that discussion occurred.
- Actor/action/property/time constraints: fictional Vulpine is promisor, fictional Bo beneficiary, free hinge-pin replacements are the promised benefit, and eleven days is a story-scoped duration rather than a dated event.

## v20-held-rejected — writable

- Core proposition: Ada Marlow rejected an offer to send Zephyr QX-100 to a service room for visual inspection of its pressure valve.
- Coupled actuality and negatives: Ada does not intend to send the device under that offer; no carrier collection has been arranged; the offered shipment remains rejected and unaccepted.
- Actor/action/property constraints: preserve Ada as rejecter, service room as destination, and visual pressure-valve inspection as purpose. Do not infer shipment, inspection, acceptance, or an unsupported causal relation.

## v20-held-undated — writable

- Core proposition: Ada Marlow actually proposes reviewing Zephyr QX-100 repair terms in the month after the original record.
- Coupled temporal envelope: the original record is undated, so the calendar month is unknowable; “next month” is anchored to the source record rather than processing time.
- Coupled planning status: this is Ada's proposal only; she has not accepted a plan or organized a meeting.
- Scope constraint: uncertainty affects the calendar date, not whether Ada made the proposal.

## v20-held-alternatives — writable

- Core proposition: Ada Marlow considers two competing tentative hypotheses for a Zephyr QX-100 fault: a bent guide rail or a loose belt fastener.
- Coupled epistemic status: Ada has selected neither cause, and neither hypothesis has supporting evidence.
- Scope constraints: consideration is not necessarily interpersonal discussion; neither option is an established cause; retain both distinct alternatives without generalizing the second into an unspecified installation error.

## v20-held-admission — read-only

- Source proposition, if merely interpreting the source: Ada Marlow recorded a thirty-three-month warranty for Zephyr QX-100.
- Admission obligation: the designated destination is read-only. Preserve source bytes and return a distinct typed admission hold with no retained record and no unsupported answer.
- Diagnostic distinctions: policy denial is not source absence, an empty knowledge result, or service unavailability. Although the source answers the semantic question, no writable answer may be credited after the required hold.
- Time constraint: thirty-three months is warranty duration, not a date.

## v22-held-nested-report — writable

- Core proposition: Ada Marlow relays Bo Winters's claim that Vulpine Mutual permits bringing Zephyr QX-100 to a workshop to check the resistance of its grounding contact.
- Coupled report chain and correction: Ada is outer relayer, Bo inner source, and Vulpine the alleged permission-giver. The action is resistance testing, explicitly not contact replacement.
- Coupled epistemic limits: Ada did not see the rules and did not verify Bo's report. Thus permission is not confirmed.
- Independent negative fact: Ada has not yet packed her device. This does not establish completed delivery or service.

## v22-held-conditional-hypothesis — writable

- Core proposition: Ada Marlow sets out a hypothetical schedule under which the Zephyr QX-100 drain channel is cleared every six weeks.
- Coupled consequence: only under that assumption, leaving it uncleared for seven weeks would breach the assumed schedule.
- Epistemic/discourse obligations: Ada does not know the real maintenance rule and reports no actual missed clearing. Neither the schedule nor breach is an established fact.
- Time constraints: six weeks is recurring frequency; seven weeks is the conditional elapsed interval; neither is a calendar event.

## v22-held-counterfactual — writable

- Core proposition: if Ada Marlow had enrolled Zephyr QX-100 in the optional corrosion plan, internal-spring replacement after thirty-three months of use would have been free.
- Coupled false antecedent and actuality: Ada did not enroll; the benefit is unrealized and not current coverage.
- Complete-retention obligation: retain both actual non-enrollment and the counterfactual benefit. A focused answer must retain its dependency on enrollment.
- Time constraint: thirty-three months is an elapsed-use threshold inside the counterfactual, not a calendar date.

## v22-held-coverage-exclusion — writable

- Core proposition: Ada Marlow records that the Zephyr QX-100 warranty excludes sand-caused damage to the ceramic spacer.
- Coupled separate limitation: this exclusion alone does not settle whether intake-sleeve replacement is covered and does not establish that the agreement is silent about the sleeve.
- Polarity and relation constraints: preserve the excluded damage, its sand cause, and the warranty-to-damage coverage direction. Do not infer inclusion or exclusion for sleeve replacement.

## v22-held-assistant-speculation — writable

- Core proposition: the assistant speculates that Zephyr QX-100 servicing may include checking the optical shutter after every eleven operating cycles.
- Coupled epistemic limits: the assistant personally has not read the agreement and has not verified the guess.
- Modal/status constraints: this is a possible service term, not a real duty, performed check, or device condition. Do not universalize the assistant's personal limits.
- Time constraint: every eleven operating cycles is a recurring trigger/property rather than a dated event.

## v22-held-fictional-example — writable

- Core proposition: Ada Marlow actually introduces an invented example for discussion in which fictional Vulpine Mutual lends fictional Bo Winters a spare Zephyr QX-100 control dial for the first forty-four days after a fictional repair.
- Coupled discourse scope: the loan and repair exist only in the story, and the example describes no real agreement.
- Actor/action/property/time constraints: fictional Vulpine is lender, fictional Bo borrower, a spare control dial is the object, and forty-four days after the fictional repair is story-relative duration. No real agreement, repair, loan, or elapsed real-world period is established.

## v22-held-relative-unknown-date — writable

- Core proposition: Ada Marlow actually proposes comparing Zephyr QX-100 cleaning instructions two weeks after the original record.
- Coupled temporal envelope: the record has no date, so the calendar date is unknowable; the interval is anchored to the record rather than the processing day.
- Coupled planning status: it is Ada's proposal only, and no meeting has been agreed.
- Scope constraint: calendar uncertainty does not make the occurrence of the proposal uncertain.

## v22-held-competing-hypotheses — writable

- Core proposition: Ada Marlow considers two competing tentative causes of a possible Zephyr QX-100 rattle: a deformed washer or an inadequately secured filter cover.
- Coupled epistemic status: Ada selected neither; neither has supporting evidence; the record itself also does not confirm that the rattle exists.
- Scope constraints: retain both alternatives separately and do not establish either fault, combine them, or treat the rattle as observed fact.

## v22-held-open-question — writable

- Core proposition: Ada Marlow has an unresolved question whether the Zephyr QX-100 service plan includes annual alignment of the folding handle.
- Coupled uncertainty: Ada personally lacks the answer; this note establishes neither inclusion nor exclusion.
- Scope constraints: do not infer contract silence, a performed alignment, or universal ignorance.
- Actor/action/property/time constraints: Ada holds the question; annual is a recurring frequency attached to a possible service-plan term, not a recorded event date.

## v22-held-rejected-plan — writable

- Core proposition: Ada Marlow rejected a proposal to take Zephyr QX-100 to a calibration room to measure its rotation-stop angle.
- Coupled actuality and negatives: Ada does not intend to take it there under the proposal; no appointment is reserved and no transport is arranged; the proposed measurement remains rejected.
- Actor/action/property constraints: preserve Ada as rejecter, calibration room as destination, and rotation-stop angle as the exact measured property. Do not infer acceptance, travel, measurement, or unsupported causation.

## v22-held-read-only-admission — read-only

- Source proposition, if merely interpreting the source: Ada Marlow asks that a record be remembered in a write-prohibited folder stating that Vulpine Mutual replaces the Zephyr QX-100 protective ring every fifty-five months.
- Admission obligation: the explicit destination denies writes. Preserve source bytes and return the typed admission hold, with no retained record and no answer credited as a writable success.
- Diagnostic distinctions: policy denial is distinct from missing source knowledge, an empty result, or service unavailability. The maintenance claim must not be retained elsewhere to bypass the destination restriction.
- Actor/action/property/time constraints: Vulpine is the stated replacement actor, protective ring the object, and fifty-five months the recurring interval rather than a date.

## Output-stage grading commitments

At output review, grade every one of the 352 coordinates independently: 22 cases × 2 runs × 8 answer coordinates. Keep the two read-only cases distinct from the 20 writable cases when counting successful writable answers. First inspect the retained records against the source obligations above, including complete useful retention; then inspect each retrieval result as actually returned; then inspect each nonnull answer against the original source rather than treating retained text as authority. A focused subset may pass only when it directly answers the query and retains all qualifications coupled to its selected proposition. Any factual promotion, polarity reversal, actor swap, report-chain collapse, modal loss, invented event/date, or broadened ignorance/absence claim fails source entailment and qualification preservation as applicable.
