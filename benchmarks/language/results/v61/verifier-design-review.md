# V61 bounded verifier design review

## Recommendation

Conditionally omitting `question` from the private answer-verifier payload is a coherent, bounded change for `complete_retained_record` blocks. It should apply only when the one-record renderer is active. Generation must continue to receive the question, and ordinary composed blocks must continue to send it to verification.

This separation matches the existing contracts:

- the question controls recall, memory-view eligibility and the generator's decision whether the one record answers the request;
- a complete-record block is an exact current copy or a complete translation of one selected retained record;
- the support verifier checks that block against its visible retained record, bound original frame, qualifications and immutable anchors;
- the question is not source evidence and cannot resolve a source ambiguity or authorize a premise.

The change may reduce anchoring to a query's earlier wording, as in V60's `dial` query, but that is a hypothesis to test in the exposed probe. The V60 trace does not prove the question caused the three false holds. The verifier's internal cause is unknown.

I found no need for a new schema, model pass, retry, token ceiling, public field or relaxed gate. Add a short per-record contribution rule to the existing alignment contract for the selected-fiction false hold. Keep `generalized`, `changed` and `omitted` terminal, retain all three semantic booleans, retain excerpt selection, and retain server validation of every alignment.

## Why omission is semantically valid in this narrow mode

The one-record renderer is activated only for one qualified managed line with one bound frame and an explicit output language. Its output schema permits either the exact server-materialized current text or a translation of the complete text. The generator sees the question and may return no block. If it returns a block, local citation/value/language guards run before the independent verifier.

At verification time, the proposition to audit is therefore fixed by the cited readable record rather than selected clause-by-clause from the question. `rendering_scope: "complete_retained_record"` already means every readable clause is selected. The bound original frame constrains the meaning of those clauses, and the three alignments compare their actor, object/mechanism and qualification. Omitting the question prevents it from acting as an extra semantic anchor while preserving all actual authority:

- `answer_segments` remains the exact complete candidate;
- `cited_evidence.excerpt` remains the current retained record;
- `retention_source_frame` remains the exact bound original context;
- `required_records` retains qualification metadata;
- `memory_view` may remain as record-class context;
- every semantic boolean, alignment and selection condition remains mandatory.

This does not create a server-side source bypass. Exact copy remains subject to original-frame verification, and translated text remains subject to the same comparison and language check. The query already cannot supply an actor, component equivalence, report event, qualification or missing fact.

The implementation should omit the `question` property, rather than send an empty or synthetic question. The verifier system text should make the conditional contract explicit: for complete-record rendering, judge source support and complete preservation from the record and frame; no question is supplied because the entire retained record is the selected unit. The later generic instruction to use the supplied question should be qualified as applying when a question is present. Otherwise the system prompt would ask the model to consume a missing field.

## Relevance and reference risks

The main tradeoff is that the verifier no longer has a fallible second opportunity to notice an irrelevant exact record. The schema has no independent `answers_question` field today, so relevance is not a deterministic acceptance gate even when the question is present; a model can currently express a relevance objection only indirectly through semantic fields that are defined for source support. Removing the question makes this separation explicit.

The remaining relevance controls are:

1. recall and `answerLineEligible`, both driven by the question and memory view;
2. the one-record generator, which still sees the question and is instructed to return no block when the record does not answer it;
3. `missing_concepts` and the ordinary empty-draft path;
4. local citation, protected-value and language checks.

This is sufficient for the bounded pilot, but it is not proof against an irrelevant generator selection. An unrelated exact copy could be source-supported and still be useless. V61 should report that as a known availability/usefulness risk, not claim the verifier now guarantees relevance. Adding a relevance boolean in this change would enlarge the schema and conflate a separate question with source entailment.

Question-dependent ellipsis is the other risk. A retained line may contain `it`, `that question` or a terse label whose conversational referent is clearer from the query. The verifier still receives the full visible record, page title and original frame, so it should resolve a source-supported antecedent from those inputs. It should not require the published block to be understandable outside its conversational question. Local tests can establish payload availability and unchanged gates, but only the exposed model evaluation can show whether omission raises false holds on natural elliptical records.

Yes/no interpretation is not lost for complete rendering: the generator sees the yes/no question, while the verifier receives the full retained affirmative, denial or unresolved question rather than a bare generated `yes` or `no`. Ordinary composition can still produce a question-dependent concise answer and therefore keeps the question in its verifier payload.

## Per-record contribution guidance

The current schema correctly requires one `source_alignments` entry per cited framed evidence ID and rejects any `generalized`, `changed` or `omitted` relation. Its remaining ambiguity is how to divide a jointly supported block among citations. A verifier can wrongly require one record to reproduce a sibling record's detail, or can wrongly use a sibling to conceal a restriction belonging to the current record.

