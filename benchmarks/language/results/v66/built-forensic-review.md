# V66 built-package source-first forensic review

## Scope and method

I reviewed the finalized frozen V66 built-package evidence at runtime `13a7569f`:

- `bench-results/language-built-reliability-v66.json`
- `bench-results/language-built-reliability-v66-trace.jsonl`
- `tmp/language-built-output-packet-v66.json`

The audit starts from the original source items in the packet and compares the retained records and public answers directly. Trace interpretations, alignment booleans and positive verdicts are diagnostic evidence only. I did not inspect an output-grading receipt, run a provider, retry a case, or edit runtime/source files.

## Disposition

V66 produced 23 of 32 answers. I find **no definite source-entailment, qualification, actor, language, promotion, or citation error in the 23 published answers**. All nine nulls are nevertheless writable-case coverage losses: one faithful report draft was rejected by a local attribution grammar, and eight alternatives queries had no evidence after the sole retention draft was semantically held.

| Case                    | Complete retained set | Published | Null | Source-first disposition                                                |
| ----------------------- | --------------------: | --------: | ---: | ----------------------------------------------------------------------- |
| `v19-held-report`       |      2/2 propositions |         7 |    1 | Seven faithful answers; q5 local attribution false hold                 |
| `v19-held-question`     |                   1/1 |         8 |    0 | All answers faithful                                                    |
| `v19-held-rejected`     |      2/2 propositions |         8 |    0 | All answers faithful; identifier repair succeeded                       |
| `v19-held-alternatives` |    0/1 coupled record |         0 |    8 | Source offered an answer; sole generated candidate held at verification |

The report records zero case availability failures, zero answer-operation failures, zero source-byte changes, and no degraded reasons. Every trace model response has `ok:true`, `schemaError:false`; all 24 generated answer blocks passed language checking. The missing public answer is a normal local rejection, not an unavailable call. The alternatives loss is a normal semantic hold, not placement, ownership, transport, or retrieval failure.

## Case findings

### `v19-held-report`

The source establishes two independent propositions:

1. Ada Marlow relays Bo Winters's statement that the Zephyr QX-100 terms permit sending the device to a service bench to measure return-spring tension. The Russian clarification attaches measurement rather than spring replacement to that same relay and identifies the content as Bo's words in Ada's retelling. Ada has not read the terms, has no independent confirmation of the report, and has not personally verified the condition.
2. Ada directly states that no collection of her device has been booked.

Trace rows 1-5 retain both. Row 2 gives the report candidate all three exact source items and the booking denial its own exact support/frame. Row 3 verifies both; ownership rows 4-5 place the equipment report on the existing equipment page and the person-bound booking statement on a proposed person page. No report qualification is silently assigned to the booking denial.

The retained report preserves outer Ada, inner Bo, permission rather than performance, device/service-bench destination, return-spring tension measurement, the replacement contrast, unread terms, lack of independent confirmation, and personal nonverification. The separate booking record preserves a direct negative booking assertion without inventing a booking actor, date, refusal, or completed collection. This is a complete retained set.

Published answers:

- q0/q2/q4/q6 copy the full English record. They are source-faithful and preserve every material qualification.
- q1 translates it as `условия ... как сообщается, допускают ... измерения натяжения ... а не замену`; q3 uses `условия ... предположительно разрешают ... но не для замены`; q7 uses the same reported permission with `предположительно`. All three preserve report scope rather than asserting a verified contract term or completed service. `предположительно` here scopes the unverified relay and does not promote the content.
- Each Russian answer keeps Ada and Bo in their original roles, states that Ada did not read the terms and lacks independent confirmation, and keeps the condition as something she did not verify. No answer says nobody confirmed it.

#### q5 false hold

Trace rows 26-28 are the exact q5 path. The rendering decision is schema-valid `translate`, the language check is compliant, and the answer call returns this complete block:

> `**Пересказано Ada Marlow:** Согласно пересказу Ada Marlow слов Bo Winters, ... Ada Marlow не читала условия обслуживания, не имеет независимого подтверждения ... это слова Bo Winters, а не условие, которое она проверила.`

