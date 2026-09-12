# V49 built selected-probe forensic review

## Scope

This audit uses only:

- `tmp/language-built-output-packet-v49.json`
- `bench-results/language-built-reliability-v49.json`
- `bench-results/language-built-reliability-v49-trace.jsonl`

It covers four V19 development case-runs and 32 answer rows from the built V49 runtime. I compared each original source with extraction, retention decisions, stored prose and qualifications, retrieval, generated drafts, verifier decisions, and final answers. I did not read an official grade or another review and made no live call or implementation change.

## Counts

| Measure | Count |
| --- | ---: |
| Case-runs | 4 |
| Case-runs with at least one source-entailed stored record | 4/4 |
| Case-runs with a materially complete retained set | 2/4 |
| Stored records containing a source-entailment error | 0 |
| Non-null production answers | 23/32 |
| Non-null answers assessed fully source- and qualification-faithful | 20/23 |
| Accepted answers with a current-time qualification error | 3/23 |
| Null answers | 9/32 |
| Provider/operation availability failures | 0 |
| Source-byte changes | 0 |

The report's aggregate 4/4 useful-retention value means that every case stored at least one useful record. It does not establish retained-set completeness. The report and rejected-offer cases each lose a separate material proposition before storage.

## Case audit

### `v18-held-report`: principal report lost at semantic verification, not routing

The source contains two independent propositions:

1. Ada Marlow relays Bo Winters's unverified statement that the service terms permit sending Zephyr QX-100 to a technician for dial calibration. The Russian relay clarifies the operation as regulator calibration and explicitly excludes regulator replacement. Ada has not seen the terms and has received no confirmation.
2. Ada has given no instruction to collect the device.

Extraction produces both candidates. The principal report candidate is source-faithful: it keeps Bo as inner reporter, Ada as the relaying source, permission rather than a booking, sending the device to a technician, regulator calibration rather than replacement, and both of Ada's personal limits—she has not seen the terms and has not received confirmation.

The retention verifier rejects this candidate with `proposition_supported=false` and `action_arguments_preserved=false`. Its reason is that the English source says `dial` while the candidate says `regulator`, and it claims the supplied context does not establish that they are the same object. That reading ignores the second source item's explicit framing: Ada says she is relaying **only Bo's words**, immediately restates the permitted calibration as `калибровка регулятора`, and contrasts it with regulator replacement. The verifier received both exact source items and the deciding frame. This is the clarification-precedence failure V49 was intended to address.

The hold is recorded as `discourse_uncertain` at the verification stage. No placement or ownership call is made for the rejected principal report. The only ownership event for this case belongs to the second candidate, and it selects the existing Zephyr page. `routingReasons` is empty. Therefore this loss is not a routing uncertainty, destination failure, source-frame fallback, or extraction omission.

The second candidate—Ada gave no collection instruction—is stored faithfully as an asserted, active, self-attested negation. It cannot answer the service-report question. All eight queries correctly infer or explicitly request `reports`; recall sees the stored denial, but view eligibility removes it because it is self-attested rather than `source_report`. Every row therefore ends with `no_eligible_evidence`, before answer generation or verification. The exact chain is:

`faithful report extracted → verifier falsely rejects clarification → no report stored → self-attested denial retrieved but ineligible for reports view → eight nulls`.

The report retained set is materially incomplete, although its one stored record is source-entailed.

### `v18-held-question`: complete retention and eight faithful answers

The retained question faithfully preserves Ada's unresolved question about whether the service agreement includes preventive filter cleaning, her continuing lack of an answer, and the note's establishment of neither inclusion nor exclusion. Its kind, `commitment:none`, active disposition, and nonfactual eligibility are correct.

All eight answers remain open questions, preserve Ada attribution and lack of an answer, and avoid asserting inclusion, exclusion, a booked cleaning, or whole-contract silence. Variants saying “the question establishes neither” rather than “the note establishes neither” remain scoped to the same recorded unresolved question and add no document-level claim. The Russian outputs are understandable and remain in Russian.