Add a concise rule to `ANSWER_ALIGNMENT_CONTRACT` along these lines:

> For each evidence_id, first identify the exact material contribution its retained excerpt makes to the current block, and state that contribution in source_context. Compare this record's actor, object/mechanism and qualification only where its contribution selects those categories. Do not require one citation to independently supply a sibling citation's distinct detail. Conversely, when this block uses a proposition or category from this record, compare every material restriction that this record places on that contribution; sibling evidence cannot turn a generalized, changed or omitted relation into preserved or not_selected.

This preserves the intended collective-selection rule without weakening it. A fiction record that contributes only fictional scope can have `qualification: preserved` and unrelated categories `not_selected`; it need not independently supply a sibling's actual proposal details. If its own fictional promise contributes a specific object, recipient or limit to the block, those categories are selected and must be compared. Marking only the fiction qualification preserved cannot excuse generalizing the promise's own mechanism.

No schema change is needed. `source_context` already has room to identify the contribution, every record must still have at least one non-`not_selected` category, and `answerAlignmentsSupported` still accepts only `preserved` or `not_selected`. All three global booleans and `excerpt_selection.selected_by_retained_excerpt=true` remain required. A model can still allocate contribution incorrectly; this prompt clarification is a fallible alignment aid, not a new proof mechanism.

## Compatibility, budget and versioning

The change affects only private model input. Public answer request/response types, retained storage, citations and managed markers are unchanged. It removes a small amount of input from complete-record verifier calls and adds only a short system instruction, so the existing 2,400-token configured ceiling and per-call requested cap need no adjustment. Call count remains one generation plus the existing singleton verifier, with no retry.

The verifier prompt and its conditional payload contract change, so increment `ANSWER_VERIFIER_PROMPT_VERSION` and update benchmark expectations and fingerprints. Generation version need not move unless generation instructions change independently. Trace payloads for complete-record calls will intentionally lack `question`; ordinary traces retain it. Documentation and the V61 plan should state this distinction so absence is not mistaken for truncated telemetry.

## Meaningful tests

Use only invented records and existing model stubs:

1. Capture a complete-record copy call and a translate call. Assert generation receives the exact question, while the verifier user JSON has no `question`, retains `memory_view`, and preserves exact answer segments, current excerpt, required record and frame anchors.
2. Capture an ordinary composed block and assert its verifier still receives the question. This protects yes/no, focused and multi-evidence behavior outside the pilot.
3. Have complete-record generation return no blocks for an unrelated invented question. Assert no verifier call and the existing empty/missing outcome. This proves the question remains on the selection side; it does not claim the model will always choose correctly.
4. Preserve fail-closed verifier cases for `proposition_supported=false`, either other semantic boolean false, selection false, a generalized/changed/omitted alignment, missing/foreign anchors, malformed strict JSON and transport failure. Query omission must not change any of these dispositions.
5. Exercise an invented bilingual source clarification where the retained record uses the clarified term and the query uses the earlier term. Assert the captured complete-record verifier has no query text and still contains every original-frame byte. Use separate all-true and changed-object stub verdicts to prove the same mandatory gate, without presenting the stub as semantic reliability evidence.
6. Exercise a multi-citation ordinary block where E1 supplies a proposed act and E2 supplies fictional content/scope. Verify the prompt reaches the call; accept when each record's actual contribution is preserved, and reject when E2's own specific mechanism is generalized even if E1 overlaps. Keep every citation's nonempty contribution requirement.
7. Include a complete retained record with a source-resolvable pronoun or `that question`. Confirm its excerpt/frame/title remain present without the query. Treat live semantic behavior as an evaluation question rather than encoding a stubbed expected judgment as proof.

Avoid a test that accepts an irrelevant copied record by simply returning all true. That would only demonstrate the known limitation and could normalize a behavior the useful-answer gate should still catch.

## Conclusion

The conditional omission is sound for the complete-record support audit because the selected unit is fixed before verification and the question has no source authority. It cleanly separates relevance selection from source entailment and may reduce query-term anchoring, though V60 does not establish causality. Preserve the question for generation and every ordinary verifier call, explicitly conditionalize the verifier instructions, and document the remaining fallible relevance/ellipsis risk.

The per-record contribution clarification is the smallest coherent response to the selected-fiction alignment hold. It should guide category allocation without changing schemas or acceptance: a record is judged on what it actually contributes, while every restriction belonging to that contribution remains mandatory and every negative alignment still rejects.
