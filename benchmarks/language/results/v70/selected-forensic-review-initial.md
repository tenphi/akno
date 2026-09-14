# V70 selected source-build forensic review

Scope: the sole frozen selected run on `1ceb557224602d132bb3c5944c2ac81ac7d2a696`, `tmp/language-selected-output-packet-v70.json`, `bench-results/language-selected-v70.json`, and its 270-row trace. I read original source meanings before runtime verdicts. I did not inspect an independent grade, fresh held-out source, private configuration/KB data, call a provider, rerun a probe, edit runtime, or write GitHub state.

## Result

- Complete source-faithful retained sets: **8/8**.
- Published answers: **54/64**.
- Fully source-faithful and complete for the focused query under this audit: **51/64**.
- Accepted material errors: **3**, fiction q0/q2/q4. They preserve the fictional promise but replace Ada's proposal-to-discuss action with neutral `According to Ada` attribution. They do not promote the fiction to reality.
- Nulls: **10/64**: counterfactual 3, exclusion 1, fiction 2, undated 4.
- Faithful-draft false holds: **7**: counterfactual q3/q5/q7 and undated q1/q3/q5/q7.
- Correct bad-draft/language/semantic holds: **3**: exclusion q5, fiction q3 and fiction q5.
- Case availability failures: **0/8**. One reported answer-operation failure is the explicit fiction language mismatch, not schema/cap/provider unavailability.
- Accepted wrong-language output, unsupported factual promotion, source-byte mutation, or tested-property loss: **0 observed**. Source bytes are stable in all eight cases.

The runtime's 8/8 useful-retention and retrieval flags are consistent with complete final retained sets here, but the source comparison above does not derive correctness from those flags or from positive verifier booleans.

Query indices are zero-based: EN→EN inferred, EN→RU inferred, EN→EN explicit, EN→RU explicit, RU→EN inferred, RU→RU inferred, RU→EN explicit, RU→RU explicit.

## Case audit

### `v20-held-report` — trace rows 1–38

Both required records survive in the initial extraction: Ada's separate no-delivery-arrangement denial and the main qualified report. The main record keeps Bo as embedded reporter; Ada as relay; permission to send Zephyr QX-100 to the workshop; latch-gap measurement rather than latch change; Ada's unread-agreement limit; and her lack of independent checking. These are short complete sentences in one record, with correct asserted/source-report metadata. No repair is needed.

All q0–q7 cite the main record at `memory/equipment:9`, not the unrelated denial. English copies and Russian translations preserve the exact actor chain, permission rather than completed action, measured gap, no-change contrast, personal reading/checking limits and relay scope. `независимо не проверяла сообщение Bo Winters` is awkward but preserves the performed-check predicate in this selected source. Eight answers are useful and source-faithful.

### `v20-held-hypothesis` — trace rows 39–74

The retained record completely preserves Ada's hypothetical three-month mesh-screen assumption, the violation consequence only under that assumption, Ada's lack of knowledge of actual requirements, and the denial that this is a report of a real missed check. Typed commitment is hypothetical; the actual consideration/introduction remains an asserted source act.

All eight answers preserve conditional scope, the three-month interval, screen object, assumed-rule consequence, Ada as the personal epistemic subject and the real-event denial. No answer promotes the assumption to an actual requirement. All are useful and faithful.

### `v20-held-counterfactual` — trace rows 75–102

The initial rejection/nonpurchase candidate is admitted. The initial counterfactual candidate's deciding frame lacks the identifier-bearing antecedent, so the one repair at row 77 adds the exact first source span while keeping its original index and proposition. The verifier sees the repair obligation and full original source; both final records are faithful and routed to the Zephyr page. Final retention is complete.

Published q0/q1/q2/q4/q6 preserve Ada as conditional purchaser, the optional extension, fifth-year wheel-hub repair consequence, actual nonpurchase, unrealized status and absence of actual/current coverage. q1's `дополнительное ремонтное продление` is stylistically awkward but retains an optional repair extension. All five are source-faithful.

q3/q5/q7 are held locally as `discourse`, before the answer verifier:

- q3 row 91: `нереализованной альтернативой была покупка ... в этом контрфактическом сценарии ... был бы покрыт`, followed by explicit nonpurchase/no-actual-coverage;
- q5 row 96: `нереализованный вариант состоял в том, что при покупке ... был бы покрыт`, again followed by nonpurchase/no-actual-coverage;
- q7 row 101: `нереализованный вариант заключался в том, что приобретённое ... покрыло бы ...`, with a following explicit statement that she did not purchase it.

In each complete sentence, purchase remains inside an explicitly unrealized/conditional world and the consequence is subjunctive; actual nonpurchase and no actual coverage are explicit. I find all three materially faithful. They do not follow the generation instruction's preferred `если бы` presentation and remain outside the deterministic floor. These are false local holds, not semantic negatives. This evidence supports stronger bounded rendering compliance rather than adding each nominal introduction to the grammar.

### `v20-held-exclusion` — trace rows 103–137

The retained record is complete: cracked support plate is excluded; drive-shaft-repair coverage remains unresolved at the record level; and the source does not assert whole-contract silence.

q0–q4/q6/q7 preserve all three meanings. The Russian q1/q3/q7 correctly use repair as the covered service (`покрывается ли ремонт`, with q7 explicitly naming warranty as coverer). No output converts unresolved coverage into exclusion or whole-contract silence.

