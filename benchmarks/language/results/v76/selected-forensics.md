# V76 selected-64 source-first forensics — final

This is an independent review of the eight V21 development cases in
`tmp/v76-selected-forensic-sources.json`. I read those original sources first, then
`tmp/language-selected-output-packet-v76.json`, and preserved that pre-runtime judgment in
`tmp/language-v76-selected-forensics-initial.md`. Only afterward did I inspect
`bench-results/language-selected-v76.json` and
`bench-results/language-selected-v76-trace.jsonl` to localize execution outcomes. Runtime booleans,
private readings and benchmark expectation flags are not source authority.

Coordinates are zero-based within a case:

0. EN query → EN answer, inferred view
1. EN → RU, inferred
2. EN → EN, explicit
3. EN → RU, explicit
4. RU → EN, inferred
5. RU → RU, inferred
6. RU → EN, explicit
7. RU → RU, explicit

## Independent result

- Complete retained sets: **7/8**. Ten of eleven independently separable source propositions were
  retained. The fiction case retained the real discussion proposal but lost the separate fictional
  promise at placement.
- Published answers: **49/64**.
- Source-faithful published prose: **49/49 non-null outputs**. Of these, **48/64** are useful answers
  to their query.
- Source-true but materially incomplete/nonresponsive publication: **1/64**, fiction coordinate 5.
  It faithfully states only the proposal to discuss and omits the promise asked for.
- Writable nulls: **15/64**. The original sources provide a faithful answer at every coordinate.
- Accepted source, qualification, language, polarity, actor, tested-property, or factual-promotion
  errors among the 48 useful outputs: **none found**.
- Typed case availability failures: **1/8**, alternatives only. Answer-operation failures are
  **1/64**. This was a local schema-decoding incompatibility in a private verifier verdict, not a
  transport failure or semantic rejection.
- Source-byte changes: **0/8**, consistent with the finalized execution report.

The benchmark's unreviewed `usefulRetentionCoverage: 8/8` does not match my source-first retained-set
judgment. A true proposal record cannot replace the separately requested fictional promise.

## Case-by-case result

| Case | Retained set | Public result | Source-first disposition |
|---|---|---:|---|
| report | Complete | 8/8 useful | Outer Ada attribution, inner Bo report, workshop measurement rather than latch replacement, Ada's personal no-read/no-independent-check limit, and the separate no-delivery denial are all retained. Focused answers may omit the independent denial. |
| hypothesis | Complete | 8/8 useful | The three-month mesh-screen premise remains hypothetical; the missed-check consequence is conditional on it, and Ada's ignorance/no-actual-miss limits remain explicit. |
| counterfactual | Complete | 7/8 useful; coordinate 5 null | All published answers preserve the unbought-extension antecedent, fifth-year wheel-hub consequence, actual nonpurchase, and no-current-coverage closure. Coordinate 5 is a faithful draft lost to a local discourse floor. |
| exclusion | Complete | 5/8 useful; coordinates 1, 3, 7 null | Published answers keep the cracked support plate excluded and drive-shaft repair unresolved at record scope. The three withheld RU drafts invert the unresolved coverage roles and are soundly held as drafts. |
| assistant | Complete | 5/8 useful; coordinates 3, 5, 7 null | Published outputs preserve a tentative monthly **connector-continuity** test, unread agreement, unverified interpretation, and possible-term/not-obligation scope. The three withheld RU drafts change continuity to generic integrity and are soundly rejected. |
| fiction | **Incomplete** | coordinate 5 published but incomplete; seven nulls | The real proposal/no-real-contract record survives. The Vulpine Mutual → fictional Bo Winters free hinge-pin-replacement promise for the first eleven ownership days is lost at placement. |
| undated | Complete | 8/8 useful | The repaired retained unit explicitly preserves next month relative to the original undated record, excludes processing time, leaves the calendar month unresolved, and keeps proposal/no-plan/no-meeting scope. |
| alternatives | Complete | 7/8 useful; coordinate 6 unavailable | All seven publications and the unavailable draft preserve Ada's actual consideration, both tentative alternatives, absence of support, and her personal nonselection. The unavailable draft was blocked only by an invalid private verifier diagnostic. |

## Exact loss mechanisms

### Counterfactual coordinate 5: source-faithful local false hold

Generation row 501 / call 213 produced:

