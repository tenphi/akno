# V48 development forensic review

## Scope and method

This is a source-first, read-only audit of the 22 development case-runs in `tmp/language-v19-output-packet-v48.json`, `bench-results/language-development-v48.json`, and `bench-results/language-development-v48-trace.jsonl`. I did not read an official grading receipt. Counts below describe produced output and observed pipeline stages; they are not independent usefulness scores.

## Production counts

| Run | Case-runs | Writable sets retained | Deliberate read-only holds | Non-null answers | Null answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 11 | 10/10 | 1/1 | 72/88 | 16/88 |
| 2 | 11 | 10/10 | 1/1 | 73/88 | 15/88 |
| Total | 22 | 20/20 | 2/2 | 145/176 | 31/176 |

The null reasons were:

- Run 1: 8 `no_eligible_evidence`, 6 `verification_rejected`, and 2 `empty_draft`.
- Run 2: 8 `no_eligible_evidence`, 4 `verification_rejected`, 2 deterministic `draft_rejected`, and 1 `empty_draft`.

Both groups of eight `no_eligible_evidence` answers belong to `v18-held-admission`. Its only candidate was held at placement with `no_writable_destination`; this is the expected read-only hold, with no source-byte mutation. These nulls are appropriate abstentions. Every other null occurred over writable, adequate retained evidence and is therefore an answer-coverage loss even when rejecting the particular draft was correct.

## Retention audit

All 20 writable case-runs produced the complete material record set. In particular:

- Both report runs retained the nested Bo Winters report, regulator-calibration-versus-replacement contrast, Ada Marlow's lack of access/confirmation, and the separate no-collection instruction.
- Both counterfactual runs retained actual rejection/nonpurchase separately from unrealized seventh-year coverage.
- Both rejected-offer runs retained the declined thermostat-measurement offer/no-plan proposition and the separate no-booked-handover denial.
- The undated proposals retain Ada as proposer, nonacceptance, no meeting, the source-relative next-week anchor, and unknown calendar mapping.
- Alternatives retain both causes, lack of evidence for both, and Ada's personal nonselection.

I found no retained-set omission or accepted retained proposition that contradicted its original source. The report records correctly use the Russian clarification to resolve `dial calibration` as regulator calibration rather than treating the two source-language clauses as competing facts.

The V48 private frame is observable in every one of the 155 answer-verifier calls: each cited evidence item carries `retention_source_frame`. Every returned framed verdict contains `excerpt_selection`. This did not turn the frame into answer evidence: for example, the report verifier rejected an added personal-recording claim even though the frame identifies Ada as the outer source. Unknown-clock answers that were accepted preserve both the undated source anchor and unresolved calendar week. Duration-only fiction remained a duration, with no invented dated event. Counterfactual answers kept the unrealized alternative separate from actual rejection.

## Accepted answer errors

I found one repeated source-specificity error in four accepted answers. The original says only `a thermostat measurement`; these drafts narrow that to measurement of the thermostat's **parameters**:

- `v18-held-rejected`, run 1, RU query → RU answer, inferred view: `для измерения параметров термостата`.
- Run 1, RU → EN, explicit view: `for measuring the thermostat’s parameters`.
- Run 1, RU → RU, explicit view: `для измерения параметров термостата`.
- Run 2, RU → RU, inferred view: the same `измерения параметров термостата` specialization.

This is unsupported added measurement scope. The inconsistency is directly reproducible: run 1 RU→EN inferred and run 2 RU→RU explicit produced the same specialization and were correctly rejected by the verifier as `unsupported_content`/`changed_action_or_role`, while the four rows above passed. No external technical interpretation is needed to establish the error.

I found no other clear accepted source-entailment, qualification, role, clock, fiction, or answer-language error. Natural translations such as support `legs`/`feet`, regulator/dial in the explicitly clarifying bilingual report, and connector/charging port do not by themselves change the invented source proposition.

## Null-answer forensic inventory

### Run 1

