# V64 built-package source-first forensic review

This is an independent evidence audit of frozen V64 commit
`8219179fa4868a54383d87318181bef1bcd84e39`. I read the original source before
the retained records and answers. The evidence is the finalized
[built report](built-reliability.json),
[trace](../../../../bench-results/language-built-reliability-v64-trace.jsonl), and
[source-only packet](language-built-output-packet-v64.json). I did not read an
output-grading receipt, call a provider, or infer source truth from model
readings, verdict explanations, or positive booleans.

## Disposition

V64 retains all seven material records from the four cases and publishes 29 of
32 answers. I find no source, qualification, component, actor, or requested-
language error in those 29 published answers. The three nulls are all
unjustified writable-case abstentions because each source supports a faithful
answer. The runtime nevertheless correctly withholds one materially changed
question draft and one attribution-ambiguous report draft. The remaining report
draft is faithful and is false-held by the bounded attribution grammar.

The report records 29 `answered`, two `draft_rejected`, and one
`verification_rejected`. All four retention operations are `ok`, with no typed
degradation or availability failure. All 32 answer generations complete; all 32
rendering choices are schema-valid; all 38 language checks return
`compliant=true`; and all 30 attempted answer-verifier calls parse successfully.
Twenty-nine verifier calls are wholly positive. Trace row 64 is the sole
semantic-negative verdict. There is no model/schema/transport failure, no
answer-operation failure, and no source-byte change. Each case replays
successfully.

Query labels below are one-based for readability. They correspond to zero-based
report indices 0–7; consequently report q6/q8 and question q6 are indices 5/7
and 5 in the JSON report.

The declared output ceilings are 2,400 tokens for answer and retention roles.
The largest recorded answer generation/verifier output is 780 tokens, and the
largest retention extraction/repair/verifier output is 1,747 tokens. Nothing in
the trace indicates truncation or budget exhaustion.

The complete-record renderer is exercised on every query. It chooses 15 `copy`
and 17 `translate` blocks; all pass the existing language check. The extra
translation count comes from alternatives q5, where the generator validly
chooses an English translation rather than the available copy arm. The private
`report_source_display_phrase` appears in the eight report generation inputs.
It appears in none of the 30 verifier inputs and is never exposed as a field or
instruction in public prose. Every verifier block has
`rendering_scope=complete_retained_record`; the user question is absent from all
30 verifier payloads. Original frame anchors and exact answer anchors remain
present.

## `v18-held-report`

The source has four independently material facts:

1. Bo Winters says the terms permit sending Zephyr QX-100 to a technician for
   dial calibration.
2. Ada Marlow has issued no collection instruction.
3. Ada clarifies in Russian that she is only relaying Bo's words and that the
   permitted operation is regulator calibration, while regulator replacement
   is excluded.
4. Ada has not seen the terms and has not received confirmation of the message.

Trace row 2 extracts two records and row 3 verifies both with all three required
semantic booleans true and no mismatches. The retained report is:

> **Reported by Ada Marlow:** According to Bo Winters, the Zephyr QX-100 service terms permit sending the device to a technician for regulator calibration, not regulator replacement; Ada Marlow has not seen the terms and has not received confirmation of this message.

The independent collection denial is also retained as `Ada Marlow has given no
instruction to collect the Zephyr QX-100.` Thus retention preserves the outer
Ada/inner Bo chain, permission rather than performance, the source-resolved
regulator object, the replacement exclusion, both personal epistemic limits,
and the separate collection denial. There is no repair call for this case.

All eight focused retrievals return the report record as E1. Omitting the
separately retained collection denial from these answers is appropriate for the
question asking for the service report; it is a focused-answer boundary, not a
retained-set loss. English q1/q3/q5/q7 copy the complete record exactly. Russian
q2/q4 translate it completely with the safe outer form `**По словам Ada
Marlow:** Bo Winters сообщил, что ...`; they preserve regulator calibration,
exclude replacement, and retain that Ada did not see the terms and did not
receive confirmation. Their answer/verifier coordinates are rows 12/13 and
20/21. In all six published rows, every source alignment relation is
`preserved`, the three booleans and excerpt selection are true, mismatches are
empty, and `unselected_content` is null.

Report q6 and q8 are the two local attribution holds:

- q6 generation at row 28 says `**Сообщила Ada Marlow:** По словам Bo Winters,
  ...`. The body is complete and source-faithful, and the active heading clearly
  makes Ada the outer reporter. Its preceding language check is compliant, but
  the final report records `passed_guards=0`, `verified_blocks=null`, and
  `rejection_counts.attribution=1`. No semantic-verifier call follows. This is a
  grammar-floor false hold: the bounded checker recognizes the source-before-
  verb form but not this natural clause-initial verb-before-name heading.
- q8 generation at row 35 says `**Сообщено Ada Marlow:** По словам Bo Winters,
  ...`. Its body again preserves all material source content. The impersonal
  heading does not reliably mean “reported by Ada”; with an indeclinable name it
  can be read as reporting *to* Ada and is morphologically incomplete as a
  by-agent construction. The same attribution floor correctly refuses to treat
  that heading as proof of the outer source. This is a correct bad-draft hold,
  while the row remains an unjustified case abstention because the canonical
  `По словам Ada Marlow` rendering was available and succeeded in q2/q4.

The generation-only Russian source phrase therefore helps two of four Russian
report draws but is fallible guidance, as designed. It neither leaks to the
verifier nor creates an accepted attribution error. The smallest supported next
scope is generation wording: insist on the already accepted `По словам SOURCE`
form for this translation branch. Broadening the local reporter parser around
`Сообщено SOURCE` would admit a directionally ambiguous construction. If the
natural active `Сообщила SOURCE:` form is ever admitted structurally, it needs
exact retained-speaker equality, a true clause/label boundary, colon binding,
quote masking, and competing/reversed-reporter controls; that is separate from
the ambiguous impersonal form.

