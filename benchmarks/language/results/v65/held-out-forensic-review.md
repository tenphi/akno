# V65 fresh held-out forensic review

This is an independent, source-first audit of the first execution of the V20
held-out corpus under frozen V65 `b26c5b8b0386aff8be171593b51299f9c703d64b`.
I read the originals in
[`language-v20-blind-inputs.json`](language-v20-blind-inputs.json) before the
outputs, then compared the finalized
[`language-held-out-v65.json`](held-out.json) and
[`language-held-out-v65-trace.jsonl`](../../../../bench-results/language-held-out-v65-trace.jsonl).
I did not read a grading receipt, change the runtime or corpus, call a provider,
or retry an operation.

Query coordinates below are zero-based. The matrix is `q0` EN→EN implicit,
`q1` EN→RU implicit, `q2` EN→EN explicit, `q3` EN→RU explicit, `q4` RU→EN
implicit, `q5` RU→RU implicit, `q6` RU→EN explicit, and `q7` RU→RU explicit.

## Independent disposition

The report contains 128 non-null answers out of 176 total query rows. Sixteen
of the 48 nulls belong to the two expected read-only admission cases. The
remaining 32 are writable-case abstentions: every one has an answer in its
original source, even when the runtime correctly rejected the particular draft
it saw.

My source-first result is:

| Run | Writable answers | Non-null | Source-faithful and useful | Writable nulls | Accepted source errors | Source-true but incomplete |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 80 | 66 | 62 | 14 | 4 | 0 |
| 2 | 80 | 62 | 54 | 18 | 4 | 4 |
| Total | 160 | 128 | 116 | 32 | 8 | 4 |

The eight accepted errors are all the same Russian coverage-role reversal in
`v20-held-exclusion`. The four additional non-useful non-null answers are run-2
`v20-held-counterfactual` answers that truthfully repeat a refusal but omit the
wheel-hub/fifth-year counterfactual requested by the query. I found no other
definite published source, qualification, factual-promotion, or language error.
The report's `producedAnswers=128/176` therefore overstates useful answer
coverage; production and source usefulness differ here.

The only typed availability case is run 2 `v20-held-hypothesis`, where `q5`
ends `verification_unavailable` with `answer_verification_failed`. Reported
availability is 1/22 case-runs (4.55%), and answer-operation failures are 5/176:
that verifier failure plus four language-generation failures. Every case has
`bytesStable=true`, no case has a retention availability failure, and no source
byte changes are reported. Both model output ceilings were 2,400 tokens; the
unavailable verifier used 916 output tokens, so it did not reach that ceiling.

## Retained-set audit

Sixteen of the twenty writable case-runs preserve the complete material source
set. Three are partial and one is empty:

| Case | Run 1 | Run 2 | Source-first finding |
| --- | --- | --- | --- |
| report | complete: report plus delivery denial | partial: delivery denial only | Run 2 loses the answer-bearing Bo/Ada report. |
| hypothesis | complete | complete | The hypothetical interval, conditional consequence, Ada's unknown requirements, and no actual miss remain together. |
| counterfactual | complete: refusal plus counterfactual | partial: refusal only | Run 2 loses the answer-bearing wheel-hub/fifth-year alternative. |
| question | complete | complete | Ada's unresolved question, no answer, and neither inclusion nor exclusion are retained. |
| exclusion | complete | complete | Both runs retain the plate exclusion, unresolved repair coverage, and limited record scope faithfully. |
| assistant | complete | complete | Assistant attribution, tentative monthly connector test, unread/unverified interpretation, and non-obligation remain together. |
| fiction | complete: proposal plus fictional promise | complete | Real proposal and fictional promise stay distinct and retain the no-real-contract scope. |
| rejected | partial: inspection offer only | complete: offer plus collection denial | Run 1 loses the independent no-carrier-collection statement. |
| undated | complete | complete | Relative source clock, unknown calendar month, proposal status, non-adoption, and no meeting remain together. |
| alternatives | empty | complete | Run 1 loses both tentative alternatives and the asserted nonselection/no-evidence facts. |

At the query level, run 1 still has relevant retained evidence for 9/10 writable
cases; run 2 has it for 8/10. That is different from complete-source retention:
the run-1 rejected record answers the focused inspection-offer query despite its
missing sibling, while the only retained records in run-2 report and
counterfactual do not answer those cases' focused questions.

