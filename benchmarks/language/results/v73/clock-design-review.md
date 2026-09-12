# V73 selected undated-clock design review

Scope: the `v20-held-undated` source and the extraction/repair/retention-verifier calls at trace rows 204–208. I did not read other selected grading or review artifacts, fresh held-out inputs, or make provider calls. This is a proposed next-revision design, not an implementation review.

## Source-first judgment

The original source states all of the following as one coupled record:

1. Ada Marlow actually proposes reviewing the Zephyr QX-100 repair terms next month.
2. She has neither accepted a plan nor organized a meeting; it remains only her proposal.
3. The original record date is unknown.
4. “Next month” means the month after that original record.
5. It explicitly does **not** mean the month after processing.
6. The calendar month cannot be established.

The initial extracted candidate at row 205 of `bench-results/language-selected-v73-trace.jsonl` (preserved locally and hashed in [the artifact manifest](local-artifact-manifest.json)) preserves the proposal, negative actions, positive source-relative direction, and unresolved calendar month. Its wording, however, says only “after her source record”; the current local floor does not recognize either the required source-clock anchor or unknown reference date. The cleaner therefore sends original position `0` through the existing single structural repair.

The repaired candidate at rows 206–207 says:

> Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month, meaning the month after the original recording, whose date is unknown; the calendar month cannot be established. She has not accepted a plan or organized a meeting; this is only her proposal.

It keeps the original support and discourse-frame spans, metadata, position, subject and page. It passes the language check and the local source-relative/unknown-clock floor. The final verifier at row 208 then returns `proposition_supported:true`, `action_arguments_preserved:true`, and `qualification_scope_preserved:false`. Its sole mismatch is `qualification_scope_preserved / omitted_scope`: the repaired prose omits the explicit exclusion of processing as the reference clock.

The repaired prose is source-entailed. A month defined as following the original record ordinarily identifies the positive reference clock and strongly implies that processing is not the selected reference. That does not make it a complete preservation of this source. The source deliberately states the corrective contrast `а не после обработки`; the retention contract requires deciding restrictions and coupled contrasts to remain readable. The candidate turns an explicit exclusion into an implication. I therefore regard row 208 as a sound semantic hold and the eight resulting null answers as a production loss caused by the repair generation, not a false hold.

This is not a metadata, proof-span, position, polarity, language, or local-clock-recognition defect in the repaired candidate. Relaxing `qualification_scope_preserved` would discard a material source qualification.

## Smallest defensible correction

Add one private `source_clock_text_only` arm to the **existing repair call**, patterned after the current report text-only transaction in [retain.ts](../../../../packages/core/src/write/retain.ts) and [retain-report-repair.ts](../../../../packages/core/src/write/retain-report-repair.ts). Use it only when a generated candidate has correct, validated source spans and metadata and the source-clock readability defect is its sole local failure. Do not add a pass or retry.

The arm should require four model-written final-prose fields in this order:

1. `proposition_and_nontemporal_scope` — actor, action, object, interval, and every nonclock limit.
2. `source_clock_anchor_and_unknown_date` — the interval, its direction relative to the original record, and that record's unknown date.
3. `excluded_reference_clocks` — every reference clock that the exact source explicitly excludes.
4. `unresolved_calendar_period` — the source's unresolved calendar date or period.

The server may add only the three joining spaces. It must not synthesize clock language. A representative faithful rendering is 315 UTF-16 units:

> Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month. She has not accepted a plan or organized a meeting; this is only her proposal. Next month means the month after the original record, whose date is unknown. It does not mean the month after processing. The calendar month cannot be established.

A feasible initial allocation is `195 + 90 + 60 + 52 + 3 joining spaces = 400`, but those individual caps should be validated against invented English and Russian controls before adoption. The invariant that matters is the unchanged normalized total of 400. Each field should be a nonempty complete sentence, reject CR, LF and NUL, and end in `.` or `!`, as the report text-only fields do today.

Four fields are justified here. Combining exclusions and calendar uncertainty into one `remaining_clock_qualifications` field, as answer translation currently does in [answer-record-rendering.ts](../../../../packages/core/src/ops/answer-record-rendering.ts), would still let the model return only one of the two and satisfy the schema. That is the exact failure this revision should make harder to repeat.

### Source-conditioned activation

