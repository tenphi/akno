# V54 selected forensic review

## Scope and accounting

I reviewed only the finalized `bench-results/language-selected-v54.json`, its `language-selected-v54-trace.jsonl`, and `tmp/language-selected-output-packet-v54.json`. I did not use a grader receipt.

The report contains six writable cases and 48 query rows. Retention wrote 7 records across five cases; the assistant case's only candidate was held during structural validation. Answer production was 26/48: 26 answered, 10 `verification_rejected`, 8 `no_eligible_evidence`, 3 `draft_rejected`, and 1 `verification_unavailable`. All 48 recalls themselves completed, and every query outside the assistant case retrieved the intended retained evidence.

My source-first assessment of the 26 non-null answers is 25 faithful and one accepted action/qualification loss: `v19-held-undated` q2 (EN query, explicit view, EN answer). This is production accounting, not an independent usefulness score.

The new private source framing was exercised. Every generated answer over framed evidence emitted `record_readings`; every completed semantic call emitted per-evidence actor, object/mechanism, and qualification alignments. Multi-span retention verification emitted the expected frame audits. The trace also exposes a material weakness: rejection can result from the verifier's copied quote or relation label even when its three semantic booleans and prose comparison say the draft is faithful.

## Fixed query coordinate convention

Within each case, q0..q7 are, in order: EN→EN inferred, EN→RU inferred, EN→EN explicit, EN→RU explicit, RU→EN inferred, RU→RU inferred, RU→EN explicit, RU→RU explicit.

## Case findings

### `v19-held-report`

Retention is complete and source-faithful. One record keeps Ada Marlow as outer relayer, Bo Winters as inner reporter, permission to send the device to a service bench for return-spring tension measurement, the explicit non-replacement contrast, and Ada's unread/unconfirmed limits. The separate no-collection-booking denial is retained independently and routed to the proposed subject page; there is no routing failure.

The three produced answers, q3–q5, are faithful. Each preserves outer Ada/inner Bo, measurement rather than replacement, and Ada's two personal verification limits.

Five faithful drafts, q0–q2 and q6–q7, were rejected as `semantic_support`. The semantic model actually returned all three booleans true with no mismatch. Four failures use a synthesized English `source_quote` for the Russian clarification, such as `This is words Bo Winters in my retelling, not a condition she verified.`; q7 uses the non-verbatim fragment `not about replacing this spring`. Those strings are not exact source substrings, so the deterministic coordinate check correctly refuses the malformed audit. The draft text itself is supported. These are false case abstentions caused by quote-coordinate generation, not justified withholding and not evidence that the answer proposition was unsafe.

### `v19-held-hypothesis`

Retention is complete: Ada's thought-experiment rule, two-month frequency, coupled missed-check consequence, unknown actual requirements, and absence of any reported actual missed check all remain scoped as hypothetical.

Seven non-null answers are faithful. The shorter explicit answers q2, q6, and q7 omit some adjacent negative detail but keep the rule and consequence explicitly hypothetical; they do not assert a real requirement or real missed check.

Q5 was correctly rejected as a bad draft. It said `По словам Ada Marlow ... было выдвинуто гипотетическое правило`, which makes Ada only an outer source and leaves the act of positing the rule agentless. The verifier identified both proposition and action-role loss. Adequate evidence existed, so this remains an answer-coverage loss, but accepting this particular draft would have lost Ada's agency.

### `v19-held-exclusion`

Retention is complete and precise: the damaged support bracket is excluded, while that exclusion record does not resolve fan-motor repair coverage and does not claim whole-contract silence. Seven non-null answers are faithful and preserve the narrow epistemic subject.

Q5 generated two individually faithful blocks from the same record: the bracket denial and the record-scoped unresolved fan-motor qualification. B1 verified. For B2, the verifier treated the independently selected qualification as if it had omitted the bracket proposition, marked actor/object omitted, set `action_arguments_preserved:false`, and `selected_by_retained_excerpt:false`. The operation then surfaced `verification_unavailable`/`answer_verification_failed` rather than a semantic rejection. This is neither justified source-level abstention nor an unsafe draft; it is a verifier/output-contract failure caused by splitting one selected record across two blocks while requiring each block's audit to account for the whole record.

### `v19-held-assistant`

The extracted candidate is source-faithful: it preserves the assistant's preliminary reading, quarterly status-display check, lack of contract examination and confirmation, and possible-condition/not-established status. Its only repair changes `this is` to `this remains` without repairing the structural issue. Both versions are held at validation with `discourse_uncertain`; no retention semantic verifier or placement call is reached.

The concrete validation failure is the report-uncertainty floor, not reporter binding. The trace's hold reason is that the source report explicitly lacks confirmation but the candidate does not preserve readable uncertainty. In fact, the candidate does preserve it: `the AI assistant has not examined the contract or confirmed this assumption, and this [is/remains] a possible contract condition rather than an established requirement`. The actor substring `assistant` is recognized. The closed-list branch in `hasReportUncertainty` requires its matched negative list to reach a sentence/clause boundary (or its one fully consumed explanatory continuation); the candidate instead continues after the comma with `and this ...`, so the lookahead fails. The original source puts the possible-condition statement in a separate sentence and therefore matches. This diagnosis is high confidence because it follows the emitted hold reason, the exact candidate, and the validator at `packages/core/src/write/retain.ts` rather than inference from the speaker label. Because retention is empty, all eight answer rows correctly report `no_eligible_evidence` for the state they receive. At source level this is an upstream false hold and eight avoidable coverage losses, not eight independently justified abstentions.

