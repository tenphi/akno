# V77 bounded rubric adjudication — final

This is the final bounded pass over the dispute recorded in `tmp/language-v77-rubric-adjudication-initial.md`, which remains unchanged. After preserving that independent first judgment, I read `tmp/language-v77-full-review-reconciliation.md` and `tmp/language-v77-full-crossreview-reconciliation.md` only for their competing interpretations of held-out relative-unknown-date run 1. I did not inspect either underlying output-review JSON, runtime traces or private verdicts. Both completion gates fail regardless of this ruling.

## Temporal ruling corrected

I withdraw the initial requirement that the public paraphrase repeat the source’s explicit negative clock clause.

The source says:

- “через две недели после этой записи”; and
- “У исходной записи нет даты. Поэтому календарную дату сравнения определить нельзя; две недели отсчитываются от записи, а не от дня обработки.”

The retained text says:

> Ada Marlow proposed comparing the cleaning instructions for Zephyr QX-100 two weeks after the record. The calendar date is unresolved because the record has no date; this is only her proposal, and the meeting is not agreed.

Those two retained temporal statements operate together. “Two weeks after the record” selects the record as the interval’s anchor. “The calendar date is unresolved because the record has no date” identifies that record as the undated original source record. A processing-day interpretation would contradict the stated reason for uncertainty: the processing day is not the undated record whose missing date prevents calendar resolution.

The original “not from the day of processing” clause is an explicit contrast guarding against a known wrong substitution. It is material when a paraphrase says “two weeks from now,” refers only to processing, or leaves the anchor ambiguous. It is semantically redundant once the paraphrase affirmatively and unambiguously selects the undated source record and derives its unresolved calendar date from that same anchor. Meaning preservation does not require exact repetition of a redundant negative.

This differs from omitting a false antecedent, fiction boundary or named reporter. Those clauses determine whether the remaining proposition is actual or whose assertion it is. Here the retained positive anchor and its date explanation already determine the same clock relation as the source’s positive-plus-negative form.

### Corrected case and coordinate judgments

For `v22-held-relative-unknown-date`, run 1:

- `retentionUseful:true`: the one retained unit preserves the actual proposal, cleaning-instruction comparison, two-week offset from the undated source record, unrecoverable calendar date, proposal-only status and no agreed meeting.
- `retainedSourceEntailed:true`, `knowledgeLanguageCompliant:true`, `qualificationPreserved:true`, `unsafeFactualPromotion:false`.
- `usefulQualifiedRetrieval:true` for all eight coordinates. Each retrieves the same complete temporal/proposal unit.
- The seven nonnull answers are useful, source-entailed, language-compliant and qualification-preserving. This includes the six that express the source-record anchor without repeating “not from processing,” as well as `en→ru`, inferred, which states the contrast explicitly.
- `en→ru`, explicit (zero-based query index 3) is the sole null. It is an unjustified writable abstention and not useful, with `sourceEntailed:null`; `qualificationPreserved:true` because it publishes no distorted temporal claim.

I therefore adopt the source grader’s semantic reading for this case rather than the forensic reconciliation’s stricter complete-retention classification. The disagreement was about whether explicit negative wording added meaning after the positive anchor was complete, not about tolerating a processing-clock substitution.

## Fictional-example distinction preserved

My initial judgment for `v22-held-fictional-example`, run 1 remains unchanged and involves a different completeness question.

The original source contains a real-world discourse act—Ada actually introduces an invented example for discussion—and a separate story-scoped loan. The retained set preserves the complete fictional loan and its no-real-agreement scope but does not preserve the actual introduction-for-discussion act. Complete retention is therefore still `retentionUseful:false`. This is omission of a separate useful proposition, with `retainedSourceEntailed:true` and `qualificationPreserved:true`; the retained loan remains explicitly fictional.

The focused query asks **which fictional control-dial loan** Ada introduced. The four explicit-view answers identify that loan completely: fictional Vulpine Mutual, fictional Bo Winters, the spare Zephyr QX-100 control dial, forty-four days after a fictional repair, story-only scope and no real agreement. A direct answer to a “which loan” question need not separately restate the already presupposed act of introducing it for discussion. I therefore continue to grade those four nonnull answers and all eight retrievals as useful and qualified. The four inferred-view nulls remain unjustified coverage losses.

This is consistent with the rubric separation:

- the **complete retained set** must preserve Ada’s separate actual introduction act and fails because it does not;
- the **focused answer** may identify the requested loan without repeating that independent act, provided it preserves the loan’s fictional scope; and
- neither omission turns the fictional loan into a real agreement or changes its qualification.

## Other initial judgments unchanged

- Held-out rejected-plan run 1 retains the complete useful set; all eight focused answers are useful and qualified.
- Held-out rejected-plan run 2 omits the independent no-appointment/no-transport propositions, so complete retention is not useful. That omission is coverage-only with `qualificationPreserved:true`; all eight focused rejected-proposal answers remain useful.
- Held-out counterfactual run 2 retains both actual non-enrollment and the complete unrealized benefit. Its three complete counterfactual answers are useful; nulls are coverage-only, and the inferred Russian non-enrollment answer is source-entailed and qualification-preserving but nonresponsive.
- Empty or partial retention, null answers and accurate nonresponsive subsets do not become qualification errors merely because they omit an entire proposition. Qualification is false only when omission changes the scope or status of content that remains.

## Final disposition

The final temporal classification is complete and qualification-preserving because the retained positive clock relation and its unknown-date explanation jointly encode the excluded processing-clock meaning. The initial stricter classification remains preserved as review history. This correction does not rescue either completion gate and was made from semantic interpretation, not target arithmetic.
