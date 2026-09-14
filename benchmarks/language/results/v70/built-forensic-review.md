# V70 built-package source-first forensic review

Scope: frozen runtime `1ceb557224602d132bb3c5944c2ac81ac7d2a696`, `tmp/language-built-output-packet-v70.json`, `bench-results/language-built-reliability-v70.json`, its 146-row trace, and the frozen implementation snapshot. I read the original sources before runtime verdicts. I did not inspect an independent grade, call a provider, rerun a probe, access private configuration/KB data, edit runtime, or write GitHub state.

## Result

- Complete, source-faithful retained sets: **4/4**.
- Useful retrieval observations for the focused questions: **32/32**.
- Published answers: **32/32**; independently source-faithful and useful: **32/32**.
- Accepted source, actor, predicate, object/property, qualification, polarity, time, citation, promotion, or language errors: **0 observed**.
- Retention holds, draft holds and null answers: **0**.
- Case availability failures and answer-operation failures: **0**.
- Source-byte changes: **0/4**.

The benchmark reports two noncanonical eligibility flags, but neither changes the source meaning or makes an ineligible proposition public in the inspected outputs. Internal `complete` versus `partial` outcome labels track qualified answer mode and are not independent usefulness grades.

## `v19-held-report` — trace rows 1–38

The initial extraction at row 2 retains both required records without repair:

1. Bo told Ada that the Zephyr QX-100 terms permit sending the device to a service bench to measure return-spring tension. Ada's Russian clarification makes measurement, rather than spring replacement, the controlling meaning; it remains Bo's wording in her retelling and not a condition she verified. Ada has not read the service terms and has no independent confirmation of the report.
2. No collection of Ada's device has been booked.

The main retained prose uses short complete sentences and preserves all those distinctions. In particular, it keeps the source predicate `has no independent confirmation`; it does not change this into Ada personally failing to perform confirmation. It also separately preserves `not a condition she verified`. Bo remains the embedded reporter and Ada the relay. The measured property is return-spring **tension**, and replacement remains explicitly excluded.

The retention verifier at row 3 sees all four source spans and both candidates in one call. Both are admitted and independently routed. The main record goes to the Zephyr page; the separate booking denial is proposed under Ada. That placement does not contaminate the focused report answers.

All q0–q7 cite only the main report record at `memory/equipment:7`, which is the correct selected record. English copies preserve its complete content. Russian translations preserve permission rather than completed shipment, `натяжение` as the measured return-spring property, nonreplacement, unread terms, lack of independent confirmation, Bo/Ada roles, and the unverified-condition clarification. `как сообщается` and `по словам Ada Marlow` are stylistic reporting constructions; the surrounding clauses still identify Bo as the person who told Ada and do not add an independent narrator.

The answer verifier is invoked for all eight answers. The new property field is applicable to the tension measurement and the public outputs preserve it. No sibling booking denial is cited to support the report.

## `v19-held-question` — trace rows 39–74

The retained record completely preserves Ada's open question about whether preventive coolant top-up for Zephyr QX-100 is included in the service contract, Ada's lack of an answer, and record-level non-establishment of both inclusion and exclusion. It does not answer the embedded coverage question or invent an asker, writer, or external source.

All eight answers cite `memory/equipment:7` and preserve the question owner, preventive coolant top-up, contract-inclusion object, absence of an answer, and neither-inclusion-nor-exclusion scope. Russian `не установлены/не установлено` forms remain epistemic nonresolution, rather than claiming the service is absent. English answers copy the complete record. The `partial` result is appropriate to an unresolved question and does not indicate missing public source content.

This record has no tested/measured property. Its property audit may correctly use the all-null `not_selected` shape; it does not need to invent one.

## `v19-held-rejected` — trace rows 75–111

Both source propositions survive:

- Ada rejected the offer to send Zephyr QX-100 to a laboratory for a rotor-balance measurement, the offered shipment was rejected rather than accepted, and she has no plan to send the device under it.
- No pickup of the device has been booked.

The focused q0–q7 answers cite only the first retained record at `memory/equipment:6`. That selection is complete for the offer question; the independent pickup denial is irrelevant and need not be repeated. Every answer preserves Ada as rejector, laboratory shipment as the rejected course, rotor balance as the measurement purpose, lack of a plan under that offer, and rejected rather than accepted status. Russian `измерение балансировки ротора` and `измерение баланса ротора` are both faithful here. No answer asserts shipment, booking, purchase, or measurement occurred.

The first four outputs are internally `complete` and the latter four `partial`, but their public texts contain the same complete focused proposition. There is no source-level usefulness difference.

## `v19-held-alternatives` — trace rows 112–146

The single retained record combines the complete selected meaning: Ada is discussing two competing preliminary hypotheses, slipping drive belt and jammed cooling fan; neither has evidence; Ada has selected no cause.

All eight answers cite `memory/equipment:7` and preserve Ada as both the actual discussion actor and personal nonselector. They retain both named alternatives, preliminary/tentative status and lack of supporting evidence. Russian `подтверждающие доказательства/свидетельства` faithfully express absence of supporting evidence. None promotes either hypothesis to an established fault or assigns nonselection to an unnamed group.

This case also has no separately specified tested property: the hypotheses name possible causes, not a performed test whose property must be audited.

## Holds, schema and capacity

There is no held candidate, repaired candidate, rejected draft, malformed schema, cap exhaustion, provider failure, language mismatch, or unavailable verifier response in this run. Every generated answer reaches the independent answer verifier and is published.

The run exercises the new multi-sentence report presentation in production and exercises property-present comparison on the return-spring tension report as well as property-not-selected behavior on ordinary question/decision/hypothesis records. Observed success does not isolate prompt causality or prove future semantic judgments. The provider echoes and this run show transport completion under the isolated 2,400-token role ceiling; they do not validate the unchanged 1,024-token service overlay.

## Forensic disposition

The built 4-case/32-coordinate probe is clean under source-first review. It supplies positive evidence for proceeding with the separately declared selected diagnostic review, while release/full-trial readiness still depends on that selected run, independent grading, complete retention and the unchanged thresholds.
