# V60 selected-probe source-first forensic review

## Scope

I compared the invented originals in `tmp/language-selected-output-packet-v60.json` with the finalized [selected report](selected-diagnostic.json), then used the [trace](../../../../bench-results/language-selected-v60-trace.jsonl) to locate stages and causes. I did not inspect a grading receipt, call a provider, or edit runtime. Private model readings and verifier narratives are not source authority.

The run produced **39/48** answers: report 8, hypothesis 7, exclusion 5, assistant 7, fiction 4, undated 8. It had one case-level availability failure, one answer-operation failure, seven guard rejections, one semantic-verification rejection, no language-policy rejection, and no source-byte change. These are production counts, not usefulness labels.

## Retention

Five of six original-source sets are complete.

- **Report:** the main record faithfully preserves Ada Marlow as outer reporter, Bo Winters as inner speaker, permission to send the device to a service bench for return-spring tension measurement rather than replacement, and Ada's unread/unconfirmed limits. A second faithful record preserves the separate passive no-collection-booking denial. Both pass semantic verification ([trace L1–L3](../../../../bench-results/language-selected-v60-trace.jsonl#L1)). The main report is written; ownership returns `uncertain` for the denial, so the denial is held at placement ([L4–L5](../../../../bench-results/language-selected-v60-trace.jsonl#L4)). The new person-page suggestion was not exercised: extraction used a person/possessor subject but returned `page:null`, leaving no proposed person page.
- **Hypothesis:** one retained record now faithfully composes the complete source proposition: Ada's hypothetical two-month foam-filter rule, its coupled conditional consequence, actual requirements unknown to the group denoted by `нам`, and Ada's statement that she reports no real missed check. It passes semantic verification and routing ([L38–L41](../../../../bench-results/language-selected-v60-trace.jsonl#L38)). Quoting `нам` preserves the source's unresolved group membership rather than inventing it.
- **Exclusion:** the retained record preserves bracket noncoverage and both fan-motor limits: this exclusion does not settle repair coverage and does not assert whole-contract silence ([L75–L77](../../../../bench-results/language-selected-v60-trace.jsonl#L75)).
- **Assistant:** the retained record preserves tentative assistant attribution, quarterly functional status-display check, both personal limits, and possible rather than established contractual status ([L108–L110](../../../../bench-results/language-selected-v60-trace.jsonl#L108)).
- **Fiction:** separate records preserve Ada's proposed discussion/no-real-agreement statement and the fictional Vulpine Mutual promise to fictional Bo Winters, including free axle-cap replacements and the first ten weeks of ownership ([L143–L145](../../../../bench-results/language-selected-v60-trace.jsonl#L143)).
- **Undated:** the retained record preserves Ada as proposer, warranty-exclusion review next year, personal non-adoption/non-arrangement, proposal-only status, undated source-relative time, and unrecoverable calendar year ([L169–L171](../../../../bench-results/language-selected-v60-trace.jsonl#L169)).

## Accepted answers

I found no clear source-entailment, qualification, actor, selection, or language error in the 39 published answers.

- All eight report answers preserve the full selected report; omitting the independently retained-but-unwritten collection denial is appropriate for the focused report question.
- The seven published hypothesis answers preserve every clause of the consolidated retained proposition, including the group-relative unknownness and no-real-missed-check statement.
- The five exclusion answers preserve the bracket denial and the narrow record-level fan-motor uncertainty.
- The seven assistant answers preserve the assistant's epistemic role and both verification limits.
- The four fiction answers preserve Vulpine Mutual as fictional promisor, Bo Winters as fictional recipient, free axle-cap replacements, the ownership interval, and fiction-only scope. Answers that add Ada's proposal/no-agreement clauses cite both records; promise-only answers cite only the promise record. This is direct evidence that the V60 per-record selection/citation instruction was exercised. It improved the earlier observed sibling-citation shape in accepted rows, without proving general causal reliability.
- All eight undated answers preserve Ada's proposer and negative-action roles and the complete clock qualification. RU q7 retains the exact English label `next year` in quotation inside otherwise Russian prose; that phrase occurs in the original bilingual source and functions as a source label, so I do not classify it as an untranslated prose error.

## Nulls

### Hypothesis q7 — verifier transport/parse failure

The RU-query/RU-answer explicit-view draft is source-faithful and complete. Its single answer-verifier call returns `ok:false`, `reason:"bad_response"`, with no value ([trace L72–L73](../../../../bench-results/language-selected-v60-trace.jsonl#L72)). The report records 17,260 ms latency and exactly 2,400 verifier output tokens, equal to the configured probe ceiling. That is evidence consistent with output exhaustion, but no raw partial response was preserved, so it does not prove truncation or reveal the malformed payload. The operation closes with `verification_unavailable`; there is no retry. This is an availability loss, not a semantic rejection.

### Exclusion q1, q3, q7 — correct rejection of malformed Russian role wording

These three generated drafts reverse or garble the repair/coverage grammar, for example:

- `не определяет, покрывается ли ремонтом двигатель вентилятора`
- `не определяет, покрывается ли ремонтом двигателя вентилятора гарантия`

Those mean or suggest that the fan motor/warranty is covered *by repair*, rather than asking whether fan-motor repair is covered. They are rejected before semantic verification under `semantic_support` ([trace L84, L91, L106](../../../../bench-results/language-selected-v60-trace.jsonl#L84)). These are correct bad-draft holds, while each row still represents answer coverage lost despite adequate evidence.

### Assistant q1 — false attribution hold

The draft says `По сообщению ассистента` and then explicitly repeats the assistant as source and as actor of the personal limits. It preserves all source content and qualification, but the bounded attribution floor rejects it before verification ([trace L117](../../../../bench-results/language-selected-v60-trace.jsonl#L117)). This is a conservative lexical false hold and unjustified row abstention.

### Fiction q1, q3, q5 — focused faithful drafts held by attribution floor

Each draft answers the requested promise directly, preserving fictional scope, promisor, recipient, object, and duration, but does not repeat Ada as the outer source in the answer sentence. The query already supplies Ada's proposed-discussion frame. The attribution floor rejects each before verification ([trace L151, L156, L161](../../../../bench-results/language-selected-v60-trace.jsonl#L151)). Under the focused-answer interpretation used in this audit, these are source-faithful drafts and conservative false holds; they do not justify abstention from a writable answer.

### Fiction q2 — semantic false rejection/disputed qualification reading

The draft cites both E1 and E2 and states that Ada proposed discussing a fictional example in which Vulpine Mutual promises fictional Bo free axle-cap replacements during the first ten weeks; it also says the discussion was only a proposal and there was no real agreement ([trace L153](../../../../bench-results/language-selected-v60-trace.jsonl#L153)). The verifier response describes all source roles and returns all three primary booleans true, but the block is ultimately counted as `semantic_support` rejected ([L154](../../../../bench-results/language-selected-v60-trace.jsonl#L154)). The answer's opening fictional-example scope applies to the embedded promise, so I find it source-faithful. It is less explicit than the source's separate sentence `the promise belongs only to the fiction`; if that redundancy is treated as mandatory, the hold is defensible as completeness protection. It is not an unsupported factual assertion.

## Clock reproduction

I invoked `hasDeicticTime`, `hasSourceRelativeAnchor`, and `hasUnknownReferenceClock` separately on all eight finalized undated answers. Every answer returned `{deictic:true, anchor:true, unknown:true}`.

The current live Russian answers use `отсчитывается от недатированной исходной записи` or `относится к недатированной исходной записи`; they do **not** use the newly added V60 `от времени <source noun>` construction. The English retained/copy answers use the inherited `relative to the undated source record` form. Thus this probe confirms that complete clock qualification survived, but it does not exercise or establish the causal value of the new clock branch.

## Bounded conclusions

The principal residual losses are lexical attribution holds for faithful focused Russian answers, three correctly rejected malformed coverage translations, and one one-shot verifier `bad_response`. Per-record citation behavior is visibly improved in the fiction rows: combined claims cite both records and focused promise claims cite only the promise. The remaining report retention loss is ownership of an explicitly possessed but otherwise unidentified device; the V60 generation guidance did not produce a proposed person page in this run.

Any next change should remain bounded to (a) grammatical source-bound nominal report attribution and (b) generating correct active/passive warranty-coverage roles. The fiction semantic disagreement does not support relaxing source selection or the three mandatory semantic gates, and the one transport failure does not support semantic retry.
