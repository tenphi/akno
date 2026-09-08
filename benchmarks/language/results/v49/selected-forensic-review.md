# V49 selected forensic review

## Scope

This source-first audit uses only `tmp/language-selected-output-packet-v49.json`, `bench-results/language-selected-v49.json`, and `bench-results/language-selected-v49-trace.jsonl`. It covers six case-runs and 48 answer rows. I did not read an official grader receipt or another forensic review. “Produced” below means non-null pipeline output, not independently useful output.

## Counts

- Retention: all six cases produced at least one retained record, but only five retained complete material sets. The report case lost one separately useful record at placement.
- Answers: 44/48 were non-null. The four nulls comprise three `verification_rejected` and one deterministic `draft_rejected`.
- My source audit finds three clear accepted-answer defects across two cases, plus two disputed qualification renderings. Thus 44 is a production count; it is not a count of source-faithful useful answers.
- No operation or model-availability failure occurred.

## Retention

### Material omission: `v19-held-report`

Extraction produced two source-supported candidates, and the retain verifier accepted both:

1. `Ada Marlow states that no collection of her device has been booked.`
2. The complete nested Bo Winters report with the service-bench action, return-spring tension measurement rather than replacement, and Ada's unread/unconfirmed limits.

The second candidate was written. The first reached ownership with subject `Ada Marlow's device collection booking`; ownership returned `uncertain`, so placement held it as `routing_uncertain`. The retained set therefore omits the source's separate no-collection-booking assertion. This is not an extraction, semantic-verification, or source-frame-selection failure. The complete structured source unambiguously identifies Ada's device as Zephyr QX-100 in the immediately following item, but that identity did not survive into the routing input strongly enough to select its page.

### Complete retained sets

- `v19-held-hypothesis` keeps Ada's hypothetical two-month foam-filter rule, its coupled conditional missed-check consequence, unknown actual requirements, and no actual missed check. Frequency remains an undated property rather than an event clock.
- `v19-held-exclusion` keeps the support-bracket warranty exclusion, the limited unresolved fan-motor repair question, and the fact that this limited record does not assert whole-contract silence.
- `v19-held-assistant` keeps generic assistant attribution, quarterly functional status-display check, modal/tentative condition, and the assistant's personal lack of contract examination and confirmation. It does not turn “condition” into device state.
- `v19-held-fiction` keeps two records: the actual proposal to discuss and the fully fictional promise. The fictional record preserves Vulpine Mutual as promisor, fictional Bo Winters as recipient, free axle-cap replacements, first ten ownership weeks, and absence of a real agreement.
- `v19-held-undated` keeps Ada as proposer, next year relative to the original undated record, unresolved calendar year, no adopted plan, and no arranged meeting. The temporal envelope remains unknown; no processing-time date appears.

## Accepted-answer defects

### Changed coverage grammar: two `v19-held-exclusion` EN→RU rows

Both EN→RU answers (inferred and explicit views) contain:

> `эта запись ... не определяет, покрывается ли ремонтом по гарантии ремонт двигателя вентилятора`

This makes `ремонтом по гарантии` the grammatical covering means for `ремонт двигателя вентилятора`. The source says only that the exclusion record does not determine whether fan-motor repair is covered by the warranty. It does not say one repair covers another repair. These two outputs preserve uncertainty but change the embedded coverage relation and are not source-entailing.

The RU→RU inferred draft used the same malformed construction and was correctly rejected by the semantic verifier for changed coverage roles. Accepting the two EN→RU rows is therefore inconsistent first-pass semantic adjudication, not evidence that the rejected row was too strict.

### Disputed qualification rendering: two `v19-held-undated` EN→EN rows

Both EN→EN answers (inferred and explicit views) begin:

> `Ada Marlow proposed, tentatively, to review ... next year.`

The source firmly establishes that Ada made a proposal. The adverb syntactically modifies `proposed`, so it can be read as weakening the proposal/content rather than attaching tentativeness specifically to its time. That is less precise than `The timing was tentative`.

On reconsideration, however, `Ada proposed, tentatively, to review ...` still entails that Ada actually made the proposal; `tentatively` can naturally describe the proposal as provisional, which is compatible with its remaining unadopted. It does not deny or merely hypothesize the proposing act. I therefore no longer classify these as clear source-entailment errors. They are disputed qualification renderings: potentially misleading attachment against the typed time scope, but defensibly faithful in ordinary English. The initial stronger classification is preserved in `language-v49-selected-forensic-review-initial.md`.

The other four produced undated answers use the more precise forms `The timing was tentative`, `Срок был предварительным`, or preserve the unknown source-relative year without the disputed attachment. The two remaining rows are null and are classified separately below.

### Missing actual proposer: `v19-held-fiction`, EN→EN inferred

The answer begins:

> `According to the proposed discussion attributed to Ada Marlow, the fictional example has ...`

