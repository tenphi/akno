# V46 built-probe forensic review

Scope: `bench-results/language-built-reliability-v46.json`, its trace, and `tmp/language-built-output-packet-v46.json`, reviewed directly against the invented original sources. I did not read independent grading. Runtime was frozen; I made no runtime edits or live calls.

## Result

- Retention: 2/2 writable cases produced one written record each. No candidate was held, repaired, degraded, or lost.
- Answers: 16/16 query/language/view combinations produced one guard-passing and verifier-passing answer. There were no nulls, availability failures, rejected blocks, language holds, or semantic holds.
- I found no accepted unsupported proposition, changed actor/speaker, qualification promotion, polarity error, language-identity error, or protected-value error.

## `v17-held-question`, run 1

The retained question is complete and correctly typed: `kind=question`, `commitment=none`, `disposition=active`, user/Ada Marlow attribution, affirmed embedded-question polarity, no invented time. Its readable text keeps the return of the device after repairs inside the unresolved agreement question and explicitly says that neither coverage nor exclusion is established.

All eight answers use neutral record provenance (`The recorded open question attributed to...` / `В записи содержится...`) rather than inventing a personal writing or recording act by Ada. Each preserves:

- Ada Marlow as the person to whom the unanswered question belongs;
- the agreement as the governing scope;
- return delivery of the device after repairs;
- the open/unresolved status; and
- absence of an established inclusion or exclusion.

None answers the embedded yes/no question, claims an arrangement, or turns lack of resolution into exclusion. Russian variants such as `доставка при возврате` are less idiomatic than `обратная доставка`, but still express return delivery in context and do not change the action or its object.

## `v17-held-assistant`, run 1

The retained record is correctly typed as an assistant `source_report` with tentative commitment, active record disposition, affirmed embedded possibility, and no calendar time. It preserves the preliminary/unverified reading, possible indicator checking twice per year, and that the assistant had neither studied the contract nor verified the assumption.

The readable record does not repeat the source's exact contrast “not a verified contractual condition.” It instead states that this is a preliminary, unverified reading, uses `may include`, and preserves both lack of contract study and lack of verification. That is sufficient to keep it distinct from an established contractual requirement, so I classify this as a natural qualified compression rather than qualification loss. It would be clearer to keep the explicit contrast, but the omitted phrase does not promote the interpretation.

All eight answers retain assistant attribution, possibility, twice-yearly frequency, preliminary/unverified status and lack of contract study or verification. Generic `assistant` is localized in Russian. `Непроверенное чтение` is somewhat literal/awkward, while `непроверенное прочтение` and `неподтверждённое сообщение` are more natural; none is a language-identity or meaning error.

Every assistant answer reports `outcome=partial` despite a supported block passing both guards and semantic verification. The trace shows no generated `missing_concepts`, no rejected block and no degradation, so the partial state comes from uncovered recall-coverage control labels rather than an answer failure. Under V46 those labels are not emitted in public notes; the parent separately reports that both compiled static-note branches passed after redeploy. The answers and citations themselves are complete for the focused query.

## Readiness signal

The built probe is clean and supports the V46 changes: the question boundary, assistant qualification, language handling and static-note behavior show no regression. This two-case diagnostic cannot establish full-trial readiness by itself. The selected probe and its source-only review still determine whether the exposed suite clears the intended usefulness and zero-error bar before consuming fresh V19 held-out inputs.