No accepted source, qualification, language, actor, or coverage error is evident in this case.

### `v18-held-rejected`: principal record faithful, independent no-handover claim omitted

The primary retained record is faithful: Ada declined the offer to send Zephyr QX-100 to the service centre for thermostat measurement and has no plan to send it under that offer. It is correctly typed as an asserted, rejected plan with affirmed embedded action and no implication of acceptance, booking, shipment, or measurement.

The source also separately says that no handover has been booked and that the offered shipment was rejected rather than accepted. Extraction initially supplies a second asserted active negated claim containing both clauses. Deterministic validation holds it as `discourse_uncertain` because the candidate combines active asserted-claim metadata with explicit rejection wording. The repair call then returns a duplicate of the first declined-offer/no-plan proposition rather than repairing the no-booked-handover proposition. The semantic verifier correctly rejects that repair with `changed_repair_proposition`. No ownership call occurs for the second position. Thus the retained set omits the independent no-booked-handover statement; this is validation-plus-repair loss, not routing loss.

Seven answers are non-null and identify the correct rejected offer, device, destination, thermostat-measurement purpose, and Ada as rejector. One Russian answer uses `измерения параметров термостата`. `параметров` is a generic grammatical complement; it names no temperature, resistance, method, result, or other particular measured property. It should not be treated as unsupported technical specialization.

Two accepted English answers change the retained/source present `has no plan` to `had no plan`:

- English query, English answer, inferred view.
- English query, English answer, explicit view.

This moves Ada's current lack of a plan to the time of the prior rejection and no longer preserves the active current qualification. The answer verifier explicitly rewrites its `source_meaning` as “had no plan” and marks the scope preserved, despite both the retained excerpt and exact source frame saying `have/has no plan`. I count these as accepted qualification errors. The rejected offer itself remains correctly described.

The sole null is the Russian-query, English-answer, explicit-view row. Generation produces a faithful focused answer naming Ada's rejection, the device, destination, and thermostat measurement. It omits the redundant no-plan sentence. The verifier rejects it only for that omission. The approved source expectation expressly allows a focused answer to state rejection without redundantly restating no plan, so this is an unnecessary semantic-verifier rejection rather than a safe response to unsupported content.

### `v18-held-alternatives`: complete retention; one accepted current-state shift

Retention faithfully keeps Ada considering two competing tentative explanations: an improperly seated internal connector or a faulty temperature probe. It also keeps the shared absence of evidence and Ada's personal nonselection. The typed tentative, active, nonfactual qualification is correct.

Seven answers preserve current consideration, both alternatives and their mechanisms, lack of evidence for both, and Ada as the nonselecting actor. They do not promote either hypothesis to a fact. Russian wording such as `неплотно вставленный` preserves the source mechanism rather than broadening it to a generic installation problem.

The English-query, English-answer, explicit-view row changes `is considering`, `there is no evidence`, and `has selected neither` to `was considering`, `there was no evidence`, and `had selected neither`. This confines all three states to the past and no longer preserves that the hypotheses remain tentative/current, still lack evidence, and remain unselected in the active record. The verifier notices the tense difference but asserts that “past wording does not change the record.” I count this as an accepted qualification error.

## Accepted-error summary

I found no accepted factual promotion, changed actor, changed technical object, particular-property invention, Russian/English language violation, or unsupported source proposition among the 23 non-null answers.

I found three accepted current-time qualification errors:

- two rejected-offer English answers replace current `has no plan` with past `had no plan`;
- one alternatives English answer moves ongoing consideration, evidence absence, and nonselection into the past.

These are not source-clock errors. They are tense/status scope changes against active present-tense source and retained prose.

## Null-root-cause summary

