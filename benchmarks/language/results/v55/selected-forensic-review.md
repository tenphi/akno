# V55 selected forensic review

## Scope and accounting

I reviewed only the finalized `bench-results/language-selected-v55.json`, `bench-results/language-selected-v55-trace.jsonl`, and `tmp/language-selected-output-packet-v55.json`, using the packet's original invented sources as authority. I did not inspect an output-grading receipt or call a model.

The report contains six writable cases and 48 query rows. It produced 40 non-null answers and 8 `draft_rejected` nulls. There were no generation, verification, retention, or provider availability failures. All source bytes remained stable; all six replay checks and ordinary-prose checks passed. Typed semantics and qualified retrieval were present for every case.

Retention generated eight candidates and wrote seven. Five of six cases have complete retained sets. `v19-held-report` lost its separate no-collection-booking record at placement (`routing_uncertain` / `ownership_uncertain`), so its retained set is incomplete even though the report's aggregate `usefulRetentionCoverage` field is 6/6. The substantive nested report still wrote and answered the selected service-report query.

My source-first classification of the 40 non-null answers is:

- 36 clearly faithful;
- 3 accepted completeness/qualification errors: hypothesis q5, assistant q2, and undated q6;
- 1 accepted source-role error: report q1;
- 4 additional undated answers (q0, q1, q2, q5) use “tentatively/preliminarily proposed.” I treat these as disputed rather than definite errors: they can be read as a provisional timing/proposal description, but grammatically attach tentativeness to proposing rather than explicitly to the time.

This is forensic production accounting, not an independent usefulness score.

## Coordinate convention

Within each case, q0..q7 are: EN→EN inferred, EN→RU inferred, EN→EN explicit, EN→RU explicit, RU→EN inferred, RU→RU inferred, RU→EN explicit, RU→RU explicit.

## Immutable audit behavior

The new anchor transport operated successfully in every answer that reached verification. `answer_segments` concatenated byte-for-byte to the generated block, and each `retention_source_frame` anchor table concatenated to the complete original frame. Source anchors were tied to the cited evidence ID and answer anchors to the current B1 block. Completed calls returned exactly one audit per cited framed record, a bounded `source_context`, all three category relations, all three semantic booleans, and excerpt selection. I found no foreign/stale coordinate, malformed schema, truncated JSON, audit leakage into public output, or typed availability failure.

The anchor mechanism removes V54's fabricated-quote failures. Its remaining limitation is semantic calibration: every completed V55 verifier returned `preserved` for all selected categories, including the accepted omissions and role error below. Coordinate membership proves provenance of text locations, not correctness of the model's relation.

## Case findings

### `v19-held-report`