- `v18-held-report`, EN→EN inferred: **correct rejection of a bad draft.** It added `the evidence does not establish that she personally recorded it`. The source establishes Ada as outer relay and her lack of terms/confirmation; it does not make this new absence-of-recording-evidence claim. The selection audit identified the added clause.
- `v18-held-report`, EN→RU inferred and explicit: **false generation abstentions.** Both empty drafts claimed an unresolved conflict between dial and regulator calibration. The Russian source clause expressly clarifies regulator calibration and contrasts it with regulator replacement; the frame supplied both clauses.
- `v18-held-hypothesis`, EN→RU inferred: **over-literal semantic rejection.** The faithful draft says Ada `обсуждала гипотетическое правило`; the verifier required identity with `proposed a hypothetical assumption`. In context, discussing the hypothetical rule preserves the premise, agent, weekly action, conditional consequence, unknown real rule, and absence of an actual missed check. No new discussion event independent of the source's stated reasoning context is introduced.
- `v18-held-question`, EN→EN explicit: **conservative but avoidable scope rejection.** The draft says `the question establishes neither inclusion nor exclusion`; the retained wording assigns non-establishment to Ada's note. This is a real grammatical subject shift, so the rejection is defensible under the strict epistemic-subject contract, but the complete sentence still describes the recorded question and does not assert coverage. It is a usefulness loss caused by generated wording, not justified source-level abstention.
- `v18-held-exclusion`, EN→EN inferred and explicit: **false semantic rejections.** The verifier treated `cracked support feet` as a distinct component from retained `cracked support legs`. The original Russian `опорных ножек` naturally supports either English rendering in this equipment context; no added component is established by choosing `feet`.
- `v18-held-rejected`, RU→EN inferred: **correct rejection of a bad draft.** It added the unsupported measured property `thermostat's parameters` described above.

### Run 2

- `v18-held-report`, EN→RU inferred: **false generation abstention.** The empty draft again treated dial/regulator as unresolved despite the explicit source clarification.
- `v18-held-report`, EN→EN explicit: **correct rejection for material incompleteness.** `for calibration` omitted both the regulator object and the explicit not-replacement contrast from the selected report proposition. The excerpt-selection judgment remained true because the prose did not add unrelated content; `action_arguments_preserved` correctly caught the loss.
- `v18-held-exclusion`, EN→EN explicit: **false semantic rejection** of `support feet` versus `support legs`, for the same translation-equivalence reason as run 1.
- `v18-held-rejected`, RU→RU explicit: **correct rejection of a bad draft** for `измерения параметров термостата`.
- `v18-held-undated`, EN→RU inferred: **correct deterministic hold of malformed clock prose.** `исходная запись датирована неизвестно` does not clearly state that the source record is undated/has an unknown date, so the bounded source-clock floor rejected it.
- `v18-held-undated`, EN→EN explicit: **correct deterministic attribution/agency hold.** `According to Ada Marlow, the tentative proposal was ...` leaves the actual proposer unstated; outer attribution alone does not preserve Ada's proposal action.
- `v18-held-undated`, RU→RU inferred: **correct semantic rejection of an added claim.** The otherwise faithful answer appended `свидетельств о том, что Ada Marlow лично записала его, нет`, which the source does not establish.

Thus, apart from the 16 expected admission abstentions, the run produced 15 writable nulls. Eight are clear or defensible false losses (six in run 1, two in run 2); seven correctly withhold malformed, incomplete, or unsupported drafts. Correct draft rejection still leaves a coverage miss because the retained evidence could answer the question.

## Smallest coherent follow-up

1. **Make source clarification and ordinary translation equivalence explicit comparison inputs, not competing clauses.** The generation and verifier contract should treat an explicit cross-language clarification as controlling the ambiguous term and permit ordinary target-language equivalents such as Russian `ножки` → English `feet` or `legs`. This should remain source-bound and must not become a general synonym or alias dictionary.
2. **Require a selected measurement property to appear in source evidence.** The existing proposition/action comparison already expresses this rule; the defect is inconsistent verdict application. A concise comparison instruction should contrast a generic measurement with a selected parameter/property and require the verifier's own `source_meaning` and `candidate_meaning` to name that difference before an all-true result. This addresses both accepted errors and false rejects without another call or retry.
3. **Calibrate framing-verb comparison around the embedded proposition.** When source and answer both describe the same hypothetical reasoning act, agent, rule, and qualification, `proposed an assumption` versus `discussed a hypothetical rule` should not alone force rejection. Material actors and embedded actions remain mandatory. This is the same bounded distinction already made for neutral record provenance; it does not license replacing actual actions with generic discussion.
4. **Keep the source-frame selection gate and strict clock/agency floors.** They correctly rejected added absence claims, missing proposers, and malformed unknown-clock prose. The evidence does not support weakening these gates or adding semantic retries.
