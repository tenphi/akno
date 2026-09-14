# Integration recent run-1 source-first forensics

## Scope and totals

This review compares only recent run 1 for frozen Integration candidate D with Candidate A/V77 on the same source
cases. It uses the final source grades, public packets, and relevant run-1 trace events. It does not inspect recent
run 2, change a grade, or propose another runtime or benchmark iteration.

The final run-1 accounting is:

- Integration: **53/80 useful answer coordinates**, **7/10 complete writable retained sets**, and **4 accepted
  answer errors**.
- V77: **36/80 useful**, **6/10 complete**, and **10 accepted answer errors**: two exact-name changes and eight
  open-question qualification omissions.

The per-case answer deltas fully explain the net gain of 17:

| Case | V77 | Integration | Delta |
| --- | ---: | ---: | ---: |
| Nested report | 0/8 | 5/8 | +5 |
| Conditional hypothesis | 8/8 | 8/8 | 0 |
| Counterfactual | 0/8 | 4/8 | +4 |
| Coverage exclusion | 6/8 | 5/8 | -1 |
| Assistant speculation | 0/8 | 4/8 | +4 |
| Fictional example | 4/8 | 3/8 | -1 |
| Relative unknown date | 8/8 | 8/8 | 0 |
| Competing hypotheses | 2/8 | 0/8 | -2 |
| Open question | 0/8 | 8/8 | +8 |
| Rejected plan | 8/8 | 8/8 | 0 |

The read-only case remains the required eight-coordinate abstention and is excluded from the writable denominator.

## Nested report: report floor recovered, independent fact and three answer paths remain lost

The source contains a coupled nested report and a separate fact:

- Ada relays Bo's account that Vulpine Mutual permits workshop delivery to check grounding-contact resistance,
  specifically not to replace the contact;
- Ada has not seen the rules and has not checked Bo's message; and
- independently, Ada has not packed her device for the check.

### Actual retained path

The integration extraction request at trace row 1817 contains the new retrieval-unit and neutral-activity contracts.
Row 1822 emits one faithful report candidate containing the outer/inner roles, check-versus-replacement contrast, and
both personal limits. It omits the independent not-packed statement.

The direct report concern is unambiguously exercised. The verifier request at row 1823 has no repair obligations and
contains the candidate-owned `report_limit_concern`. At row 1826 it returns a preserved exact source/current report
limit alignment, all three semantic booleans true, and no mismatch. The record is written at row 1835 without a
report-text repair.

This changes V77's complete loss into a usable nested-report record, but the final retained-set grade remains
**incomplete** because no candidate represents the separate packing fact. The retrieval-unit rule correctly says an
independent neighbor remains separate; candidate-scoped report verification cannot create or prove that missing
neighbor.

### Public outcomes

- Coordinates 1–4 retrieve and verify the complete report (public rows 1859, 1874, 1895, and 1910).
- Coordinates 5–6 infer factual view from the Russian query and select no eligible report evidence (rows 1921 and
  1926).
- Coordinate 7 generates a locally valid block, but the answer verifier transport returns `bad_response` at the exact
  1024-token ceiling (rows 1945–1947). It is `verification_unavailable` with
  `answer_verification_failed`, not a semantic rejection.
- Coordinate 8 verifies and publishes at row 1962.

Thus five coordinates are useful, two remain view-routing nulls, and one is unavailable. This is the only recent
run-1 case availability failure; retention itself is available and source bytes remain unchanged.

The report concern is stage-effective. The retrieval-unit prompt is supplied, but this case does not demonstrate
batch completeness: the independent source fact is still absent.

## Assistant speculation: faithful report retained, inferred-view routing still halves coverage

The source is the assistant's tentative guess that Zephyr QX-100 service may include an optical-shutter check every
eleven cycles. It also says the assistant has not read the contract or checked the guess, and establishes neither a
duty nor a device state.

