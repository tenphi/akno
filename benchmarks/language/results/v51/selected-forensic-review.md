# V51 selected forensic review

## Scope

This is an independent source-first audit of only:

- `tmp/language-selected-output-packet-v51.json`
- `bench-results/language-selected-v51.json`
- `bench-results/language-selected-v51-trace.jsonl`

I did not read an independent grading receipt, contact its grader, run a provider, or treat runtime verdicts as ground truth. The six cases yield 48 answer rows. V51 produced 47 non-null answers and one null; that is production coverage, not a usefulness judgment.

## Transport and frame accounting

All six retention-verifier operations completed with non-null responses. The exact frame-audit contract reached the first-pass calls:

- Report batch: the single-span no-collection candidate had no `frame_spans`; the two-span nested report had F1/F2 in both request and verdict.
- Hypothesis: F1/F2 request and verdict.
- Exclusion and assistant: single-frame legacy path, with no span audit.
- Fiction: two single-frame candidates in one batch, each without an audit.
- Undated proposal: F1/F2 request and verdict.

No audit coordinate was missing, duplicated, or reassigned. V51 therefore resolves the V50 transport failure in this probe. This says the structured request transported and parsed; it does not certify the model's interpretations.

## Retention and placement

### `v19-held-report`: incomplete set after placement

The original source separately establishes:

- `turn-1111`: `No collection of my device has been booked.`
- `turn-2222`/`turn-3333`: Bo Winters's report permitting shipment to a service bench for return-spring tension measurement, clarified as measurement rather than replacement, with Ada's personal unread/unconfirmed limits.

Extraction produced both records. The retain verifier accepted both. The nested report was written and is complete. The no-collection candidate was generated as `Ada Marlow states that no collection of her device has been booked`, with subject `Ada Marlow's device collection booking`; ownership returned `uncertain`, and placement held it as `routing_uncertain`.

The retained set is therefore materially incomplete even though the report query is answerable from the surviving report. The full immutable source identifies the device as Zephyr QX-100 in the next item; that identity did not resolve for ownership. This is a placement/identity loss, not extraction, frame-audit, semantic-verification, retrieval, or answer failure.

### Other retained sets

- `v19-held-hypothesis`: complete hypothetical two-month foam-filter rule, coupled missed-check consequence, unknown actual requirements, and no real missed check.
- `v19-held-exclusion`: complete support-bracket exclusion and narrow unresolved fan-motor-repair scope; no whole-contract silence claim.
- `v19-held-assistant`: complete tentative assistant report, quarterly functional display check, possible contractual condition, and assistant-specific lack of examination/confirmation.
- `v19-held-fiction`: complete two-record set: Ada's actual proposal to discuss and the fictional Vulpine-to-Bo promise, with first-ten-weeks limit and no real agreement.
- `v19-held-undated`: complete Ada proposal, next year measured from the undated source rather than processing time, unknown calendar year, no adopted plan, and no arranged meeting.

All six retained records used by answers were retrieved in every corresponding query row. I found no accepted retained proposition that changes the original source meaning.

## Answer audit by case

### `v19-held-report` — 8/8 non-null

All eight answers preserve:

- Ada as outer relay and Bo as inner reporter;
- permission to send the device to a service bench;
- return-spring tension measurement rather than spring replacement;
- Ada's personal lack of reading and independent confirmation.

They do not turn permission into booking or completed measurement, and they do not globalize Ada's epistemic limits. The focused report question does not require the separately lost no-collection fact. I found no accepted error. Russian `якобы` in EN→RU explicit adds a skeptical/reportative shade, but the same clause explicitly remains Bo's unverified report and does not change its proposition enough to call a clear source error.

### `v19-held-hypothesis` — 7/8 non-null

Every produced answer keeps the two-month frequency as a rule property, couples the premise with the conditional missed-check consequence, states that actual requirements are unknown, and denies reporting an actual missed check. No dated event is invented.

The sole null is EN query → EN answer, explicit discussion view. Its draft says:

> `Ada Marlow introduced, hypothetically, a rule ...`

The original `turn-1111` says `я ... допускаю правило`—Ada posits/assumes the rule for analysis. In this context `introduced, hypothetically, a rule` is a faithful rendering of Ada introducing the supposition, not a stronger real-world enactment. The verifier instead used the retained compression `considers ... a hypothetical rule` as its source meaning and rejected `introduced` as a changed action, despite the bound original frame. I classify this as a **false semantic hold**. The draft otherwise preserves all actors, conditional scope, and consequences. It is a coverage loss over adequate evidence, not a justified source-level abstention.

