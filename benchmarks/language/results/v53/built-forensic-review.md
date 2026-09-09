# V53 built-package forensic audit

## Scope and coordinate key

This is an evidence/cause audit of the frozen V53 built-package run at `9d58554`. I read only the requested result, trace and diagnostic packet, then the separately authorized seating-modifier convention note after preserving my initial interpretation with the parent. I did not inspect the independent grading receipt, run a model, retry a case or edit runtime code.

Every case uses the same query order:

| Coordinate | Query → answer | View |
| --- | --- | --- |
| q0 | EN → EN | inferred |
| q1 | EN → RU | inferred |
| q2 | EN → EN | explicit |
| q3 | EN → RU | explicit |
| q4 | RU → EN | inferred |
| q5 | RU → RU | inferred |
| q6 | RU → EN | explicit |
| q7 | RU → RU | explicit |

The run produced 26/32 answers. Six were null: four `empty_draft`, one deterministic `draft_rejected`, and one `verification_rejected` ([result summary](built-reliability.json#L55)). There were no operation/availability failures, schema errors, degraded calls, routing holds or source-byte changes. All four expected retained sets were written, and every query retrieved its relevant retained record.

On the source-only convention now established for this run, 25/32 outputs are useful answers: all six nulls are unjustified writable-case abstentions because the source offers a faithful answer, while one of those six correctly rejects the particular bad draft it received; one nonnull answer has a material manner/specificity loss. I found no accepted factual promotion, speaker reversal, report-scope globalization, plan acceptance, completed action or language-policy violation.

## v18-held-report

### Retention, placement and retrieval

The original English span says the terms permit sending the device to a technician for **dial calibration**; the Russian span gives the same reported content as **regulator calibration, not regulator replacement**, then states that Ada has neither seen the terms nor received confirmation ([original](./language-built-output-packet-v53.json#L18)). Retention produced:

> Bo Winters reportedly says that ... the device [may be sent] to a technician for regulator calibration, not regulator replacement; Ada Marlow says she has not seen the terms and has not received confirmation ...

This is a useful bilingual clarification, not a conflict. It keeps Ada as outer recorder/source, Bo as inner reporter, the permitted action and destination, the calibration/replacement contrast, and both personal epistemic limits ([retained record](./language-built-output-packet-v53.json#L39)). The separate “Ada gave no instruction to collect” proposition was retained as its own self-attested negative record. Both records were written; the report query retrieved only the report record in all eight runs, so neither proposition borrowed the other's actor or scope.

The retention verifier actually recognized the relation: its span audit calls the Russian regulator wording a `clarification` of the reported calibration referent and accepts both personal limits ([trace](../../../../bench-results/language-built-reliability-v53-trace.jsonl#L3)). Placement and retrieval therefore are not the cause of the answer gap.

### q0–q3: four unjustified empty drafts

All four English-query runs returned zero blocks. Their exact reasons were:

- q0: “whether ... calibration ... concerned the dial or the regulator; ... conflicting values”;
- q1: unresolved conflict between `калибровкой регулятора` and `калибровкой шкалы`;
- q2: both descriptions allegedly appear “without establishing which is authoritative,” plus a separate caution about the query's `recorded` presupposition;
- q3: unresolved component-label conflict between `dial calibration` and `regulator calibration`.

The raw generation outputs are consecutive trace entries ([q0–q3](../../../../bench-results/language-built-reliability-v53-trace.jsonl#L6)). Each input contains the selected retained record and its bound `retention_source_frame`, including both exact bilingual spans. Thus V53's source-frame binding reached generation; no frame lookup or excerpt-selection failure occurred. The same evidence had already been interpreted as clarification by retention verification. The generator nevertheless let the English query term reopen the resolved source meaning. The Russian query, which says regulator calibration, yielded an answer in all four otherwise equivalent runs. Explicit versus inferred view had no effect. This is a query-conditioned generation interpretation failure, and no answer verifier ran because generation emitted no block.

### q4–q7: four useful qualified answers

All four Russian-query runs state regulator calibration rather than replacement, keep permission distinct from an arranged shipment, preserve Ada/Bo attribution, and explicitly preserve that Ada personally had not seen the terms and had not received confirmation. The wording does not claim that nobody anywhere confirmed the report. It therefore complies with the standing scoped report-status convention.

q7 says `Bo Winters якобы сообщил`. `Якобы` can be heard as skepticism about whether Bo spoke, whereas the source affirmatively relays his words. I preserve that as a translation/attribution shade, but I do not classify it as an error here: it remains inside the named outer attribution, and the answer also states both exact personal epistemic limits. A future generator could prefer neutral `сообщил/сообщал`, but this output does not create a global absence-of-confirmation proposition.

## v18-held-question

The source has two distinct subjects: Ada's recorded unresolved question, and a second statement that Ada still has no answer while **the note** establishes neither inclusion nor exclusion ([original](./language-built-output-packet-v53.json#L299)). Retention preserved these as two records with those separate subjects; the first record is visible at [packet line 320](./language-built-output-packet-v53.json#L320). All eight queries retrieved that question record only.

q0–q7 are useful. Each presents an open question about whether the service agreement includes preventive filter cleaning, keeps Ada attached to the question/record, and asserts neither coverage nor exclusion. The focused answers may omit the sibling personal-no-answer/note-inconclusiveness record because the selected question itself remains explicitly open. No answer attributes the note's limitation to the agreement, invents booked cleaning, or treats the embedded coverage proposition as true. q4's direct “Ada Marlow recorded” wording is source-supported; the other neutral “recorded question attributed to Ada” forms are weaker but not wrong.

## v18-held-rejected

The source separately states (1) Ada declined an offer to send Zephyr QX-100 to the service centre for thermostat measurement and has no plan to send it under that offer, and (2) no handover has been booked; it reiterates that the offered shipment was rejected rather than accepted ([original](./language-built-output-packet-v53.json#L580)). Retention wrote a rejected-plan record for the first coupled proposition/reiteration and a separate negative booking record ([retained plan](./language-built-output-packet-v53.json#L601)). All eight offer queries retrieved only the plan record.

q0–q7 are useful. Each names Ada as the rejecting actor, keeps shipment as the offered rather than completed action, preserves the service-centre destination and generic thermostat measurement, and never turns the rejection into a denial that measurement occurred. q4's focused answer omits the no-plan reiteration, which the case contract expressly permits. `измерение параметров термостата` in q5/q7 adds only the generic object of measurement; it does not invent a particular measured property. q0/q2's past-tense “had no plan” is ordinary narrative backshift and states no later endpoint, adoption or resolution, so I do not treat it as a changed source-clock claim. The separate absence of a booked handover is neither needed by these focused answers nor silently imported.

## v18-held-alternatives

### Retention and the seating-modifier convention

The Russian source names two competing explanations: `неплотно вставленный внутренний разъём` and a faulty temperature probe. Both remain suppositions, neither has evidence, and Ada personally selected neither cause ([original](./language-built-output-packet-v53.json#L861)). Retention kept the complete coupled set, both common qualifications and Ada's personal nonselection, but translated the first alternative as `an improperly seated internal connector` ([record](./language-built-output-packet-v53.json#L876)).

My initial independent reading treated `improperly seated` as broader than the literal loose insertion and therefore flagged the retained record plus q0/q2/q4. The retention-verifier trace makes the tension visible: it paraphrases the source as “loosely inserted,” the candidate as “improperly seated,” and then reports no mismatch ([trace](../../../../bench-results/language-built-reliability-v53-trace.jsonl#L82)).

After that preliminary assessment was preserved, the authorized source-only convention audit determined that, in connector terminology, “seated” retains the insertion/engagement mechanism and “improperly” retains deficient seating. Under that established convention, the retention is complete and q0/q2/q4 are useful technical paraphrases. I use that convention for the counts above while preserving the stricter literal reading as an interpretation boundary.

### q1: one accepted manner/specificity error

q1 says `неправильно установленный внутренний разъём` ([answer](./language-built-output-packet-v53.json#L945)). This means a generally incorrectly installed connector and loses the source's loose/incomplete insertion or seating mechanism. It remains a related, source-entailed generalization, so it is not factual promotion; it is incomplete for a question asking which exact fault hypotheses were considered. The answer verifier saw “improperly installed” against retained “improperly seated” and still returned all-true with no mismatch ([trace](../../../../bench-results/language-built-reliability-v53-trace.jsonl#L89)). This is the run's one accepted qualification/specificity error.

### q3: unjustified deterministic discourse hold

The generated block was source-faithful:

> Ada Marlow рассматривает две конкурирующие, пока ещё **гипотетические версии** ... **неплотно вставленный** внутренний разъём ... Доказательств нет ни для одной версии, и Ada Marlow не выбрала ни одну причину.

The exact draft is at [trace line 94](../../../../bench-results/language-built-reliability-v53-trace.jsonl#L94). It preserves both alternatives, hypothetical/tentative status, lack of evidence and personal nonselection. The language check accepted it, but the deterministic answer guard rejected it as `discourse` before semantic verification ([result](built-reliability.json#L2422)). The V53 `не установленн...` adjective branch was not exercised: the model used the equally explicit `гипотетические версии`, which the tentative lexical floor does not recognize. This is a false hold and coverage loss, not an unsafe answer.

### q6: correct semantic rejection

The main content was faithful, but generation appended:

> The evidence establishes that she is considering these hypotheses, but not that she discussed them.

The source records consideration; it does not support the new meta-claim that discussion is unestablished. The verifier correctly set proposition and qualification support false and `excerpt_selection.selected_by_retained_excerpt=false` ([trace](../../../../bench-results/language-built-reliability-v53-trace.jsonl#L103)). The runtime correctly held this particular unsupported draft. The case-level abstention is still unjustified under the useful-answer gate because the source offers a faithful answer and generation could have put the query-presupposition concern only in `missing_concepts`, as q0/q2 did, rather than adding it to the cited answer block.

### Other alternatives answers

q5 and q7 restore the exact `неплотно вставлен` mechanism from the bound original frame. Every accepted answer preserves both alternatives, lack of evidence for both, and Ada as the person who selected neither cause. No passive or anonymous nonselection was accepted, and neither hypothesis is promoted to an established cause.

## Cause summary and smallest bounded next scope

| Mechanism | Coordinates | Count | Classification |
| --- | --- | ---: | --- |
| English query reopens an explicitly clarified dial/regulator referent | report q0–q3 | 4 | Unjustified empty drafts |
| Russian `гипотетические версии` absent from tentative-language floor | alternatives q3 | 1 | Unjustified deterministic hold |
| Unsourced “not discussed” evidence claim | alternatives q6 | 1 | Correct rejection of this draft; unjustified case-level abstention |
| Loose seating broadened to general incorrect installation | alternatives q1 | 1 | Accepted specificity/qualification error |

Three bounded follow-ups are supported by this evidence:

1. Carry the already candidate-keyed, span-audited `clarification` relation into the existing answer-generation input as an internal attention hint beside the exact selected spans. The quotes remain authority, and the hint must not create a general dial/regulator alias, use another record, add a call or retry. Negative controls should lack a source clarification or place the apparent translation in an independent proposition. Repeating the current prose instruction alone is weak evidence after the same failure in all four English-query runs.
2. Admit a head-bound Russian `гипотетическ...` adjective as tentative/hypothetical language when it directly qualifies `гипотез...` or `верси...`, with unrelated-subject and cross-clause negatives. This is the smallest fix for q3 and does not weaken semantic verification.
3. Add a bounded degree/mechanism preservation check for source `неплотно` in connector insertion/seating: faithful output may say loose/not firmly/not fully inserted or seated; a generic installed/installation rendering is insufficient. Apply it to retention and answer comparison without changing passes or retries. The existing verifier prompts already state the distinction but both live verifier calls missed q1, so another generic instruction is unlikely to close it.

No verifier relaxation is warranted for the correctly rejected q6 meta-claim. Its lost useful coverage belongs to generation/composition, not acceptance of that draft. No change is warranted for question/rejected record splitting, personal nonselection, scoped report-status wording, placement or retrieval.
