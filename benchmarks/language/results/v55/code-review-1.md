# V55 code review — round 1

## Finding

### Medium — the new verifier asks for a “selected positive meaning,” which can invert or suppress selected denials

`packages/core/src/ops/answer-source-audit.ts`, in `ANSWER_ALIGNMENT_CONTRACT`, tells the verifier to write `source_context` as “the selected positive meaning, explicit clarification/contrast and limits.” The selected proposition is not necessarily positive: the V54 cases include a warranty exclusion, no booking, no adoption, no arrangement, no actual missed inspection, and record-scoped non-establishment. In this position, “positive meaning” can reasonably be read as “affirmative content” and encourages the model to demote a selected denial to a qualification or omit it before the category comparison. That conflicts with the consolidated generation rule that polarity travels with the proposition and with the semantic contract's separate polarity obligations.

Use “selected source meaning, including its polarity” (or equivalent) instead. Add one end-to-end framed-verifier fixture whose selected proposition is itself a denial and whose adjacent positive material is unselected; assert the verifier payload/accepted audit keeps the denial as the proposition. This tests behavior at the changed boundary rather than only asserting prompt text.

## Other reviewed boundaries

I found no other concrete acceptance bypass in this round.

- Anchor IDs are deterministic and bound to owner plus full-text fingerprint. Local acceptance checks source-anchor membership against the entry's own evidence record and answer-anchor membership against the current block, so a known foreign-record ID cannot pass merely because it appears in the aggregate schema.
- The relation/null refinement has the intended shape: preserved/generalized/changed require both anchors; omitted requires source and null answer; not_selected requires null answer and permits a source anchor for adjacent unselected material. All-not_selected evidence entries are rejected. Runtime acceptance admits only preserved/not_selected, so generalized/changed/omitted remain negative even if the model returns positive aggregate booleans.
- Missing, duplicate, foreign and stale evidence coverage fail. The independent three booleans and excerpt selection remain conjunctive. `source_context` is free model scratch text, but it is not consumed as authority and cannot itself override a negative relation or gate.
- `answerAuditAnchors` preserves all code-point content and groups rather than truncating above 24 parts. Grouping is contiguous. Sentence/semicolon coordinates remain locations rather than semantic units, and the verifier prompt explicitly requires complete-frame and complete-block interpretation.
- The single-block coordinate construction matches the existing one-verification-call-per-block invariant. Mixed framed/nonframed evidence keeps framed audits for the framed subset while the normal cited evidence and semantic comparison remain available for all cited records.
- Replacing copied quotes with IDs reduces output repetition. The new `source_context` and anchor tables add bounded output/input cost, but source frame text is replaced rather than duplicated, anchors cap at 24 per text, and no call or retry was added. The practical 2,400-token live ceiling remains a finite transport risk for unusually dense multi-record blocks; strict truncation remains fail-closed rather than silently dropping the audit.
- The consolidated generation prompt retains the material boundaries relevant here: original-frame authority, retained-excerpt selection, complete proposition composition, output language, names/values, actor separation, report/fiction/hypothesis/open-question status, unknown clocks, specificity, coverage roles, missing-concept behavior, citation discipline, and no invented provenance event. “One coherent selected proposition” is correctly distinguished from an entire record or sentence.
- The `proposalAgencySupported` extension catches the observed “proposed/suggested action was to” omission while preserving the existing anonymous-source deferral to full verification.
- The report-uncertainty continuation is bounded to a same-subject deictic possible-status clause and retains sentence-end validation. The added positive-confirmation, adversative, retraction and new-speaker negatives cover the meaningful widening risk; semantic verification remains mandatory.

## Finite limits

The 24-anchor grouping and sentence/semicolon segmentation are coordinate heuristics, not proposition parsing. A grouped anchor may contain several independent clauses; correctness still depends on the full-frame/full-block semantic judgment. The new audit improves coordinate integrity but remains a fallible model comparison and should continue to be documented that way.

## Round-1 fix recheck

The finding is resolved. Both private generation readings and verifier `source_context` now require the selected content/source meaning **including its polarity**, removing the affirmative-content ambiguity.

The new framed-denial integration exercises the changed boundary rather than only matching prompt text. It supplies a negated booking proposition beside an independent positive inspection proposal, verifies that the ordered source anchors reconstruct the exact full frame, verifies that answer anchors reconstruct the denial, checks typed `polarity: negated`, marks the actor category not selected because the source denial has no actor, and accepts preserved object/qualification coordinates. The resulting public answer contains the denial and omits the independent proposal; anchor IDs do not leak into the result.

The self-attested regression also remains correct after prompt consolidation: generation input omits the literal internal `self_attested` value, while verifier input and public evidence retain the original typed basis. The conceptual instruction now describes direct-user provenance without exposing the internal label to generation. The test stub's all-message/payload parsing adjustment changes only test dispatch and does not alter runtime behavior.

No further actionable finding in this recheck. I did not independently execute the focused or full suite; this disposition is based on inspection of the revised implementation and tests.