> Ada Marlow описала нереализованный вариант, при котором при покупке дополнительного расширения
> ремонта ремонт ступицы колеса в пятом году покрывался бы. Она не приобрела это расширение, поэтому
> такое покрытие не являлось её действующим покрытием.

This faithfully expresses the source's unrealized purchase, fifth-year wheel-hub coverage, actual
nonpurchase and lack of current coverage. The report records `draft_rejected` with
`rejection_counts.discourse = 1`; no answer-verifier call follows this draft.

Frozen V76 `hasNominalCounterfactual` returns false for the exact text. Its closed Russian forms do
not recognize `нереализованный вариант, при котором при покупке … покрывался бы …` with this
actual-world closure, while the broad fallback recognizes `контрфактическ` or `если бы`. The other
seven counterfactual answers use an explicit conditional or counterfactual label and pass. Thus the
new V76 nominal/infinitive counterfactual grammar did not positively cover this observed nominal
form; this coordinate remains a finite-grammar false hold.

### Exclusion coordinates 1, 3 and 7: sound local role holds

Generation rows 603 / call 258 and 648 / call 278 both say:

> …эта запись об исключении не отвечает на вопрос о том, покрывается ли ремонтом приводного вала…

Row 719 / call 308 uses the same inversion and appends `гарантией` after the object. Grammatically,
`ремонтом` is instrumental and makes repair the coverer, rather than making drive-shaft repair the
thing whose warranty coverage is unresolved. All three are rejected before verification with
`rejection_counts.semantic_support = 1`.

The faithful coordinate-5 contrast at row 681 says `покрывается ли гарантией ремонт приводного
вала` and is published. This supports the local guard's role distinction. These are writable
case-level nulls because the source has an answer, but the individual bad drafts were correctly
held.

### Assistant coordinates 3, 5 and 7: sound semantic rejections

The three drafts pass local guards, then fail the mandatory verifier:

- coordinate 3: generation row 811 / call 347; verifier row 816 / call 350;
- coordinate 5: generation row 849 / call 363; verifier row 854 / call 366;
- coordinate 7: generation row 887 / call 379; verifier row 892 / call 382.

They render `connector continuity` as `целостность соединителя`, `целостность разъёма`, or a test of
that integrity. Each verifier independently marks the operation/property `generalized`, sets
`proposition_supported = false` and `action_arguments_preserved = false`, and names the lost
continuity property. The original source specifies continuity, not generic physical integrity.

Coordinate 1 publishes `ежемесячную проверку непрерывности соединителя`, which preserves the
specific property. The three rejected drafts otherwise retain the assistant attribution,
tentativeness, personal no-read/no-verification limits and possible-term/not-obligation scope. They
are valid bad-draft holds and still represent writable coverage losses for those coordinates.

### Fiction: the extracted promise loses its source-attached product identity, then loses placement

Extraction row 899 / call 384 emits two distinct candidates:

1. Ada Marlow's real proposal to discuss a fictional case, with no real contract; and
2. the fictional Vulpine Mutual promise to fictional Bo Winters of free hinge-pin replacements for
   the first eleven ownership days.

The second source span begins `In the invented case`; its Zephyr QX-100 identity comes from the prior
span that introduces the invented case as being about that product. The generated candidate keeps the
promise roles, object, duration and fictional scope, but replaces the anaphor with `In Ada Marlow's
invented case` and omits Zephyr QX-100 from **both** its readable prose and its subject
`Vulpine Mutual's fictional promise to Bo Winters`. Its destination `page` is null. The candidate is
therefore not self-contained for the source-established product attachment needed by the query and
destination.

Retention verifier row 904 / call 387 nevertheless accepts both candidates with empty mismatch lists
and all three semantic booleans true. Its private `candidate_meaning` describes the candidate as an
invented **Zephyr QX-100** case even though those bytes are absent from the candidate. That generated
comparison prose is not evidence and cannot repair the omission.

Placement row 914 / call 391 receives only `uncertain` and existing `page_1` as allowed selections.
Its payload contains neither Zephyr QX-100 in the memory text nor the subject, and it does not receive
the private source frames. Selecting the Zephyr page would require reconstructing the omitted
antecedent, so it selects `uncertain`. The report records the candidate as held at `placement` with
`routingReason: ownership_uncertain`. The first proposal candidate, whose text and subject both name
Zephyr QX-100, is placed on the Zephyr page at row 909 / call 389.