The run-1 rejected loss is a placement result, not a semantic rejection.
Extraction row 240 and verifier row 241 produce two faithful candidates. The
inspection-offer candidate is placed on the proposed Zephyr page at row 242.
The separately retained prose `Ada Marlow states that no carrier collection has
been arranged` has no product-bound subject or proposed page, so ownership row
243 selects `uncertain`; the report records `ownership_uncertain` at placement.
The focused offer answers remain useful, but the retained set omits this
independent denial.

### Alternatives run 1

Extraction row 315 splits the source into (position 0) the two tentative
hypotheses and (position 1) asserted nonselection/no supporting evidence.
Position 1's deciding frame does not contain the Zephyr antecedent, so the
repair call at row 317 correctly targets original index 1. Its repair joins both
source spans and emits source-complete prose:

> Ada Marlow is considering two competing preliminary hypotheses about the
> Zephyr QX-100 failure—a bent guide or loosened belt fastening—but has selected
> neither cause, and neither hypothesis has supporting evidence.

The repair nevertheless preserves the target's `commitment=asserted` metadata
while expanding its text to include the preliminary hypotheses. The frozen
cleaning reproduction
[`alternatives-run1-cleaning-reproduction.json`](alternatives-run1-cleaning-reproduction.json)
therefore holds the repair as `noncanonical_without_context`: speculative prose
is no longer represented by its typed status. This is a repair-output metadata
error and a correct local hold of that internally inconsistent candidate, not a
semantic false acceptance.

Final retention verifier row 318 receives only the original position-0
hypothesis candidate. It correctly marks `qualification_scope_preserved=false`
because that candidate omitted both nonselection and absence of supporting
evidence. With the repaired position also invalid, nothing is written and all
eight queries return `no_eligible_evidence`.

The smallest structural correction is to keep the two propositions distinct:
repair position 1's frame with the antecedent span while leaving its asserted
nonselection/no-evidence prose and metadata intact. Pulling the tentative sibling
proposition into its text creates a mixed-status record the current type cannot
represent.

### Report run 2

Extraction row 323 produces the report and the independent delivery denial.
The report is initially held for `discourse_uncertain`; repair row 325 adds the
three personal limits in coordinated form:

> Ada Marlow only conveys this account and has not read the agreement,
> independently checked the account, or herself checked this reported meaning.

That is source-faithful, but the bounded absence-of-confirmation grammar still
does not recognize the shared negative auxiliary over this coordination. The
frozen reproduction
[`report-run2-cleaning-reproduction.json`](report-run2-cleaning-reproduction.json)
holds the repaired record with the same `discourse_uncertain` reason. Final
verifier row 326 consequently sees and accepts only the delivery denial, which
is placed at row 327. All eight report queries then have no eligible relevant
evidence. This is a narrow lexical false hold, not provider unavailability or a
semantic rejection.

### Counterfactual run 2

Extraction row 365 has a faithful decision at original position 0 and a
faithful counterfactual at position 1. Position 1 names Zephyr QX-100 in prose,
but its only frame is the Russian second source item, whose `это продление`
depends on the first item's antecedent. Repair row 367 changes a pronoun in the
prose but leaves support and `discourse_frame` confined to that second item.
The source-identifier/frame guard therefore correctly holds it as
`validation_failed`; verifier row 368 receives only the decision.

This is a position-correct repair that fails its stated source-span obligation,
not a wrong index or semantic false hold. The bounded correction is for a
source-attachment repair to add the exact antecedent span to the target's frame,
without changing its proposition or borrowing sibling content into the answer.

## Accepted coverage-role errors

The exclusion source says the warranty does not cover a cracked support plate,
then states that this record does not answer **whether drive-shaft repair is
covered**. Both retained English records preserve that relation. Every Russian
answer instead says:

> `не отвечает ... покрывается ли ремонтом приводного вала`