| Null cause | Rows | Detail |
| --- | ---: | --- |
| Principal report rejected during retention verification | 8 | False dial/regulator conflict despite explicit same-source relay/clarification; no report reaches storage, so reports-view eligibility finds nothing |
| Answer verifier rejects a faithful focused rejected-offer answer | 1 | Requires the redundant no-plan adjunct even though the question asks which offer was rejected and the source expectation allows focused rejection wording |
| Provider, language-policy, guard, routing, or generation failure | 0 | No such null in this probe |

The aggregate `no_eligible_evidence: 8` and `verification_rejected: 1` values therefore have two concrete semantic causes, neither related to transport availability.

## Source-frame, actor, property, and clock checks

All 24 answer-generation calls and all 24 answer-verifier calls contain one non-null retention source frame for their cited evidence. The report case makes no answer call because eligibility fails earlier. The report retention verifier itself receives the exact bilingual source and frame. Frame reach is therefore complete in every call where a frame can be used; the report failure is model judgment over supplied context.

Actor handling is otherwise sound in this probe. The held report candidate preserves Ada's personal lack of examination/confirmation rather than globalizing it. The stored rejected plan preserves Ada as rejector and current nonplanner. The alternatives record and seven clean answers preserve Ada as both considering actor and personal nonselector. The three tense errors change temporal scope, not actor identity.

The thermostat `parameters` wording does not select a particular measurement property. It is materially different from inventing a temperature, setting, method, or measured result and should remain acceptable under the generic-complement rule.

Source-clock behavior is not exercised by these four cases. Every retention call has `reference_clock:null`, every candidate has `time:null`, and none of the original sources contains deictic source-relative time. No answer invents a calendar date or relative anchor. Consequently this packet provides no empirical evidence for or against V49's new Russian unknown-source-clock form. The past-tense issues above should not be attributed to that deterministic source-clock path.

## Smallest warranted follow-up

The principal actionable defect is narrower than routing or source-frame storage: semantic comparison failed to recognize a same-source cross-language clarification even when the narrator explicitly says the second clause is only a relay/restatement of the named inner speaker's words. Repeating the existing generic clarification instruction is not a coherent fix; that instruction was present and the model still compressed away the Russian calibration target in `source_meaning`.

The smallest structural change is internal source-span accounting inside the existing verifier call. Before the aggregate source/candidate comparison, require one short interpretation for every deciding frame span, keyed by the supplied frame ordinal/item ID, plus one bounded relationship judgment for the spans: clarification/restatement, contrast, independent proposition, or unresolved conflict. Validate exact coverage and uniqueness of the supplied frame ordinals before accepting the verdict. The aggregate mismatch must then explain any claimed value conflict against the per-span interpretations and relationship, rather than silently omitting one span. This internal comparison structure adds no public memory field, citation authority, provider call, retry, or automatic semantic override. It does not guarantee correct interpretation, but it turns this observed hidden omission into an explicit, independently reviewable judgment and makes it harder for a 320-character aggregate summary to erase the deciding clause.

Explicit relationship markers should control only when they bind the same proposition and speaker chain, such as a narrator saying that the following formulation is only a relay, clarification, correction, or contrast for the named report. Merely adjacent bilingual words remain unresolved. A negative verdict still holds the candidate; neither the extractor's candidate nor lexical similarity may overrule it. A dial/regulator alias would overfit and weaken ambiguity handling.

The retained no-handover omission is a separate structural issue. A standalone booking denial should not be invalidated merely because the same sentence also reiterates that the offered shipment was rejected. The repair obligation must preserve the no-booking proposition rather than substitute a different source-entailed sibling. Any change should stay candidate-local and must not broadly treat active claims containing historical words as valid without semantic separation.

For answers, compare tense against active/current source meaning when the changed verb governs a material state. Past tense is harmless for the completed rejection, but not for `has no plan`, ongoing consideration, current evidence absence, or present nonselection. Conversely, the verifier should continue to allow a focused answer that identifies a rejected offer without requiring a redundant no-plan adjunct.

These findings come from exposed selected inputs. Any runtime tuning based on them requires the already planned fresh held-out evaluation discipline.
