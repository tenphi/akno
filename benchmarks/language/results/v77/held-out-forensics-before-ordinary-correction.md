# V77 full held-out source-first forensic review — initial

Reviewer: independent Sol review (`/root/language_blind_review`)
Frozen runtime: `a67faa3fd3a6f59450a35c4af1d66baa96fee4e8`
Evidence: [`language-v77-full-forensic-source-first-notes.md`](language-v77-full-forensic-source-first-notes.md), [`language-v77-full-held-out-output-packet.json`](language-v77-full-held-out-output-packet.json), [`language-full-held-out-v77.json`](../bench-results/language-full-held-out-v77.json), and [`language-full-held-out-v77-trace.jsonl`](../bench-results/language-full-held-out-v77-trace.jsonl). I formed source judgments from the sealed notes and packet before consulting trace verdicts. I did not inspect an output-grading receipt.

## Disposition and counts

- The terminal held-out split contains 22 case-runs and 176 query coordinates: 20 writable case-runs/160 coordinates plus two read-only case-runs/16 coordinates.
- 106/176 coordinates published an answer. The other 70 comprise 62 `no_eligible_evidence`, five `empty_draft`, two `verification_rejected`, and one `draft_rejected`. There are no operation-unavailable cases.
- All 22 source trees report stable bytes and successful replay. The two read-only cases correctly retain nothing and return 16 typed no-evidence results; these are policy holds, not knowledge absence or service unavailability.
- I count 15/20 writable case-runs with the complete useful retained set. Both nested-report runs and both assistant-speculation runs lose their governing record. Rejected-plan run 2 loses the independent no-appointment/no-transport record. The other 15 sets preserve their source propositions and qualifications. All five incomplete cases still have stable source bytes.
- I find 105/106 published answers useful for the focused query and faithful in material source, actor, polarity, qualification, language, and citation dimensions. Counterfactual run 2, q5 is the sole accepted usefulness error: it states only Ada's non-enrollment and omits the queried unrealized internal-spring replacement benefit. It is source-true and correctly Russian, but nonresponsive to the focused benefit query.
- I found no unsupported promotion, wrong-language publication, source-byte mutation, or availability error. Retained typed metadata is materially consistent with the retained propositions in this split.

## Retention and routing

### Nested report — incomplete in both runs

The source requires a nested attribution (Ada relays Bo), alleged workshop permission to check grounding-contact resistance, explicit exclusion of replacement, Ada's personal lack of seeing/checking, and a separate not-packed fact. Run 1 retains only the separate not-packed fact; run 2 retains nothing. Thus neither retained set can answer the report query.

Trace rows 6/14/19 (call IDs 1/4/7) show run 1 initial extraction, sole repair, and verification of only the surviving denial. Rows 1515/1523 (call IDs 650/653) show the corresponding run 2 extraction/repair path. Both main records are locally held as `discourse_uncertain`; the resulting 16 nulls are safe publications but false case abstentions because the original contains a complete qualified answer. Run 1 q4/q5 reach generation and return an empty draft (answer calls 29 and 33 at rows 67 and 77); the other report coordinates stop at no eligible evidence. Private guard results diagnose the stage but do not alter the source conclusion.

### Assistant speculation — incomplete in both runs

The source is explicitly the assistant's preliminary guess: possible optical-shutter checking after every eleven operating cycles, coupled to the assistant's not reading the contract, not checking the guess, and denial that it is an established obligation or device state. Neither run retains a record. Run 1 initial/repair events are rows 590/598 (call IDs 252/255); run 2 uses rows 2108/2116 (904/907). All 16 answer coordinates safely return `no_eligible_evidence`, but each is a false case abstention relative to the source. Run 1 also reports a typed language degradation during retention; run 2 ends as a local discourse hold, so the repeated semantic loss cannot be reduced to that one run's language event.

### Rejected plan — run-specific completeness loss