Instrumental `ремонтом` makes drive-shaft repair the means or coverer and leaves
the covered object unstated. The source-faithful grammar is `покрывается ли
ремонт приводного вала` or the source's nominal `о покрытии ремонта приводного
вала`. These are material object/mechanism errors at:

| Run | Queries | Answer rows | Verifier rows |
| ---: | --- | --- | --- |
| 1 | `q1,q3,q5,q7` | 150, 158, 166, 174 | 151, 159, 167, 175 |
| 2 | `q1,q3,q5,q7` | 440, 448, 456, 464 | 441, 449, 457, 465 |

All eight pass the language checker, local draft guards, and final verifier.
The read-only frozen replay
[`coverage-role-reproduction.json`](coverage-role-reproduction.json)
confirms `coverageRolesSupported` admits all eight exact drafts. At verifier row
151, `object_and_mechanism` anchors and checks only the first cracked-plate
clause. The malformed drive-shaft clause is assigned to `qualification`, whose
detail silently interprets it as faithful. All three booleans and excerpt
selection are true and no mismatch is returned. This division lets a changed
coverage argument evade both comparison categories.

A future correction should compare the grammatical covered subject and
covering instrument inside the same bounded uncertainty clause. It must preserve
the already-supported, genuinely source-matched repair-as-instrument form and
must not infer a covered component from a repair word elsewhere. Because this
fresh corpus is now exposed, any runtime change needs fresh held-out inputs.

## Source-true but incomplete run-2 counterfactual answers

After the counterfactual retention loss, `q0`–`q3` generation rows 371, 373,
375, and 377 correctly return empty blocks and name the missing wheel-hub
alternative. For `q4`–`q7`, rows 380, 384, 388, and 392 instead emit the sole
retained decision, for example:

> **Rejected:** Ada Marlow declined the optional repair extension for Zephyr
> QX-100 and did not purchase it.

Every query asks which unrealized wheel-hub repair alternative Ada described.
The answer omits wheel-hub repair, fifth-year coverage, the purchase condition,
and the distinction from active coverage. It is true as far as it goes, but it
does not answer the question. The generator itself records those omissions in
`missing_concepts`; nevertheless it returns a block. Verifiers 381, 385, 389,
and 393 check the complete retained decision independently of the query and
accept it. This is not an unsupported claim or a verifier source-alignment
error. It is a query-completeness failure at the boundary between the
complete-record rendering branch and its generator-declared missing concepts.

The narrow design issue is that a one-record rendering can publish a known
non-answer after its same-call reading says the requested relation is absent.
A strict `block` versus `missing_concepts` contract for this pilot could prevent
that outcome, but forbidding all partial one-record answers may also suppress
useful partial responses. Any change should be scoped to a missing concept that
is the question's governing actor/predicate/object, rather than treating every
minor missing detail as grounds to withhold.

## All writable null mechanisms

All 32 writable nulls are case-level coverage losses because the originals
support faithful answers. Some individual draft rejections are still correct:

- **Report run 1, `q1` (answer row 14, verifier 15):** the Russian draft adds
  the separate delivery denial while citing only report E1. The verifier
  correctly returns `proposition_supported=false` and
  `selected_by_retained_excerpt=false`. This is a correct bad-draft hold and a
  writable-case abstention.
- **Counterfactual run 1, `q3,q5,q7` (answer rows 93, 98, 103):** all are removed
  locally with `rejection_counts.discourse=1`; no verifier is called. The
  discussion-status floor recognizes explicit `если` but not the otherwise
  conditional Russian forms `в случае покупки ... покрывало бы`, `при покупке
  ... был бы`, or `при котором ... покрывало бы`. Rows 93 and 103 are faithful
  lexical false holds. Row 98 additionally broadens “this was not her active
  coverage” to `действующего покрытия у неё нет`, a claim that she has no active
  coverage at all, so withholding that particular draft is correct even though
  the source case remains answerable.
- **Fiction, both runs, `q1,q3` (language rows 220/225 and 510/515):** each RU
  draft leaves `hinge-pin` untranslated. The language checker returns
  `compliant=false` with `review_tokens=["hinge-pin"]`; generation ends
  `language_mismatch` before publication or semantic verification. These are
  correct bad-language holds and four writable abstentions.
- **Alternatives run 1, all queries:** no eligible evidence after the two
  retention paths described above. These are eight retention-caused
  abstentions.
- **Report run 2, all queries:** only the irrelevant delivery denial survives,
  so all eight return `no_eligible_evidence` after the coordinated-uncertainty
  false hold.
- **Hypothesis run 2, `q5` (answer row 354, verifier row 355):** the draft keeps
  Ada's lack of knowledge and every hypothetical condition, but phrases the
  assumed schedule impersonally rather than saying Ada introduced it. The
  verifier reasonably returns negative proposition/action dimensions. Its
  `object_and_mechanism.relation=omitted`, however, carries a non-null
  `answer_anchor`, violating the alignment schema. The operation therefore
  fails closed as `verification_unavailable`, rather than yielding an ordinary
  negative semantic verdict. The frozen schema replay
  [`hypothesis-verifier-schema-reproduction.json`](hypothesis-verifier-schema-reproduction.json)
  confirms that changing only this anchor to null parses but remains a negative,
  unpublishable verdict. The actual output must not be repaired in place.
- **Counterfactual run 2, `q0`–`q3`:** the generator correctly returns empty
  blocks because only the refusal record remains and it explicitly identifies
  the wheel-hub alternative as missing. These four abstentions originate in the
  retention-frame failure, not answer semantics.
- **Undated run 2, `q1,q5,q7` (answer rows 576, 591, 598):** each faithful RU
  translation is removed locally with `rejection_counts.discourse=1`. The
  source-relative clock floor accepts row 583's `недатированной исходной
  записи`, but `hasSourceRelativeAnchor` does not recognize row 576's
  `первоначальной записи без даты` or rows 591/598's `недатированной
  первоначальной записи`. All still state that the calendar month cannot be
  determined. These are bounded lexical false holds, not changed temporal
  claims.

The sixteen admission nulls are different. In each run, the source-faithful
thirty-three-month warranty candidate passes retention semantics (rows 320/321
and 636/637) and is then held `no_writable_destination` with
`routingReason=read_only_match`. No answer is generated. Those are the expected
read-only safety holds and are excluded from the 160 writable rows above.

## Per-case public-answer assessment

- `report`: the seven run-1 public answers preserve Bo as the source, Ada as
  relay, latch-gap measurement rather than latch change, and all three personal
  limits. Run 2 has no report answers. I did not count run-1 `q3`'s `замены`
  versus the source's `меняется` as a definite defect: in this repair context
  the Russian source can naturally denote replacing the latch, although the
  generated wording is surface-narrower.
- `hypothesis`: fifteen public answers are faithful. They preserve the
  three-month assumption, conditional consequence, Ada's unknown actual
  requirements, and denial of an actual miss.
- `counterfactual`: the five run-1 public answers are faithful. Run 2's four
  public answers are the incomplete decision-only answers described above.
- `question`: all sixteen answers retain Ada's unresolved question and personal
  lack of an answer without broadening this to universal ignorance; inclusion
  and exclusion remain unestablished.
- `exclusion`: the eight English answers are faithful; all eight Russian answers
  carry the coverage-role error.
- `assistant`: all sixteen preserve assistant attribution, tentative/modal
  status, monthly connector-continuity test, unread/unverified interpretation,
  and possible-term rather than obligation scope. A modal `может` plus the
  possible-term/non-obligation clause is sufficient where a separate tentative
  adverb is absent.
- `fiction`: all twelve published answers keep the promise fictional, Bo
  fictional, the eleven-day term, and no-real-contract limit. Four bad RU drafts
  are withheld by language policy.
- `rejected`: all sixteen focused answers identify the pressure-valve visual
  inspection offer, Ada's rejection, and lack of intent. Run 1 additionally
  includes continuing nonacceptance in the selected record; run 2 answers remain
  sufficient for the focused question despite citing only the offer record.
- `undated`: thirteen public answers preserve source-relative next month,
  unknown calendar month, proposal-only status, non-adoption, and no meeting.
  Ordinary past-tense narrative in run 2 does not invent a later endpoint.
- `alternatives`: run 1 has no answers; all eight run-2 answers preserve both
  alternatives, tentative status, Ada's nonselection, and absence of supporting
  evidence.

## Correction made during the live read

An early sequential read briefly treated trace ranges 395–429 and 600–634 as
missing case activity. Inspecting each row's actual source payload shows they
are, respectively, run-2 `question` and run-2 `alternatives`; the finalized
report confirms successful retention and eight answers in each. I retract the
outage inference. The real neighboring boundaries are counterfactual 365–393,
question 395–429, undated 567–598, and alternatives 600–634. No count or finding
above relies on the mistaken boundary inference.

The evidence supports three bounded future areas: preserve antecedent spans
during position-specific retention repair without widening the target
proposition; compare covered-subject versus covering-instrument roles within one
source-matched clause; and make complete-record generation fail closed when its
own declared missing concept is the query's governing proposition. The observed
counterfactual and source-clock lexical false holds can be addressed with
explicit canonical generation language or narrowly equivalent grammar, while
keeping the existing semantic verifier mandatory. None requires a new model
pass, retry, weakened gate, or threshold change.