The specialized arm must not force an exclusion into sources that do not state one. Its private `repair_contract` should therefore carry server-derived required dimensions and their exact current discourse-frame witnesses. The derivation should be a source-side refactor of the bounded clock recognizers in [source-clock.ts](../../../../packages/core/src/timeline/source-clock.ts), returning recognized anchor, unknown-date, excluded-clock and unresolved-period witnesses rather than treating a private model summary as authority. It must preserve item/span identity and may not concatenate evidence across unrelated items or quoted examples.

For this source, the exact second frame span authorizes all four clock dimensions, including `а не после обработки`. If all required dimensions cannot be established by the bounded source recognizer, retain the current full-candidate repair path. An output field name, model-selected witness, or verifier interpretation must not activate the arm by itself.

This requirement is the safety boundary. A schema that always requires `excluded_reference_clocks`, without source-conditioned activation, can invent exclusions. A schema that makes it optional merely restates the existing prose instruction and cannot structurally address this omission.

### Transaction and verification invariants

- Give this arm its own strict disjoint repair branch with the original zero-based `candidate_index` singleton enum. Do not let it collide with `report_text_only` or full-candidate entries.
- Defer the clock readability hold long enough to establish that every other per-candidate floor passes. A first-found `time_unresolved` reason is insufficient because a later actor, discourse, proof, relation, or page defect may otherwise be hidden. Candidates with more than this one eligible clock defect use the full repair branch.
- Require literal raw `relations: []`, as the report text-only arm does, so replacing prose cannot conceal relation changes.
- Parse any transaction containing a text-delta arm with strict `JSON.parse`; reject truncation, trailing content, duplicate indices, missing targets, extra keys, or invalid mixed branches atomically. Do not salvage a partial delta.
- Clone the original candidate and replace only `text`. Preserve support, complete discourse frame, typed time, attribution, discourse, epistemic basis, polarity, subject, page, and original position byte-for-byte.
- Re-run the complete repaired vector through all local cleaning, language checking on the joined public text, immutable-sibling and lost-position checks, the 400-unit cap, and the mandatory full-source semantic verifier with its repair obligation.
- A negative semantic verdict remains final. There is no second semantic attempt, semantic repair, or threshold change.

The existing repair prompt already says to keep all deciding source qualifications, yet this call omitted one. Another undifferentiated prose reminder would be lower cost, but the V73 evidence shows it is not an enforceable correction. Required source-conditioned final-prose fields provide useful generation structure while leaving source truth with exact spans and the full verifier.

## Meaningful controls

1. Reproduce this invented source. A four-field repair containing the positive anchor, unknown record date, explicit processing exclusion, unresolved calendar month, proposal-only limit and both negative actions survives cleaning and reaches semantic verification at original position `0`.
2. Omit each field in turn, add an extra key, use the wrong index, duplicate an index, truncate JSON, omit a closer, or append trailing content. The complete transaction is invalid, no partial candidate is admitted, and there is no retry.
3. Supply `after processing`, exclude the wrong clock, reverse the interval direction, resolve a date, omit a negative action, or turn the proposal into an accepted plan. Each structurally valid response reaches the mandatory verifier and is held by an independently specified negative semantic verdict.
4. Use a source-relative unknown clock with no explicit excluded clock. It must not activate the four-field arm or acquire a new exclusion; it follows the ordinary full-repair path.
5. Put `not after processing` only in a quotation, sibling item, unrelated device-processing clause, condition, question, or retracted clause. It must not become the source witness for this candidate.
6. Combine a clock defect with a report-uncertainty, actor, proof, page, relation, or nonempty-relation defect. The specialized arm must not activate.
7. Exercise mixed repair batches containing clock text-only, report text-only and full-candidate entries at noncontiguous original positions. Validate exact target sets, immutable admitted siblings, duplicate detection, and lost-position rejection.
8. Cover normalized UTF-16 totals at 399, 400 and 401, individual field boundaries, CR/LF/NUL, terminal punctuation, English and Russian prose, and a joined language mismatch.
9. Assert Chat and Responses wire schemas expose the same strict branches and numeric singleton enums, and that token ceilings, call count, model role and public protocol remain unchanged.

## Limits

This correction structures one fallible generation call; it does not prove semantic completeness. Finite source-clock recognition will leave unfamiliar faithful forms on the ordinary full-repair path. Conversely, an incorrect but well-formed four-field repair can still pass the local floors. Exact source witnesses and the unchanged semantic verifier remain necessary. Those limits favor this narrow text-only arm over expanding local answer grammar or weakening the verifier for an output that is entailed but incomplete.