Run 1 retains both (a) Ada's rejected calibration-room proposal, exact rotation-stop-angle measurement purpose, and no intent, and (b) the independent absence of a reserved appointment and arranged transport. Run 2 retains only (a). All eight run-2 answers are useful focused-subset answers because the query asks which proposal Ada rejected and each answer preserves destination, measurement property, rejection, and lack of intent. Nevertheless, run 2's retained set is incomplete and cannot support a later query specifically about appointment/transport absence.

### Complete retained sets

Both runs of conditional hypothesis, coverage exclusion, fictional example, relative unknown date, competing hypotheses, and open question are complete. Counterfactual run 1 combines the false enrollment antecedent, free internal-spring replacement after 33 months, actual non-enrollment, and unrealized status in one qualified record; run 2 preserves the same content across two records. Rejected-plan run 1 is also complete. Their subjects, commitment/disposition, polarity, and eligibility metadata do not promote hypothetical, tentative, question, rejected, or fictional content into current fact.

Fictional-example outputs preserve Ada as the introducer, the fictional loan parties/object/duration, and the no-real-agreement boundary. The proposal-to-discuss wording is represented by “introduced ... for discussion” or an equivalent Russian construction. Coverage outputs preserve the sand-caused ceramic-spacer exclusion while leaving intake-sleeve replacement unresolved and avoid converting the source into general contract silence. Hypothesis outputs preserve the assumed six-week schedule, conditional seven-week breach, Ada's lack of actual-rule knowledge, and denial of an actual missed clearing. Competing-hypothesis outputs preserve both alternatives, no selection, no supporting data, and the record's failure to confirm the rattle itself.

## Published-answer audit

The 105 faithful/useful publications include all 16 conditional-hypothesis answers, all 16 coverage-exclusion answers, eight fictional-example answers, 15 relative-date answers, 12 competing-hypothesis answers, 15 open-question answers, 16 rejected-plan answers, and seven counterfactual answers. English/Russian renderings keep protected names and requested output language.

Counterfactual run 2 q5 is the exception. Its public answer is only “Ada Marlow не включила свой Zephyr QX-100 в необязательный план защиты от коррозии” with citation `memory/equipment:6`. That clause is supported by E1, but it does not state the queried benefit (free internal-spring replacement after 33 months under the unrealized enrollment condition). Trace rows 1857–1865 (answer call 798; verifier call 801) show it passed the ordinary answer/verifier path. This is a focused-answer selection/completeness error, not a fabrication, language failure, or promotion.

## Null and hold audit

- The 48 nulls from the two nested-report runs, two assistant-speculation runs, and two read-only runs are explained above: 32 false source-true abstentions from writable retention loss and 16 correct admission-policy holds.
- Counterfactual run 1 q0/q1/q4/q5 are `no_eligible_evidence`; run 2 q0/q1/q4 are `empty_draft`, and q3 is `draft_rejected`. The available published coordinates demonstrate a complete supported answer existed in each run. These 8 nulls are safe but unnecessary view/query-path losses, rather than evidence that the source is unanswerable.
- Fictional example q0/q1/q4/q5 in each run (8 nulls) and competing hypotheses q4/q5 in each run (4 nulls) likewise withhold answerable qualified material. They are safe false abstentions under the declared focused-query contract.
- Relative-date run 1 q3 is `verification_rejected`. The draft/source preserve Ada's proposal, two weeks relative to the undated source record rather than processing, unknowable calendar date, and no agreed meeting; verifier row 866 (call 374) is therefore a false semantic hold.
- Open-question run 1 q5 is `verification_rejected`. The source and draft preserve the annual folding-handle-alignment question, Ada's own lack of an answer, and neither inclusion nor exclusion. Verifier row 1226 (call 526) is a false semantic hold.

The 70 nulls are therefore: 16 correct read-only policy holds; 32 source-true nulls caused by governing retention loss; and 22 additional safe but unnecessary answer-stage/query-view abstentions. None is typed unavailable.

