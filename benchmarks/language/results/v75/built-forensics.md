# V75 built-package source-first forensic review — initial

## Scope and method

I reviewed the four original cases first from `tmp/v75-built-forensic-sources.json`, then the finalized report, output packet, and all semantic events in the raw trace. I did not inspect an independent grade, fresh held-out source, private KB/configuration, or invoke a provider or benchmark.

Frozen runtime: `c699916e8f0f8f6537dcb66558ded4f998cf8cfd`.

## Independent result

- Complete source-faithful retained sets: **4/4 cases**, comprising six records.
- Useful retrieval and published answers: **32/32 coordinates**.
- Independently source-faithful and useful published answers: **32/32**.
- Accepted material source, actor, predicate, object, property, qualification, polarity, promotion, citation, or requested-language errors: **0**.
- Null answers, local holds, semantic holds, schema failures, cap failures, or operation availability failures: **0**.
- Source-byte changes: **0/4 cases**.

The report's `partial` versus `complete` labels are product classifications, not independent correctness judgments. Every public answer needed by these focused queries is useful.

## Case findings

### `v19-held-report`

The source distinguishes Ada's unread terms and lack of independent confirmation, Bo's report that the terms permit bench shipment for return-spring tension measurement, the clarification excluding spring replacement and identifying Bo's words rather than Ada's verified condition, and the separate no-collection-booking denial.

Extraction at trace line 6 creates both records; the verifier at line 11 accepts them and ownership follows at lines 16 and 21. The main record preserves Ada as outer reporter, Bo as inner speaker, permission rather than occurrence, bench destination, tension as the measured property, non-replacement, and all personal epistemic limits. Its `claim/asserted/active/affirmed/source_report` state records the qualified report's existence rather than promoting embedded permission. The separate denial is `negated/self_attested`; its unresolved routing subject loses no proposition and adds no false identity.

All eight answers cite the main record and preserve those meanings in English or Russian. They do not claim shipment, measurement, replacement, or booking occurred. Generation/verifier pairs occupy lines 42–173. Omitting the independently retained booking denial from the focused report answer is legitimate selection.

### `v19-held-question`

The source establishes Ada's open question about preventive coolant refill and service-contract inclusion, Ada's personal lack of an answer, and that neither inclusion nor exclusion is established.

Extraction at line 188, verification at 193, and ownership at 198 preserve one `question/commitment:none` record with all three propositions. All eight answers in lines 215–354 preserve Ada as question holder, the coolant-refill object, Zephyr QX-100, service-contract scope, her lack of an answer, and both unresolved alternatives. None answers the embedded question or invents an asking/writing event.

### `v19-held-rejected`

The source establishes Ada's rejection of an offer to send Zephyr QX-100 to a laboratory for rotor-balance measurement, her lack of a plan under it, rejection rather than acceptance, and a separate no-pickup-booking denial.

Initial extraction at line 361 creates both records. The pickup candidate names Zephyr QX-100 while its initial deciding frame contains only “the device”; the typed repair target at line 365 identifies the missing source identifier. The sole repair at line 368 retains the denial and adds the exact turn-1111 antecedent span. It does not modify the admitted sibling or import the rejected offer's modality into the booking denial. Line 373 verifies both records; ownership follows at 378 and 383.

The offer metadata is faithful as `plan/asserted/rejected/affirmed`, with text preserving Ada's no-plan limit; the pickup is `claim/asserted/active/negated`. All eight answers preserve Ada's rejection, laboratory destination, rotor-balance measurement, no plan under the offer, and rejection rather than acceptance. Russian “измерение баланса/балансировки ротора” remains faithful. Omitting the separately retained pickup denial from the focused offer answer is legitimate selection.

### `v19-held-alternatives`

The source establishes Ada's actual discussion of two competing hypotheses—a slipping drive belt and jammed cooling fan—while both remain preliminary, neither has supporting evidence, and Ada has not selected a cause.

Extraction at line 550, verification at 555, and ownership at 560 preserve one `claim/tentative/active/affirmed/self_attested` record. All eight answers in lines 577–716 preserve the discussion act, Ada's agency, both alternatives, competition and preliminary status, absence of evidence for each, and Ada's nonselection. Neither language introduces a diagnosis.

## Runtime and availability evidence

Every retention and answer transaction completed. There are no null public answers, rejection counts, or case availability failures. Additional lifecycle rows expose adapter activity and endpoint accounting; they do not show a semantic retry. The rejected case uses the one declared structural repair followed by mandatory whole-source verification.

Private readings and verifier summaries sometimes contain clipped or stray-script text, but they are not public source authority. Strict response parsing completed and the published prose passed separate language checks. I found no public foreign ordinary term or citation mismatch.

## Disposition

The built 4-case/32-coordinate probe is clean on source fidelity, qualification, language, retrieval, availability, and byte stability. This bounded evidence does not establish a fresh held-out gate or general model competence.