The written record faithfully preserves Ada Marlow as outer relayer, Bo Winters as inner source, permission to send the device to a service bench for return-spring tension measurement rather than replacement, and Ada's unread/unconfirmed limits. The second candidate, `Ada Marlow states that no collection of her device has been booked`, is also source-faithful but placement returns `uncertain`; it is held and never persisted. This is a retention/routing loss, not a semantic hold. The candidate's reduced subject (“Ada Marlow's device collection”) no longer supplies the Zephyr identity that the full source context resolves, so the ownership call cannot safely select the existing product page.

Three accepted answers are clearly faithful: q2, q4, and q6. They preserve outer Ada, inner Bo, the measurement/non-replacement contrast, and both personal limits.

Q1 is an accepted reporting-role error. `По словам Bo Winters, Ada Marlow передала сообщение о том, что ...` grammatically makes Bo the authority for the proposition that Ada transmitted the message. The source is Ada's statement that Bo told her the embedded service claim. The content and uncertainty remain correct, but the outer/inner reporting relation is reversed or at least materially obscured. The verifier nevertheless marks the actor relation preserved.

The four nulls are all pre-verifier attribution holds:

- q0, `According to Bo Winters, as relayed by Ada Marlow, ...`, is a defensible compact expression of Bo's content relayed by Ada. The lexical floor rejects a faithful draft.
- q3 transliterates the protected names as `Бо Уинтерса` and `Ада Марлоу` and uses the same awkward source ordering. Blocking it is justified by the exact-name and attribution contract.
- q5, `Ada Marlow пересказала сообщение Bo Winters о том, что ...`, preserves Ada as relayer and Bo as the message's source. The attribution floor rejects a faithful, if nominal, construction.
- q7, `По словам Bo Winters ... Ada Marlow пересказала`, has the same reporting-direction defect as accepted q1. Blocking this particular draft is justified.

Thus two report nulls are false lexical holds and two block actual draft defects. Adequate evidence existed for every row, so even a correctly rejected bad draft remains a production coverage loss rather than a source-level reason to abstain.

### `v19-held-hypothesis`

Retention is complete and faithful. It keeps Ada's hypothetical two-month foam-filter rule, the conditional missed-check consequence, unknown actual requirements, and absence of a reported actual missed check.

Seven answers are faithful and keep the rule hypothetical. Q5 is source-entailing as far as it goes but incomplete for the selected proposition and query: `В своей гипотетической модели ... следует проверять каждые два месяца. Это не утверждение о действующем требовании: настоящие требования неизвестны.` omits the source's coupled consequence (“if accepted, a missed check would violate that assumed requirement”) and omits that Ada reports no actual missed check. The generation reading and verifier both had the complete original frame; the verifier still classified all categories as preserved. This is an accepted selection/completeness error, not an invented factual claim.

There are no nulls or availability failures in this case.

### `v19-held-exclusion`

Retention is complete and faithful. All eight answers are faithful. Each keeps the damaged support bracket as the excluded object, scopes nonresolution to what the exclusion record establishes about fan-motor repair, and explicitly avoids claiming that the whole contract is silent. V55's one-complete-proposition block composition removes V54's split-block verifier failure.

All eight anchor audits reached verification and passed with consistent coordinates. There are no nulls, accepted errors, or availability failures here.

### `v19-held-assistant`

Retention is complete and faithful. The V54 report-uncertainty false hold is fixed: the candidate's coordinated lack-of-examination/lack-of-confirmation plus possible-condition continuation reaches semantic verification, writes, routes, and is retrieved.

Six of seven accepted answers are complete and faithful. Q2 says only that the assistant tentatively suggested the quarterly status-display check and that it was a possible condition rather than an established requirement. It omits both explicit personal limits: the assistant had not examined the contract and had not confirmed the assumption. Those limits materially explain the report's uncertainty and were selected into the retained proposition. The verifier marks qualification preserved anyway. This is an accepted qualification/completeness loss, not a promotion to established fact because the answer still says possible/not established.

Q7 is a false pre-verifier attribution hold. `Предварительная версия ассистента состоит в том, что ...` is awkward but plainly attributes the tentative interpretation to the assistant and then explicitly preserves both personal limits and possible/not-established status. No semantic verifier is called.

### `v19-held-fiction`

Retention is complete as the actual proposed discussion plus the fictional promise. Both records preserve Ada as proposer, Vulpine Mutual as fictional promisor, Bo Winters as fictional recipient/character, free axle-cap replacements, the first-ten-weeks limit, no real agreement, and discussion-only-proposed scope.

Seven non-null answers are faithful. They keep Ada as proposer and all material fictional roles and limits. Singular `колпачка оси` versus plural English “axle-cap replacements” does not invent a different benefit; it is a natural generic rendering in this context.

Q3 is correctly blocked before verification because it transliterates the protected names (`Ада Марлоу`, `Бо Винтерсу`) instead of preserving exact source spelling. Its substantive fictional content is otherwise faithful, so this is again a correctly rejected bad draft over adequate evidence, not justified case abstention.

### `v19-held-undated`

Retention is complete and faithful. It preserves Ada as proposer, review of Zephyr QX-100 warranty exclusions, next year relative to the undated original record, unknown calendar year, and Ada's personal non-adoption/non-arrangement.

Q4 is clearly faithful. Q0, q1, q2, and q5 preserve actor, object, source-relative clock, unknown calendar year, and both personal negative actions, but phrase the action as `tentatively proposed` / `предварительно предложила`. Because the source has an asserted actual proposal with tentative timing, this attachment is less precise than “proposed ...; the timing is tentative.” It does not clearly deny that Ada made the proposal, so I record it as a disputed qualification rather than a definite source error.

Q6 is a definite accepted qualification error: `The proposal remains tentative` attaches tentativeness to the proposal/commitment itself. The source says the proposal is actually Ada's asserted proposal; only its time is tentative. The answer otherwise preserves agency, non-adoption, non-arrangement, and the unknown source-relative year. The verifier incorrectly marks qualification preserved.

The two nulls are pre-verifier:

- q3 is correctly blocked for transliterating `Ada Marlow` as `Ада Марлоу`; its substantive actor and clock content are otherwise faithful.
- q7 keeps exact names, Ada's proposal and both personal negative actions, and says next year is counted from the recording moment with the calendar year unknowable. The discourse floor rejects it because `момента записи` lacks the bounded lexical form expected for the original/source record. In this contextual sentence it is source-relative and faithful. This is a false deterministic hold.

## Failure buckets

- Incomplete retained set: 1/6 cases, one source-faithful no-booking candidate held at placement (`ownership_uncertain`).
- Non-null production: 40/48.
- Clearly faithful non-null answers: 36.
- Accepted source-role error: 1 (report q1).
- Accepted completeness/qualification errors: 3 (hypothesis q5, assistant q2, undated q6).
- Disputed temporal attachment: 4 non-null undated rows (q0/q1/q2/q5).
- Correctly rejected defective drafts: 4 (report q3/q7, fiction q3, undated q3).
- False deterministic holds: 4 (report q0/q5, assistant q7, undated q7).
- Semantic rejections: 0.
- Typed availability failures: 0.
- Accepted language-policy errors: none observed; all accepted Russian prose uses exact protected names and is Russian apart from those names/product identifiers.
- Source-byte changes: 0/6.

## Bounded next fixes supported by this run

1. **Canonicalize nested attribution at generation, then keep a narrow structural floor.** Prefer `According to Ada, Bo reported ...` / `По словам Ada, Bo сообщил ...`. Treat `Ada relayed Bo's report ...` as an equivalent bounded form. Do not admit `According to Bo, Ada relayed ...` merely to reduce nulls; V55 shows that form can reverse the reporting relation. This addresses both false report holds and the accepted q1 role error without weakening the semantic verifier.

2. **Carry source-resolved identity into placement.** For generated candidates only, resolve `my device` from the complete structured source when exactly one supplied product identity is explicit, and retain that canonical identity in the candidate subject used by ownership. Do not infer from the query, proposed page, or product similarity. This gives the correct no-booking candidate enough source-backed routing information without bypassing ownership policy.

3. **Make coupled selected clauses explicit in the existing verifier audit.** The generation rule helped the exclusion and most cases, but hypothesis q5 and assistant q2 show that the verifier still treats a partial block as complete. Within the same call, require `source_context` to enumerate the bounded material clauses selected from each record (actor/action, consequence or personal epistemic limits, and scope) and require each to map to an answer anchor or a negative relation. Server-owned anchors and existing booleans remain; no new semantic pass or retry is needed. An unselected adjacent proposition remains omittable.

4. **Separate tentative time from proposal commitment in both generation and verification.** Prefer two clauses: `Ada proposed X next year. The timing is tentative ...`. In the verifier, `proposal remains tentative` must be a qualification mismatch when typed commitment is asserted and only `temporal.status` is tentative. Preserve the existing allowance for natural narrative backshift.

5. **Use source-record identity, not a fixed adjective, in the unknown-clock floor.** A bounded expression such as `from the moment of this/the original/source record` or Russian `от момента (этой|исходной|самой) записи` should establish the anchor when the same sentence also preserves the unknown calendar date. Keep device/date and current-processing anchors negative. This addresses undated q7 without relaxing actor or time semantics.

6. **Admit the assistant's bounded nominal tentative-reading construction or generate the canonical direct form.** `Предварительная версия ассистента состоит в том, что ...` with same-clause tentative content and explicit personal nonconfirmation is source-faithful. Prefer canonical direct generation (`Ассистент предварительно предположил ...`) to avoid expanding a general nominal-attribution grammar; retain wrong-source and unrelated-phrase negatives.

These are changes within the existing generation, placement, deterministic guards, and one verifier call. The evidence does not support adding a retry, changing the model or threshold, or treating `source_context` as authority.