### `v19-held-fiction`

Retention is complete as two records: Ada's real but merely proposed discussion, and the fictional promise with Vulpine Mutual as promisor, Bo Winters as fictional recipient, free axle-cap replacements, and the first-ten-weeks limit. Both route successfully.

The four produced answers q0, q3, q5, and q6 are faithful. They retain Ada as proposer, preserve the fictional actor/recipient/object/time roles, and do not establish a real agreement or completed discussion.

The four rejected drafts q1, q2, q4, and q7 are also faithful. Their semantic verdicts report all three booleans true and no mismatch. Each is nevertheless rejected because at least one source alignment is labeled `generalized`: the verifier selects a short answer substring that omits `Zephyr QX-100` although the product appears in the same answer sentence, or describes the proposal record through the embedded fictional content. The full answers preserve the material actors, object, timing, fictional scope, proposal status, and no-real-agreement limit. These are false holds produced by an over-local or inaccurate alignment relation, not correct rejections of unsafe drafts.

### `v19-held-undated`

Retention is complete and routes correctly. It preserves Ada as proposer, the warranty-exclusion review, tentative next-year timing relative to an undated original record, unrecoverable calendar year, and Ada's personal non-adoption/non-arrangement.

Four of the five non-null answers are faithful: q0, q1, q4, and q6 explicitly retain Ada's proposal agency and both personal negative actions; their source-relative clock is correct. Q2 is an accepted action/qualification loss. `According to Ada Marlow, the proposed action was to review ...` makes Ada the outer source of the statement but does not grammatically make her the proposer. Its later sentence binds Ada only to not adopting a plan and not arranging a meeting. The source explicitly says `My proposal`; the verifier's claim that the answer preserves Ada as proposer is unsupported by the answer quote it selected.

The three pre-verifier holds are correct rejections of bad drafts, though the case had adequate evidence and therefore each remains a coverage loss:

- q3 preserves Ada as proposer and binds plan non-adoption with `ею`, but `встреча не была организована` leaves the meeting's non-arranger unspecified; the attribution floor rejects it.
- q5 likewise leaves the meeting unassigned; the attribution floor rejects it.
- q7 says `Предложение не было оформлено как принятый план, и встреча не организовывалась`, dropping Ada as actor of both negative actions; the discourse floor rejects it.

## Failure buckets

- Upstream retention false hold: 1 case, causing 8 `no_eligible_evidence` rows (`assistant`).
- Faithful answer drafts falsely rejected by audit mechanics: 9 rows (5 report exact-source-quote failures; 4 fiction alignment-relation failures).
- Faithful answer lost to verifier/schema availability: 1 row (exclusion q5 split-block audit).
- Bad drafts correctly blocked: 4 rows (hypothesis q5; undated q3, q5, q7). These are still production coverage losses because writable adequate evidence existed.
- Accepted source error: 1 row (undated q2, missing actual proposer agency).
- Provider availability failures: none in generation or retention; the sole reported availability failure is the internally inconsistent/negative answer-verifier transaction for exclusion q5.

## Bounded next changes supported by this run

1. Replace model-copied quote coordinates with server-assigned stable source and answer anchors. Preserve source clause groups (and allow a bounded, server-defined subspan option) so one sentence containing independent propositions is not forced into one indivisible meaning. Check that every selected source anchor belongs to that evidence record and every selected answer anchor belongs to that block. The model should classify the relationship between those immutable anchors rather than reproduce either quote. Full source-frame clarification must be resolved before an isolated category comparison, and the relation must be interpreted against the whole answer block. This directly addresses the report quote failures without weakening any semantic dimension or recreating the exclusion split problem.

2. Validate alignment relations against the whole answer block, not only the model's chosen short `answer_quote`. A `generalized` or `omitted` label should require a concrete material difference that is absent from the full block. Preserve the existing fail-closed three booleans and mismatch requirement. This addresses the four fiction false holds while retaining actor/object/qualification enforcement.

3. Make the block contract explicit: either require generation to compose one complete selected proposition per cited evidence record into one block, or allow a record to contribute different selected categories across multiple blocks and aggregate those alignments transactionally. The current hybrid makes the faithful exclusion split structurally impossible and converts a semantic decision into availability failure.

4. Generalize the closed report-uncertainty list structurally, without loosening its negation or actor binding: allow a recognized personal negative examination/confirmation list to be followed by a coordinated clause that preserves another uncertainty qualification for the same proposition. Stop at adversative, retraction, new-subject, or positive-confirmation boundaries, and retain the unchanged semantic verifier. This directly covers the observed `..., and this is/remains a possible ... rather than established ...` form; changing generic assistant reporter recognition would not address this failure.

5. Require generated answers about a personal proposal to express the proposer as an action argument, independently from outer attribution and independently from later non-adoption/non-arrangement actors. The existing verifier already has the right dimension; its alignment assessment must reject `According to Ada, the proposed action was ...` when the source says Ada herself proposed it.

These changes stay within the existing generation and verification calls. They do not require retrying rejected semantics, changing models, relaxing gates, or treating the private reading/audit as source authority.