## `v18-held-question`

The source records Ada's unresolved question whether the agreement includes
preventive filter cleaning, then says Ada still has no answer and the note
establishes neither inclusion nor exclusion. Trace row 37 extracts two records
and row 38 verifies both. The retained set consists of the open-question record
and the separate complete no-answer/nonresolution record. The latter has an
affirmed typed polarity because the asserted proposition as a whole is that Ada
has no answer and the note establishes neither alternative; the negative
predicates remain explicit in readable prose. I find no promotion to inclusion,
exclusion, or a resolved state.

All eight focused retrievals return the open-question E1. Seven answers are
faithful: q1/q3/q5/q7 are exact English copies; q2/q4 use the natural Russian
`у Ada Marlow остаётся нерешённым вопрос`; q8 says the same without bold label
markup. The focused responses need not repeat the separate no-answer record to
answer which question Ada recorded.

Question q6 reaches the local guards and then fails the mandatory semantic
verifier:

- row 63 draft: `**Открытый вопрос:** Ada Marlow не может решить, включает ли
  сервисное соглашение Zephyr QX-100 профилактическую чистку фильтра.`
- row 64 aligns `actor=preserved` but marks both
  `object_and_mechanism=changed` and `qualification=changed`. It returns all
  three semantic booleans false, `selected_by_retained_excerpt=false`, and four
  explicit mismatches. The critical distinction in its details is accurate:
  “recorded unresolved question” has become the additional personal predicate
  “Ada cannot decide.”
- The final report accordingly records `passed_guards=1`,
  `verified_blocks=0`, and `rejection_counts.semantic_support=1`.

This is a correct rejection of that draft. It is still an unjustified
writable-case abstention because seven sibling draws demonstrate a faithful
answer from the same retained record. The bounded correction is in generation:
preserve the source's actual epistemic predicate (`has an unresolved question`
or `the question remains unresolved`) instead of substituting a stronger
personal inability. The verifier should remain unchanged for this evidence.

## `v18-held-rejected`

The source says Ada declined an offer to send Zephyr QX-100 to the service
centre for thermostat measurement, has no plan to send it under that offer, no
handover is booked, and the offered shipment was rejected rather than accepted.

Trace row 74 extracts position 0 as the complete rejected offer/no-plan record.
Its position 1 candidate combines the no-booking and rejection sentences under
`commitment=asserted`; the local validation marks that position
`discourse_uncertain`. The single repair call at row 76 is correctly bound to
`candidate_index=1`; position 0 appears only in
`read_only_admitted_context`. Repair position 1 becomes `Ada Marlow states that
no handover of Zephyr QX-100 has been booked`, using both the preceding
Zephyr/offer frame and the exact no-booking sentence. Row 77 verifies both final
positions with no mismatches and all semantic booleans true. The repair neither
duplicates nor replaces the admitted sibling.

The resulting two-record retained set is complete at the useful proposition
level: E1 preserves rejection, actor, device, destination, thermostat-
measurement purpose, and no plan under the offer; E2 preserves the independent
no-booking fact. The phrase “offered shipment was rejected, not accepted” is
not repeated in E2, but its disposition is already expressed completely in E1
as Ada declining that same offered shipment. No acceptance, booking, shipment,
or performed measurement is introduced.

All eight focused answers cite E1 and accurately repeat its complete record.
The Russian translations keep Ada as the declining actor, service centre as the
destination, thermostat measurement as the purpose, and `не планирует ... по/в
рамках этого предложения`. The answers omit separately retained E2 because the
query asks which offer Ada declined, not whether a handover was booked. All
eight guards and verifier calls pass, with every source alignment and required
boolean positive. I find no accepted semantic or language error.

## `v18-held-alternatives`

The Russian source names two competing hypotheses: a loosely inserted internal
connector or a faulty temperature probe. Both remain assumptions, evidence is
absent for both, and Ada selected neither cause.

Trace row 113 initially extracts the complete proposition but types it
`commitment=asserted`; validation reports
`noncanonical_without_context`. Row 115 repairs exactly
`candidate_index=0`, changing the commitment to `tentative` while preserving
the connector's specific insertion relation, the faulty-probe alternative,
shared absence of evidence, and Ada's personal nonselection. Row 116 verifies
the repaired position with no mismatch and all booleans true. One complete
record is retained.

All eight answers reproduce that entire record. English outputs preserve
`loosely inserted internal connector`; Russian outputs preserve `неплотно
вставленный внутренний разъём`, rather than weakening it to a generic connector
problem. Every output keeps the alternatives disjunctive, both hypothetical,
the evidence absence shared across both, and Ada as the person who selected
neither. All guards and semantic verdicts pass. There is no accepted promotion,
component substitution, or qualification loss.

## Scope of the conclusions

The 29 accepted blocks all cite one E1 and all material propositions in that
selected complete record are present. The audit does not treat positive model
readings or verdict prose as authority; those fields corroborate control flow
only after comparison with the original bytes. It also does not infer that V64
prompt changes caused a model outcome. The trace establishes that the source
display hint reached generation, did not reach verification, and was followed
in two of four Russian report generations. It does not establish why the other
two generations chose different headings.

No structural retention, placement, retrieval, schema, language-check, byte,
or provider-availability defect appears in this four-case run. The bounded
remaining evidence supports two generation corrections: use an unambiguous
source-before-predicate Russian outer attribution, and preserve “unresolved
question” as that predicate rather than rewriting it as personal inability.
Neither observation supports weakening the existing semantic verifier, adding
a retry, or accepting the ambiguous `Сообщено Ada Marlow` form.