q5 row 128 says `покрывается ли ремонтом приводного вала`, making repair the covering instrument rather than the covered object. Its local `semantic_support` hold is justified. The source was adequate, so it remains an answer-coverage loss.

### `v20-held-assistant` — trace rows 138–173

Retention is complete. All q0–q7 preserve the assistant as tentative epistemic subject, monthly connector continuity as the tested property, unread service agreement, unverified interpretation, possible contractual term and not-established-obligation scope. Russian outputs use `непрерывность соединения/соединителя/цепи разъёма` or `тест непрерывности`; none substitutes generic integrity. The separate tested-property audit therefore has the correct public result in all eight observations. No answer establishes a real service obligation.

### `v20-held-fiction` — trace rows 174–201

Both records survive: Ada's proposal to discuss a fictional case with no real contract, and the fictional Vulpine Mutual promise to fictional Bo of free hinge-pin replacements during the first eleven ownership days.

q1/q6/q7 cite both records and preserve Ada as proposal actor, the promise actor/recipient/content/period, fictional scope and absence of a real contract. q0/q2/q4 cite only the promise record and say `According to Ada Marlow, in the fictional case ...`. They preserve the promise content and fictional scope, but neutral attribution is not the source action that Ada proposed discussing the promise. Because that relation is material to the focused query, I classify these three published answers as role/qualification omissions. They add no real-world promise.

q3 fails ModelClient language review at row 188 because its otherwise Russian draft leaves ordinary `hinge-pin` untranslated. This is a justified language-policy hold, not provider failure.

q5 row 193 preserves Ada's proposal, promise content and fictional scope but omits the proposal record's explicit no-real-contract clause. The answer verifier at row 194 gives E1 qualification `omitted`, `answer_anchor:null`, sets proposition/qualification false with matching mismatches, and rejects the block. Under complete-record rendering this is a valid semantic hold. The source was adequate, so it is still a useful-answer coverage loss.

### `v20-held-undated` — trace rows 202–233

Retention is complete. The record preserves Ada's proposal to review repair terms next month, no accepted plan, no organized meeting, proposal-only status, month-after-original-record anchor, processing-time contrast, unknown recording date and unknowable calendar month.

The four English copies q0/q2/q4/q6 are complete and faithful. All four Russian drafts q1/q3/q5/q7 are also source-faithful. At rows 211/218/225/232 each says, with minor word-order variation, that `«следующий месяц» означает месяц после первоначальной записи, а не после обработки`, states that the record date is unknown and calendar month cannot be determined, and preserves no-plan/no-meeting/proposal-only clauses.

Frozen `tmp/core-v70` replay returns `hasSourceRelativeAnchor:false` and `hasUnknownReferenceClock:true` for the exact q1/q3 forms. Thus the relative-clock grammar rejects the faithful `означает месяц после первоначальной записи` construction even though direction, anchor and processing contrast are explicit. All four `discourse` holds are false local holds. The new generation instruction proposed an `отсчитывается` shape, but the model instead produced a different complete ordinary construction.

### `v20-held-alternatives` — trace rows 234–270

Initial extraction preserves the readable content but marks commitment asserted. The one repair changes only commitment to tentative and repeats Ada explicitly as nonselector. The verifier receives the original candidate as a repair obligation and the complete source. Final retention correctly represents actual consideration activity with tentative hypotheses, neither supported and neither selected by Ada.

All q0–q7 preserve Ada as considering actor and personal nonselector, bent guide and loosened belt attachment as the two alternatives, preliminary status and absence of evidence. No answer treats either as an established cause. All eight are useful and faithful.

## Availability, schema, capacity and source stability

No retention or case availability failure occurs. All final retained candidates pass the existing original-source verifier and placement. The one `generation_failed` answer is an explicit language mismatch with a preserved raw draft; it is not a malformed schema, cap exhaustion, or provider transport failure. The one `verification_rejected` answer is a valid structured negative verdict, not unavailable. The eight local `draft_rejected` results are deterministic guard outcomes.

The new property schema transports and parses in the live run. Positive property-bearing assistant answers and property-not-selected ordinary records proceed through the same mandatory selection and three semantic booleans. This observation does not prove the model will always classify properties correctly. No trace shows a 2,400-token answer cap exhaustion or truncated JSON. The unchanged service 1,024-token overlay remains outside this probe evidence. All eight source-byte checks are stable.

## Smallest justified next scope

1. Keep the V70 multi-sentence retention presentation: it resolves both report retained-set losses here without weakening the guard or verifier.
2. For qualified Russian answer rendering, make the existing preferred templates more structurally binding within the same generation call: explicit `если бы` antecedent/consequence/nonoccurrence for counterfactuals and a single recognized source-clock construction for undated records. The local floors should remain conservative fallbacks. Do not enumerate the observed nominal and `означает месяц после` surfaces without separately closed grammar designs.
3. Preserve the active Russian coverage guidance; q5 demonstrates that the instrumental-role error remains real and should be held.
4. For fiction-focused queries that select the relationship between an actual proposal and the fictional promise, require composition to select/cite both records and retain Ada as proposal actor. Neutral source attribution cannot substitute for that action. Keep complete-record qualification enforcement, as row 194 correctly rejects loss of the no-real-contract clause.
5. Keep the tested-property schema and its existing semantic gates. V70 removes the observed continuity/integrity accepted error without a dictionary or extra pass; future evidence must still judge the property relation independently.

These findings do not justify a new semantic pass, retry, cap increase, source-authority change, automatic citation insertion, or weaker language/local/semantic gate.