At row 2528 extraction emits one complete source-report candidate with all those limits. The verifier request at row
2529 contains the owned report concern and no repair obligations. Row 2532 returns
`report_limit_alignment:preserved` plus all semantic booleans true; the record is written at row 2541. This avoids
V77's unnecessary report rewrite, which corrupted an already faithful candidate before holding it.

The recovery stops at view routing:

- inferred factual coordinates 1, 2, 5, and 6 return `no_eligible_evidence` without generation (rows 2555, 2560,
  2607, and 2612);
- explicit report coordinates 3, 4, 7, and 8 render the full record and pass verification (rows 2581, 2596, 2633,
  and 2648).

The retained set is now complete and four coordinates are useful. The direct concern path is actually exercised;
the retrieval-unit prose is also present but is not the decision-changing boundary here because V77's initial
assistant record was already a complete semantic unit.

## Open question: retrieval-unit behavior reaches retention, selection, and all answers

The source asks whether annual folding-handle alignment is included, says Ada does not have the answer, and says the
note establishes neither inclusion nor exclusion.

V77 retained the source completely but split it into a question record and a separate asserted no-answer/nonresolution
record. Question-view selection exposed only the first record, so all eight published answers omitted both governing
limits and were source-entailed but qualification-incomplete.

The integration extraction request at row 3038 contains the retrieval-unit contract. Row 3043 emits exactly one
question record containing:

- the open question;
- Ada's personal lack of an answer; and
- the note's separate neither-inclusion-nor-exclusion boundary.

The verifier at row 3047 explicitly compares and accepts both epistemic subjects and all three clauses. The single
record is written at row 3056. Every inferred/explicit and English/Russian coordinate then selects that same complete
record and passes answer verification at public rows 3080–3203. The grade marks all eight useful and error-free.

This is observed end-to-end exercise of the retrieval-unit behavior: the model forms the intended record boundary,
the verifier accepts it, selection cannot separate the governing limits, and complete-record rendering preserves the
whole unit. The paired outcome supports the integration rationale but does not prove that the prompt alone caused the
model's choice or that it generalizes.

## Competing hypotheses: intended metadata appears, but source-relative scope is broadened

The source says Ada is considering two preliminary rattle causes, selected neither, has supporting data for neither,
and that **this record** does not confirm the rattle itself.

Integration extraction at row 2961 forms one tentative record with both alternatives, nonselection, lack of data, and
an `unconfirmed rattling` modifier. This improves the V77 record's asserted qualification and is consistent with the
new embedded-hypothesis instruction. It does not preserve the source-relative epistemic subject: `unconfirmed
rattling` is a global state, while the source says only that this record does not confirm it.

The verifier at row 2965 identifies that exact broadening, returns proposition and qualification negatives with owned
source/current witnesses, and the candidate is held at verification at row 2966. All eight answer coordinates then
return `no_eligible_evidence` (rows 2979–3032). The hold is source-protective; the retrieval-unit prompt reached its
record/metadata target but did not produce publishable qualification prose. This case regresses from V77's two factual-
view answers to zero.

## Other retained-set changes and independent facts

### Counterfactual

Integration writes both the direct non-enrollment and the counterfactual benefit. Extraction at row 2144 initially
gives the counterfactual only its second source item; the one ordinary repair at row 2150 adds the direct non-enrollment
frame without changing the readable proposition. The verifier at row 2154 accepts both records, and both are written
at row 2171. This resolves V77's per-candidate actor false hold and changes the retained set from incomplete to
complete.

Only the four explicit discussion-view coordinates answer. The four inferred coordinates return an empty draft, so
the observed gain is 4/8 rather than 8/8. The frozen four changes did not add a counterfactual-specific rule. This is
an observed stochastic extraction/repair/verifier difference, not a safely attributable effect of report concern,
exact-name enforcement, or prose headings.

### Rejected plan