With only the proposal retrievable, seven generation calls return no blocks and explicitly list the
missing fictional promise. Coordinate 5 (row 992 / call 423) emits the proposal and lists the promise
as missing. Its verifier at row 997 / call 426 correctly verifies that proposal block against E1,
but the public response is not a useful answer to the promise question. The seven empty drafts are
safe relative to the incomplete retrieved evidence; all eight coordinates reveal a source coverage
loss caused by placement.

### Alternatives coordinate 6: sole availability failure is UTF-16/schema incompatibility

Generation row 1353 / call 575 produces a faithful complete-record draft. Verifier row 1358 / call
578 returns `ok: true`, an empty mismatch list, all three semantic booleans true, and source-faithful
actor, alternatives and qualification comparisons. Its private
`source_alignments[0].qualification.detail` ends with a non-BMP character and is exactly 160 Unicode
code points but 161 JavaScript UTF-16 code units.

Replaying only this returned private alignment through frozen
`tmp/core-v76/dist/ops/answer-source-audit.js` yields one Zod issue:

```text
path: [0, "qualification", "detail"]
code: too_big
maximum: 160
```

There are no `ok: false` transport or model lifecycle records anywhere in the selected trace. The
provider-visible JSON Schema accepted the 160-code-point string, while local Zod `.max(160)` counted
161 UTF-16 units. The report therefore records `verification_unavailable` and
`answer_verification_failed`. This invalid private diagnostic is the sole case-availability and
answer-operation failure; it is neither a semantic rejection nor evidence against the answer.

## V76 clock path

The undated case directly exercises the new repair path:

- extraction row 1028 / call 438 omits only the explicit processing-clock exclusion from otherwise
  faithful readable text;
- rendering/repair row 1033–1036 / call 441 receives an exact owned four-part clock witness and the
  `clock_text_only_with_exclusion` obligation;
- the repair returns four bounded segments, including
  `Processing time is not the reference for next month.`;
- the recomposed candidate is verified at row 1041 / call 444 with both original frame spans, no
  mismatches and all semantic booleans true;
- all eight generated answers pass their local and semantic checks and preserve the exclusion.

This is evidence that the new clock obligation and same structural repair were actually exercised in
the declared run. It does not establish correctness beyond the exact owned source witness and output
forms observed here.

## Runtime and source-authority distinctions

- `verification_rejected` on the three assistant drafts is a valid rejection of materially changed
  generated wording. Those coordinates remain unjustified abstentions at the case level because a
  faithful answer is available from the source.
- `draft_rejected` on the exclusion inversions is also a valid bad-draft hold. Counterfactual
  coordinate 5 is instead a local false hold of faithful wording.
- `empty_draft` in fiction is safe against the retrieved subset, but retrieval is incomplete because
  a source-faithful retained candidate failed placement.
- `verification_unavailable` in alternatives is a typed availability failure caused by private
  schema incompatibility. Positive semantic booleans do not authorize publication, but source-first
  comparison shows the withheld draft itself is faithful.
- The report's `complete` versus `partial` answer labels track its query/view bookkeeping. They are
  not independent completeness judgments. The source-first classification above evaluates whether
  the output answers the original query with all material source qualifications.

## Bounded follow-up supported by this evidence

1. Align provider and local string-length semantics for private audit fields, or constrain provider
   output to a local-safe unit with explicit protocol coverage for non-BMP characters. This should
   remain fail closed and must not treat a schema-invalid verdict as semantic approval.
2. Treat the fiction loss first as an extraction/self-containment defect. When a selected proposition
   uses an anaphor such as `the invented case`, require candidate prose to preserve the exact
   source-attached identity from its validated frame, here `the invented case about Zephyr QX-100`,
   before placement. The subject/page suggestion may follow only that validated readable attachment;
   do not relax ownership or infer a product from generic fiction, the query, or a neighboring
   sibling record.
3. If the counterfactual floor is extended, add only the observed complete nominal unit: explicit
   unrealized label, bounded conditional acquisition and consequence, same actor's nonpurchase, and
   no-current-coverage closure. Keep quotations, retractions and unrelated-clause borrowing negative.
4. The exclusion and assistant holds do not justify relaxing their guards. Generation should emit
   the already demonstrated faithful role order and preserve the named tested property.

These recommendations do not alter the frozen V76 run or its classifications.
