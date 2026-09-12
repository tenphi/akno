# V33 exposed-probe forensic review

Reviewer: GPT-5.6 Sol in a read-only forensic/code-review role. Scope is limited to `language-selected-v33` and `language-built-reliability-v33` reports and traces. This is not an independent semantic-grade receipt, and no fresh v18 held-out output was inspected.

## Result overview

The built probe retained both cases and produced 14/16 answers. Every inspected nonnull answer is grounded and qualified. Its two nulls are safe holds of Russian drafts that left the generic role `assistant` untranslated.

The independent selected review judged 3/4 retained sets, 24/32 retrieval rows, and 17/32 answers useful; every nonnull answer was source-entailing and qualified. The nested-report case retained only one of three generated candidates and therefore lost the material inner report. The report produced 17/32 answers: eight `no_eligible_evidence` results from that incomplete report retention, four generation failures caused by language-check rejection, and three semantic-verifier rejections. I found no newly accepted unsafe output.

## Retention path

### `v17-held-report`: material nested report lost

Extraction generated three candidates:

1. `Ada Marlow states that she has arranged no shipment of the Zephyr QX-100.`
2. `Bo Winters reportedly told Ada Marlow that the Zephyr QX-100 terms allow the device to be sent away to measure hinge resistance, not to replace the hinge.`
3. `Ada Marlow states that she is only relaying Bo Winters's account ... has not read the terms, and has received no confirmation ...`

The first retention-verifier batch rejected candidate 1 because the source says only `I have arranged no shipment` and does not repeat the device object. That rejection remains disputable: a universal denial of any arranged shipment normally entails the narrower denial of a shipment of the contextually discussed device. It is conservative rather than evidence of an unsafe candidate, and it should not establish a blanket rule against sound restriction of negative quantifiers.

The verifier correctly rejected candidate 2 under the existing per-proposition qualification contract. It preserved Bo, Ada, permission, measurement, and the no-replacement contrast, but omitted Ada's explicit statements that she had not read the terms and had received no confirmation. Candidate 3 retained those limits as a separate assertion, yet a sibling cannot qualify candidate 2 under the current contract. Candidate 3 was accepted. The result therefore contains Ada's relay/nonverification statement but no retained proposition saying what Bo reported. All eight report queries then ended at `no_eligible_evidence`; no answer generation ran.

This is an existing covered failure mode: extraction split a report from material qualification that the contract already requires in each selected candidate. Verification behaved safely. If addressed later, the coherent remedy is at representation/generation: make one candidate carry the inner reported proposition, outer relay, verification limits, and action-purpose contrast together, or introduce an explicit proposition-scoped qualification link that verification and retrieval cannot separate. Weakening the verifier because a sibling happens to contain the missing caveat would allow retrieval to surface the underqualified proposition alone.

### Other selected and built retention

- `v17-held-rejected` retained both the rejected workshop offer and the absence of booked collection. Both passed all three semantic dimensions.
- `v17-held-undated` initially produced a redundant second claim with unresolved relative time. The one bounded repair added the undated-source anchor and unknown calendar month; the primary complete plan candidate survived unchanged and passed verification. The retained result covers the proposal, no accepted plan, no arranged meeting, and source-relative unknown month.
- `v17-held-alternatives` retained both tentative competing hypotheses, lack of evidence, and no selected cause.
- Built `v17-held-question` retained the complete open question. Built `v17-held-assistant` removed a redundant generic-assistant attribution-chain entry during the one structural repair, preserved the proposition, and passed the repair-obligation and source comparison.

No retention verifier accepted a proposition/action/qualification mismatch in these exposed probes.

## Answer path

### Built assistant nulls: correct language holds

For English-query/Russian-answer/inferred-view, generation drafted:

`Предварительный, непроверенный отчёт assistant ... assistant не изучал контракт ...`

The shared language checker returned `compliant:false`, so the generation operation failed before admission. For the corresponding explicit-view row, the same untranslated construction passed the fallible shared checker, but the new bound-reporter floor rejected it with typed reason `language` before semantic verification. These are two correct holds of the same defect through the two intended layers. The remaining six assistant answers translate the generic role or answer in English and pass semantic verification. This is the known exposed failure V33 was designed to catch, not a new false rejection.

### Selected language-check rejections

Four selected rows ended as `generation_failed` after the shared prose-language check rejected their generated answer:

- Two repeated Russian rejected-offer drafts (`Ada Marlow отклонила предложение ...`) are ordinary Russian apart from preserved names/identifier. These are false language-check rejections.
- The undated Russian draft says `на следующей месяц`, an agreement error, but it is still unambiguously Russian. It may lose polish or usefulness, but it is a false rejection by a boundary whose declared job is language selection.
- The Russian competing-hypotheses draft is fluent Russian with preserved names/product identifier and is a false language-check rejection.

All four are false language holds. They come from the existing model language checker, not V33's deterministic generic-role floor. A bounded systemic remedy is to pass a separate list of validated source-backed names, titles, and identifiers to the language checker and state that those exact references are permitted while surrounding prose must remain in the requested language. The list must come from typed evidence/configured references rather than arbitrary generated spans, and it must not exempt a longer phrase merely because it contains a protected token. The language prompt should also distinguish language identity from fluency: a minor agreement error remains Russian, while unreadable or genuinely mixed-language explanatory prose may still fail. This avoids named-example allowlists and keeps usefulness/semantic quality in their existing review dimensions.

For generic assistant reports, a complementary generation-only cleanup is safe: omit `source_speaker` when it merely duplicates generic `source_role: assistant`, or expose a localized display label derived from the requested output language. Keep the full original metadata for verification and public evidence, and never apply this projection to an actual named speaker. This reduces the model's incentive to copy the English label without weakening attribution authority. The deterministic bound-reporter floor remains necessary because the shared checker demonstrably missed one such draft.

### Selected semantic-verifier rejections

- The undated proposal draft changed `next month` to `на следующей неделе` (next week). The verifier identified the exact value and temporal-qualification mismatch. This is a correct rejection.
- One alternatives draft changed a source framed as current (`обсуждаю` / retained `is considering`, active) to past Russian (`рассматривала`, `не было доказательств`). The verifier rejected loss of active/current scope. This is a defensible conservative hold because the answer can imply the state ended, though the query itself uses past tense and the core hypotheses remain faithful.
- One English alternatives draft used `discussed` for retained `is considering`. The verifier treated that as a changed action. The original Russian source uses `обсуждаю`, so `discussed` preserves the lexical action but shifts tense. The rejection is best classified as conservative/ambiguous, not a clearly correct action-role rejection. A later systemic calibration should compare the selected proposition and material lifecycle consequence: require a mismatch only when wording asserts completion, supersession, or a genuinely different action, while continuing to reject changed actors, objects, purposes, relative-time values, and explicit lifecycle changes. That can remain a single first-pass verdict with no retry or acceptance override.

## Safety and next-step assessment

The probe exposes coverage failures, not a new unsafe-acceptance path. The dominant selected loss is proposition-scoped qualification split during retention; weakening semantic verification would be the wrong remedy. The V33 generic-role guard works as intended and independently catches a language defect missed by the shared checker. The remaining false holds are familiar model-judgment variance in language and semantic equivalence.

Any later change should stay small and systemic:

- preserve report proposition and its material outer verification limits in one retrievable unit;
- calibrate semantic mismatch instructions around concrete changed meaning or lifecycle consequence rather than tense or near-synonym difference alone; and
- improve the language decision boundary as a language problem, without phrase-specific semantic exceptions.

The existing no-semantic-retry, model, gate, and threshold contracts need no change based on these probes.