The block is source-faithful. It is rejected before verification with `rejection_counts:{"attribution":1}`, `passed_guards:0`, `verified_blocks:null`, and no degradation. The closed `hasBoundReporter` grammar does not accept the passive heading `Пересказано Ada Marlow`; the later `Согласно пересказу Ada Marlow слов Bo Winters` and complete clause do not match one of its reporter-binding surface forms. Thus this is a grammar false hold, not a semantic negative or unavailable verdict.

The private `record_readings.selected_meaning` in row 28 ends mid-word at `указы`, but the materialized block itself is complete. That clipped private note did not become public text and is not the recorded rejection cause.

### `v19-held-question`

The single original states Ada's open question whether preventive coolant top-up for Zephyr QX-100 is included in the service contract, Ada's lack of an answer, and that neither inclusion nor exclusion is established.

Trace rows 37-40 retain that whole proposition as one active `question`, `commitment:none`, self-attested record. All eight answer paths are rows 41-72. English q0/q2/q4/q6 copy the complete record. Russian q1/q5/q7 preserve an open question belonging to Ada, her lack of an answer, and both unresolved outcomes. q3 says `Ada Marlow не знает, входит ли ...; у неё нет ответа`, a contextual equivalent of the source's first-person no-answer statement, and still explicitly says neither inclusion nor exclusion is established. None answers the question, invents coverage, broadens Ada's personal limit into universal ignorance, or loses the contract/service/component.

### `v19-held-rejected`

The source establishes (a) Ada's rejection of the offer to send Zephyr QX-100 to a laboratory for rotor-balance measurement plus her lack of a plan under that offer, and (b) a separate denial that pickup of the device has been booked. The second source item also restates that the offered shipment was rejected rather than accepted.

Trace rows 73-79 retain both. Initial extraction row 74 gives candidate index 1 readable `Zephyr QX-100` but only the generic-device booking span in its frame. The cleaner rejects that original frame because the source identifier is absent. Repair row 76 targets **original index 1**, supplies one exact advisory identifier occurrence from `turn-1111` (`occurrence_count:1`, `source_span_count:1`, no omitted spans), and keeps admitted index 0 read-only. The repair preserves the same booking-denial text and adds the exact antecedent span; it does not substitute the sibling rejected-offer proposition. Row 77 verifies the repaired current frame against the original position obligation, and ownership rows 78-79 place both records on the equipment page. This directly exercises the V66 candidate-specific identifier context successfully.

All eight focused answers cite only the rejected-offer record, which is sufficient for the question; omission of the independent pickup record is appropriate focused selection. English q0/q2/q4/q6 preserve the exact offer, laboratory, rotor-balance measurement, Ada as rejecting actor, rejection rather than acceptance, and no plan under the offer. Russian q5/q7 use the natural `измерения баланса ротора`; q1/q3 use the awkward `измерения балансировки ротора`. In this complete offer context the latter remains a recognizable rendering of rotor-balance measurement rather than a different performed balancing service, so I do not count it as a definite source or mechanism error. All four retain rejection and no-plan scope and assert no shipment, booking, or measurement occurred.

### `v19-held-alternatives`

The source says Ada is **discussing** two competing preliminary hypotheses for the Zephyr QX-100 fault: a slipping drive belt or a jammed cooling fan. Neither has supporting evidence, and Ada has selected no cause.

Rows 112-114 are the complete case path. Extraction row 113 returns one coupled candidate with both alternatives, preliminary status, absent evidence, and Ada's nonselection. It uses `Ada Marlow is considering ...` and typed `commitment:tentative`. It has complete exact support/frame coverage and never reaches ownership or placement.

The row-114 verifier returns three negative dimensions and `reason_code:null`, which becomes the typed verification hold `discourse_uncertain`. Two parts need separate treatment:

- The action mismatch is defensible: source `обсуждаю` is an observable discussion act, while “is considering” can assert a personal deliberative attitude. The bad draft can therefore be held without treating the positive verifier fields as authority.
- The qualification mismatch is wrong under the shared contract. `commitment:tentative` qualifies the embedded competing hypotheses; it does not claim uncertainty that Ada's discussion happened. The source itself calls both versions preliminary and unsupported. Requiring asserted commitment because Ada directly reported the discussion would promote the hypotheses and contradict the retention prompt's explicit rule.

