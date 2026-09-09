# V69 report-stage design review

Scope: only rows 1–7 of the frozen V69 selected and built trace files, the corresponding original report sources, and the frozen `tmp/core-v69` helper. This is not a score or a review of later probe cases. I made no provider call or runtime edit.

## Selected report (`v20-held-report`)

The initial main candidate at selected trace row 2 is source-faithful:

> According to Bo Winters, the agreement permits sending Zephyr QX-100 to the workshop to measure the gap at the latch, not to change the latch; Ada Marlow is only relaying this meaning and has not read the agreement or independently checked Bo Winters’s account.

It preserves Bo as the embedded reporter, Ada as the relay, measuring the latch gap rather than changing the latch, and Ada's two personal limits: she has not read the agreement and has not independently checked Bo's account. The source supports each proposition. The candidate does not turn lack of checking into lack of receiving confirmation.

The row-4 repair is also source-faithful:

> According to Bo Winters, the reported agreement permits sending Zephyr QX-100 to a workshop to measure the gap at the latch, not to change the latch; Ada Marlow is relaying Bo Winters’s account, has not read the agreement, and has not independently checked that account.

The article change (`the workshop` to `a workshop`) is immaterial here. The repair keeps the same actors, action contrast, and personal epistemic limits.

Both are false local holds before the retention verifier. A frozen direct replay gives `hasReportUncertainty(...) === false` for each exact candidate with attribution names `Ada Marlow` and `Bo Winters`. The initial candidate places `is only relaying this meaning and` before the shared negative pair; that form is outside the helper's narrow optional relay prefix (`only conveys/relays this account/report and`, or `is only passing on this meaning,`). The repair instead begins the post-semicolon clause with `is relaying ...`, so the helper never reaches its required `ACTOR has/have/had not ...` opening.

This is not missing uncertainty in the prose. It is a mismatch between faithful conjunction-heavy prose and the deterministic grammar.

## Built report (`v19-held-report`)

The initial main candidate at built trace row 2 is structurally outside the helper and is not fully source-faithful:

> Ada Marlow reports that Bo Winters said the Zephyr QX-100 terms permit sending the device to a service bench to measure the tension of its return spring, not to replace that spring; Ada Marlow has not read the service terms or independently confirmed this reported condition.

The source says Ada **has no independent confirmation** of the report. That is a possession/availability statement; it does not establish that Ada personally performed and failed to confirm it. The candidate's `has not ... independently confirmed` changes that predicate. The helper also does not accept `this reported condition` as a report object. Thus the local hold prevents a real source-meaning change, although the emitted `discourse_uncertain` explanation does not identify it.

The built repair at row 4 preserves more of the bilingual clarification:

> Ada Marlow reports that Bo Winters said the Zephyr QX-100 terms permit sending the device to a service bench to measure the tension of its return spring, not to replace that spring; she clarifies that these are Bo Winters's words in her retelling, not a service condition she verified, and she has not read the service terms or independently confirmed the report.

It correctly preserves the retelling, the measured-property/replacement contrast, and the fact that this is not a service condition Ada verified. It still changes `has no independent confirmation` into Ada not performing confirmation. Its personal-limit clause is also embedded after `she clarifies ...`, rather than beginning at a recognized sentence/clause head. Frozen replay returns false. This hold is justified on source semantics even though the same structural floor that false-holds the selected drafts fires first.

The separately extracted no-collection candidates in both traces are admitted, verified, and routed in rows 5–6. They do not compensate for loss of the main report record.

## Root cause and bounded correction

The extraction prompt requires one self-contained prose **sentence**, while the same record must carry the embedded report, outer relay, action contrast, and personal limits. That contract encourages long compound sentences whose connective order must happen to match an increasingly specialized local grammar. The helper then reports all misses as absent uncertainty, even when the exact personal limits are visibly present.

The smallest general correction is a presentation contract rather than another relay-phrase enumeration:

1. Permit one compact, self-contained prose **record** of one or more short complete sentences, still within the existing normalized 400-UTF-16-unit cap.
2. Require personal reading/checking/confirmation limits to appear in their own complete sentence with an explicit subject. Keep the source predicate: `has no independent confirmation` must remain possession/availability; `has not independently checked` may remain a performed-check limit only when the source states it.
3. Apply the same instruction to the single repair. The diagnostic should say that the personal limit was not recognized in a closed explicit-subject clause and ask for separation, rather than claiming the prose omitted uncertainty.
4. Keep the entire report, relay/source chain, action/object contrast, and personal limits in the same candidate record. Multiple sentences must not authorize splitting them into independently scoped candidates or omitting a proposition to meet the cap.

This lets existing high-precision forms do the work. For example, the selected source can be rendered as the reported proposition followed by `Ada Marlow has not read the agreement or independently checked Bo Winters’s account.` The built source should use a second sentence such as `Ada Marlow has not read the service terms and has no independent confirmation of the report.` The broad existing lexical branch already recognizes `no independent confirmation`; no new equivalence between possession and performance is needed.

## Required controls

- Selected-shape positive: report sentence followed by an explicit Ada sentence preserving `has not read ... or independently checked Bo Winters's account`.
- Built-shape positive: report sentence followed by `has not read ... and has no independent confirmation of the report`.
- Meaning negative: changing `has no independent confirmation` to `has not independently confirmed` must remain semantically rejected even if the local presence floor passes.
- Actor negative: a second sentence assigning the check/confirmation limit to Bo or an unrelated supplied person must fail mandatory source verification.
- Scope negatives: quoted, questioned, conditional, negated-as-a-whole, or later-retracted personal-limit sentences must not satisfy the floor.
- Completeness negative: preserving only the personal-limit sentence while dropping the embedded report, action contrast, or relay must fail the existing full-source verifier.
- Cap boundary: the multi-sentence record remains subject to exactly the current normalized 400-unit limit and one repair; no truncation or sibling substitution is permitted.

The local floor remains a necessary presence check, and the full original-source semantic verifier remains authoritative. This correction changes neither call count, repair count, cap, schema, nor semantic gate.