### `v19-held-exclusion` — 8/8 non-null

All answers correctly keep the damaged support bracket as the excluded subject and use warranty as the covering instrument. Russian answers use the active construction `покрывает ли гарантия ремонт двигателя вентилятора`; none repeats V49's repair-as-covering-repair inversion. All retain the limited unresolved motor-repair question and explicitly avoid claiming contract silence. I found no accepted error.

### `v19-held-assistant` — 8/8 non-null

All answers preserve generic assistant attribution, possibility rather than requirement, quarterly functional status-display check, contractual-condition sense, and both personal epistemic limits: the assistant did not examine the contract or confirm the assumption. No passive global absence or physical-device-state reading appears. I found no accepted error.

### `v19-held-fiction` — 8/8 non-null

Seven answers correctly state that Ada proposed the discussion, place Vulpine Mutual's promise to character Bo Winters wholly inside fiction, preserve free axle-cap replacements and the ten-week ownership duration, and avoid a real agreement or completed discussion.

One accepted answer has a clear requested-language defect:

- EN query → RU answer, explicit view: `бесплатную замену axle-cap` leaves the ordinary English component term untranslated inside otherwise Russian prose. It is not presented as an exact quotation, code, identifier, or proper name. The source meaning and fictional scope survive, but the answer is not fully Russian-language compliant.

The remaining singular Russian `замену колпачка оси` forms naturally describe the promised replacement service and do not clearly contradict the English plural service wording.

### `v19-held-undated` — 8/8 non-null

All answers preserve the deictic `next year`, original undated source as anchor, exclusion of today/processing time, and unknown calendar year. The clock guard therefore preserves the required source-relative/unknown distinction in every accepted row.

Four Russian answers nevertheless broaden or misattach source roles/status:

- EN→RU inferred: `не принятым в качестве плана и не сопровождаемым организацией встречи` turns Ada's personal non-adoption/non-arrangement into unassigned states associated with the proposal.
- EN→RU explicit: `план не был принят, и встреча не была назначена` likewise says nobody accepted/scheduled them, while the source says only Ada had not adopted a plan or arranged a meeting.
- RU→RU inferred: `Ada Marlow предложила предварительно пересмотреть ...` attaches `предварительно` to the reviewing action rather than the tentative time, then uses `без организации встречи`, which omits Ada as the person who did not arrange it.
- RU→RU explicit: `предложила предварительно рассмотреть ...` has the same unsupported preliminary-review manner, followed by unassigned `не утверждённым планом и без назначенной встречи`.

These are accepted action/qualification errors. The source's personal negative does not establish that no one adopted or arranged anything. The latter two also shift temporal tentativeness into how Ada would perform the review.

The EN→EN inferred wording `proposed, tentatively, reviewing` and EN→EN explicit `The proposal was tentative` are less precise than saying the timing was tentative. They still assert that Ada actually made the proposal and can naturally describe it as provisional while unadopted. I treat them as **disputed qualification attachment**, not clear source errors. The RU→EN rows use the unambiguous `The timing is tentative` and preserve personal agency.

## Findings summary

- Retained sets: five materially complete; one report set incomplete at ownership placement.
- Non-null answers: 47/48.
- Clear accepted defects: five—one untranslated ordinary term in fiction and four undated Russian action/qualification errors.
- Disputed accepted wording: two English undated tentativeness attachments.
- Nulls: one false semantic hold in the hypothesis case; no justified null or availability failure.
- I found no accepted factual promotion, report-chain loss, hypothetical consequence loss, coverage-role inversion, fiction scope escape, real promise, completed discussion, invented calendar date, or processing-time substitution.

## Bounded observations for reconciliation

I am not proposing a broad runtime redesign before this audit is reconciled with the independent source-only grading. The observed mechanisms are narrow and reproducible:

1. A source-resolvable possessive device identity is lost before ownership, holding an otherwise verified record.
2. The answer verifier privileges retained `considers` over the bound original `допускаю` and falsely rejects a source-faithful hypothetical framing verb.
3. One language check permits an untranslated ordinary compound despite otherwise Russian prose.
4. Generated Russian undated answers repeatedly convert personal negative actions into passives and sometimes attach tentative time to the review action.

Any follow-up should preserve the current source-frame selection, coverage-role guard, coupled-consequence requirement, strict clock floor, semantic no-retry behavior, and model/gate settings. The evidence does not justify weakening those protections.