## Ordinary projection and operational metadata

`ordinaryCorrect` is 16/22. The six false cases are both nested-report runs, both assistant-speculation runs, and both competing-hypothesis runs. The first four align with governing retention loss. The competing-hypothesis retained prose is source-faithful and non-promoted, so those two ordinary mismatches are not factual-admission leakage; they are an ordinary projection/classification mismatch against a correctly qualified tentative record. `ordinaryInspection` is `ok` with one result for all six, which does not make the projected result source-correct.

All 22 cases report `bytesStable:true`; replay covers all 22. There are no operation failures, provider/schema availability failures, or evidence of cap exhaustion in the completed report. Trace lifecycle entries must not be counted as extra semantic passes: they instrument the same calls.

## Smallest supported next scope

The dominant loss is upstream retention, not public translation. A bounded next design should address the report and assistant records as complete proposition units while preserving their explicit source actor, personal epistemic predicates and objects, and non-establishment clauses; it should not weaken the downstream full-source semantic verifier. The run-specific rejected-plan loss needs independent-denial retention coverage, not changes to focused-answer requirements. At answer time, selection should require the chosen clauses to answer the query's requested predicate: citing a source-true non-enrollment clause cannot substitute for the requested counterfactual benefit. The two exact semantic false holds warrant verifier prompt/audit inspection, but not a semantic bypass.

## Limits

This is one terminal two-run held-out measurement. Model calls are stochastic, so recurrence differences do not prove a version effect. Private readings, alignment narratives, and positive booleans were treated as fallible diagnostics. I did not require focused answers to repeat unrelated retained neighbors, and I did require every asserted clause and coupled qualification to be supported by its cited record.

## Finalization receipt

The initial source-first classification was retained unchanged after a denominator, null-reason, and trace-coordinate audit. Final counts remain 15/20 complete writable retained sets, 106 published answers, 105 useful/faithful focused answers, one accepted focused-selection error, 70 nulls (16 correct policy holds and 54 safe but unnecessary source-true abstentions), zero unavailable cases, and 22/22 byte-stable/replayed cases.

## Post-cross-review correction

The pre-cross-review final is preserved at `language-v77-full-held-out-forensics-final-pre-crossreview.md`. Two retained-set classifications and four answer classifications change after exact query/text reconciliation:

- Fiction run 1 is **not** a complete retained set. Its record says only “In Ada Marlow’s fictional story”; it omits the source-actual act that Ada introduced the example for discussion. Because both held-out queries explicitly ask what loan Ada introduced/proposed for discussion, q2/q3/q6/q7 are source-entailed but omit a queried act and are not fully useful qualified answers.
- Relative-date run 1 is **not** a complete retained set because the retained prose omits the source's explicit contrast with processing time. I still count its six published answers that say “two weeks after the record” as useful: the query asks for time relative to the record, and that affirmative anchor answers it without asserting a processing-time anchor. The missing negative contrast is a retained-set coverage loss, not a distortion in those focused answers.

Corrected held-out totals are therefore 13/20 complete writable retained sets and 101/106 useful qualified published answers. The five non-useful publications are fiction run 1 q2/q3/q6/q7 and counterfactual run 2 q5. All 106 remain source-entailed and language-compliant; the errors are queried-act/selection completeness, not fabrication or factual promotion.

I do not adopt the cross-review's requirement that focused rejected-proposal answers repeat independent appointment/transport negatives, or that development report answers repeat the independent no-delivery denial. The grading contract permits focused source-entailed subsets while requiring coupled actors, objects, properties, report chains, and scope to travel together. These negatives are expressly separate source facts and are not predicates or qualifications of “which proposal” / “what report” in the query. Omitting them makes the retained set incomplete where absent; it does not make a focused answer about the fully qualified proposal/report non-useful.

Availability has two distinct denominators. Held-out has 0/22 runtime case-level availability failures and zero unavailable query coordinates. This is separate from semantic/local false holds.