The focused rejected proposal remains complete and all eight answers remain useful. Extraction still emits the
independent statement that no appointment and no transport were arranged, and retention verification accepts it, but
placement holds it with `routing_uncertain` / `ownership_uncertain` (rows 3214, 3218, and 3231). The complete retained
set therefore remains incomplete. The semantic-unit instruction does not change that destination-ownership boundary.

### Ordinary prose projection

The three V77 ordinary projection failures now report `ordinaryCorrect:true` for nested report, assistant speculation,
and competing hypotheses. That is consistent with the deterministic category-heading fix. It is a separate ordinary
inspection result and does not explain managed retention or answer usefulness.

## Four accepted answer errors

### Coverage exclusion: three errors

Integration retains two source-entailed records: the ceramic-spacer exclusion and a fuller record carrying the
intake-sleeve non-entailment boundaries. All output names preserve exact `Ada Marlow`; V77's two transliterations do not
recur. No trace shows the exact-name guard rejecting a block, so this run demonstrates compliant output, not that the
guard caused the improvement.

Three different answer failures publish:

1. **Coordinate 3, qualification omission.** Generation row 2401 emits two blocks. The exclusion block passes at row
   2405. The separate intake-sleeve-limit block is rejected at row 2409 because it omits Ada as source. The server
   publishes only the surviving exclusion at row 2410, so the answer omits both query-requested intake-sleeve
   boundaries.
2. **Coordinate 4, component change.** Generation row 2424 translates `intake sleeve` as `впускной рукав` (intake
   hose). The verifier at row 2428 incorrectly calls the object/operation preserved, and the error publishes at row
   2429.
3. **Coordinate 8, qualification omission.** Generation row 2508 again emits two blocks. The second changes the
   source's narrow subject from `this exclusion` to `this record`; the verifier correctly rejects that block at row
   2516, while the ceramic-spacer block passes at row 2512. Row 2517 publishes only the surviving block and loses the
   intake-sleeve boundaries.

The first and third failures expose a block-level boundary: rejecting one selected record's block does not prevent a
different true block from publishing as an incomplete answer to a multi-part query. The fourth-coordinate error is a
semantic false acceptance. The retrieval-unit prompt did not reliably prevent the source-coupled material from being
split into separately selectable records in this case.

### Fictional example: one error

The retained fictional loan is complete. Four inferred-view coordinates remain `no_eligible_evidence`, as in V77.
Coordinate 4 translates the spare `control dial` as `пульт управления` (control panel/remote) at row 2722. The verifier
at row 2726 explicitly calls that object preserved, and the answer publishes at row 2727. This is a semantic false
acceptance; exact source-name preservation and fictional qualification do not protect the component meaning.

The other three explicit-view fictional answers are useful, leaving this case at 3/8 rather than V77's 4/8.

## Remaining limits and causal conclusions

The intended changes have mixed but concrete stage evidence:

- **Report concern:** definitely exercised for nested and assistant reports. It preserves their faithful initial text,
  avoids report-only repair, and makes both records writable after the owned mandatory audit.
- **Retrieval unit:** definitely represented end to end for the open question and yields eight complete answers. It
  changes competing-hypothesis metadata as intended but still produces a source-scope error that verification catches.
  It does not restore nested or rejected-plan independent facts.
- **Exact selected source name:** all relevant names remain exact, eliminating V77's two observed name errors, but no
  local rejection in this run proves the guard was the causal mechanism.
- **Prose category headings:** the three prior ordinary projection errors are deterministically corrected, outside the
  managed answer denominator.

The remaining failures include two independent-neighbor retention omissions, report/factual view-routing gaps,
counterfactual empty drafts, fictional eligibility gaps, a sound competing-hypothesis semantic hold, one unavailable
answer-verifier call, two incomplete partial answers, and two accepted component meaning changes. These are not hidden
transport explanations for the successful recoveries. The recent run has one case availability failure and four
accepted answer errors, so the 53/80 usefulness gain is real but does not establish a safety-clean or generally
reliable integration.