This identifies Ada as the person to whom a proposed discussion is attributed, but it does not state that Ada proposed the discussion. Attribution is not proposer agency: a discussion can be attributed to someone without that person having proposed it. The source explicitly says `I, Ada Marlow, propose to discuss ...`, and the answer cites both retained records, so it must preserve Ada as the actual proposer. The remaining fictional content is accurate and fully scoped, but the material proposal actor is omitted. This is a clear source/action-role error despite the answer verifier's acceptance.

## Other accepted answers

I found no further clear accepted error.

- All eight report answers preserve outer Ada, inner Bo, service-bench sending permission, return-spring tension measurement rather than replacement, and Ada's personal unread/unconfirmed limits. None turns permission into booking or completed measurement. Their focused report answers need not state the separately lost no-collection fact.
- All hypothesis answers keep the premise and conditional consequence coupled, explicitly hypothetical, with actual requirements unknown and no real missed check.
- The other five produced exclusion answers preserve support-bracket negation and the limited unresolved status without asserting contract silence. One additional row is null after correctly rejecting the same malformed coverage relation.
- The seven produced assistant answers keep lack of examination and confirmation attached to the assistant rather than turning them into passive global absence.
- The other seven fiction answers place Vulpine's promise, Bo's recipient role, benefit, and ten-week duration inside an explicit fictional frame before denying a real agreement, and explicitly state Ada's proposal. They do not assert completed discussion.
- All six produced undated answers preserve Ada's proposal actor, source-relative anchor, unknown calendar year, and absence of an adopted plan/meeting; two English forms remain less precise in qualification attachment. The other two generated drafts were rejected and produced no answer.

The answer-verifier trace carries `retention_source_frame` and an `excerpt_selection` judgment for every semantic-verifier call. The frames constrain meaning but do not supply the omitted no-collection record as answer evidence. The accepted report, fiction, and unknown-clock answers show the intended source-frame, all-fiction, and clock scopes in actual prose.

## Nulls

1. `v19-held-exclusion`, RU→RU inferred — **correct rejection of a bad draft.** The draft contains the changed coverage construction quoted above. Its uncertainty and attribution are intact, but the warranty/repair roles are not.
2. `v19-held-assistant`, EN→RU inferred — **false deterministic attribution hold.** The draft says `По предварительному сообщению ассистента` and later explicitly states `ассистент не изучал договор и не подтвердил это предположение`. It faithfully binds the tentative report and both epistemic limits to the assistant. The `attribution` lexical floor fails to recognize this nominal outer-attribution form; no semantic-verifier call follows.
3. `v19-held-undated`, RU→RU inferred — **correct rejection of a bad draft.** `предложила предварительно рассмотреть` attaches `предварительно` to the reviewing action, adding a preliminary manner rather than expressing tentative timing.
4. `v19-held-undated`, RU→RU explicit — **correct rejection of a bad draft.** `план не был принят и встреча не была организована` broadens Ada's personal `I have not adopted ... or arranged ...` into unassigned passive states. The source-relative clock itself is preserved.

The three correct draft rejections remain answer-coverage losses over adequate writable evidence; they are not source-level reasons to abstain. Only the assistant row is a false guard hold of a faithful draft.

## Smallest bounded follow-up

1. **Resolve source-backed possessive device identity before ownership.** For generated candidates only, allow an exact possessive such as `my device` to inherit the sole device identifier established in the same immutable structured source/frame. Pass that resolved subject to the existing constrained ownership selection. Require exactly one source-backed device candidate; ambiguous or absent identity still holds. This restores the no-collection record without making routing metadata an authority or overriding a model choice.
2. **Generate canonical coverage-role grammar, then keep the existing verifier check.** For Russian coverage questions, instruct composition to use `покрывается ли гарантией ремонт X` or neutral `покрыт ли ремонт X`, never `покрывается ли ремонтом ... ремонт`. This is a role template rather than a vocabulary alias. The existing action-role comparison should remain mandatory; no retry or acceptance override is justified.
3. **Prefer temporal tentativeness as a separate sentence/constituent.** When commitment is asserted, disposition is proposed, and temporal status is tentative, generate `The timing/date was tentative/unknown` (and the Russian equivalent). Treat adverbial `proposed, tentatively` as ambiguous rather than automatically false: it still asserts the proposal and can describe a provisional proposal. The goal is clearer typed scope, not a new deterministic rejection rule.
4. **Recognize bounded nominal assistant attribution.** Admit `по (?:предварительному|неподтверждённому|непроверенному) сообщению (?:ассистента|SOURCE)` only when the same clause or immediately governed proposition contains the report content, while retaining wrong-speaker and unrelated-noun negatives. Full semantic verification must still check personal examination/confirmation scope.

5. **Apply the existing proposer rule to cited fiction/discussion pairs.** When the answer cites the actual proposal record as well as fictional content, neutral `a proposed discussion attributed to Ada` is insufficient; state `Ada proposed discussing ...`. This preserves the real outer act while keeping all embedded content fictional.

These changes address one routing omission, recurring coverage-role composition, ambiguous status attachment, one omitted proposal actor, and one lexical false hold. The evidence does not justify relaxing source-frame selection, semantic verification, source-clock requirements, or actor-preservation rules, and it does not support a retry-until-accepted path.