Because the one existing semantic decision is final and there is no semantic retry, even the one legitimate changed-action defect removes the sole candidate. All q0-q7 then return `no_eligible_evidence` without generation. These are eight unjustified writable-case abstentions at case level: the runtime correctly avoids publishing this particular altered draft, but the source supplies a complete faithful answer and retention could have emitted `Ada Marlow is discussing ...` with tentative commitment.

## Trace and rendering accounting

The trace is anchored by payload content rather than presumed sequence:

| Case         | Retention / ownership rows | Query rows                                                                           |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------ |
| report       | 1-5                        | q0 6-9; q1 10-13; q2 14-17; q3 18-21; q4 22-25; q5 26-28; q6 29-32; q7 33-36         |
| question     | 37-40                      | q0 41-44; q1 45-48; q2 49-52; q3 53-56; q4 57-60; q5 61-64; q6 65-68; q7 69-72       |
| rejected     | 73-79                      | q0 80-83; q1 84-87; q2 88-91; q3 92-95; q4 96-99; q5 100-103; q6 104-107; q7 108-111 |
| alternatives | 112-114                    | no answer calls                                                                      |

All 24 generated answers use the bounded one-record renderer: English chooses exact `copy`; Russian chooses `translate` with `copy_allowed:false`. Twenty-three proceed through one verifier and publish; report q5 stops at the local guard. No answer mixes records or expands a private frame into selected public content. There are 29 successful language checks in total (five retention texts and 24 generated blocks), five successful retention calls including the rejected-case repair, four successful retention-verifier calls, and five successful ownership decisions.

Several accepted report verifier `source_context` notes are visibly clipped or corrupted (rows 9, 13, 25, 32 and 36 end with fragments such as `and is`, `;:`, `corrobor确认`, `Bo Winters`, or `independent15?`). They are schema-valid fallible private notes, not source authority. The exact original frame, immutable answer segments, alignments, semantic dimensions and local guards were still supplied. Because the public blocks are independently source-faithful and no decision was unavailable, I record this as a diagnostic-quality risk rather than an accepted public error or proven failure cause.

## Smallest source-grounded next scope

1. **Report q5:** keep the attribution floor unchanged and make translated complete-record generation use the supplied `report_source_display_phrase` exactly when it emits a heading. For this record that yields `По словам Ada Marlow`, already accepted in the other three Russian paths. The hint is derived per evidence record only when that record is qualified `source_report`, from that record's own `source_speaker` or generic assistant role. A safe instruction therefore applies only to the selected single complete-record report's visible heading; it must not require that phrase in ordinary multi-record prose, supply an embedded-action actor, or attach a neighboring report. Named sources retain exact spelling and generic roles retain the existing localized role form. Broadly accepting passive + an undeclined proper name would reopen the intentional role ambiguity the guard prevents.
2. **Alternatives:** require extraction to preserve an explicitly observed discourse predicate rather than replacing `discussing` with `considering`, while retaining the single coupled record and tentative embedded-hypothesis metadata. Reinforce in the existing retention verifier comparison that direct assertion of a discussion does not make the hypotheses asserted. Prompt-only clarification is the smallest change, although the existing prompt already states that these two activities are not interchangeable and this run ignored it. If a deterministic repair opportunity is desired, a bounded pre-verification guard is feasible only for the demonstrated shape: an exact structured source speaker/first-person same-clause `обсужда...` predicate governing the named hypotheses, the same generated actor and hypothesis object expressed as `is considering`, and no preserved `discussing/обсужда...` predicate in the candidate. That rejection can produce a typed validation issue and use the existing one structural repair before the first semantic verdict. It must not become a general synonym table, infer a speaker from prose, trigger when the source itself says `рассматриваю/considering`, or automatically rewrite the text. The repaired original position must still pass the complete cleaner and full-source verifier. This adds no pass or semantic retry, but needs paired source-`рассматриваю`, different actor/object, both-actions, quoted, clause-boundary and semantic-negative controls. Given one occurrence, prompt-only remains lower-risk; the bounded guard is justified only if preventing another total case loss outweighs that narrow grammar's maintenance cost.
3. Keep the current final semantic negative behavior. The evidence does not justify retrying or overriding row 114, salvaging only part of the candidate, or weakening action/object verification.

No broader ownership, retrieval, language, rendering, citation, source-clock, or schema change is supported by these four cases.
