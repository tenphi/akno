# V65 built-package source-first forensic review

This is an independent audit of frozen V65 commit
`b26c5b8b0386aff8be171593b51299f9c703d64b`. I compared the original source
first, then the retained records and public answers in the finalized
[report](built-reliability.json),
[trace](../../../../bench-results/language-built-reliability-v65-trace.jsonl), and
[source-only packet](language-built-output-packet-v65.json). I did not read an
output-grading receipt, call a provider, or treat private readings, audit prose,
or supplied positive booleans as source authority.

Query indices in this note are the zero-based indices 0–7 used by the report.

## Overall disposition

V65 retains all seven material records across the four cases and publishes 31
of 32 answers. I find no definite source, actor, qualification, component,
mechanism, or requested-language error in the 31 public answers. Report query 6
is the sole null. Its generated answer is an exact faithful copy of the retained
record, but the semantic verifier incorrectly reconstructs the already-resolved
bilingual calibration referent as a conflict. It is therefore a false hold and
an unjustified writable-case abstention.

The final report records 31 `answered` and one `verification_rejected`. All four
retention operations are `ok`, all seven candidates are written, and none uses
repair. All 32 rendering choices are schema-valid (16 copy, 16 translate), all
36 language checks are successful and compliant, all 32 answer generations and
all 32 verifier transports complete, and 31 verifier verdicts are wholly
positive. Trace row 33 is the sole negative verdict. There is no typed
degradation, model/schema/transport failure, answer-operation failure, case
availability failure, or source-byte change. Every case replays successfully.

The configured evaluation ceilings are 2,400 tokens for answer and retention.
The largest observed answer generation/verifier output is 921 tokens, and the
largest retention extraction/verifier output is 1,633 tokens. No trace result
shows truncation or budget exhaustion.

All 32 queries retrieve one focused E1 record. This is complete for the asked
report, question, rejected offer, or hypothesis pair. Report, question, and
rejected each also retain a second independent record that is not repeated in
the focused answer. Those omissions are selection boundaries, not retained-set
losses.

## `v18-held-report`

The original source establishes:

1. Bo Winters says the service terms permit sending Zephyr QX-100 to a
   technician for dial calibration.
2. Ada Marlow gave no instruction to collect it.
3. Ada's Russian restatement says she is relaying only Bo's words and clarifies
   the operation as regulator calibration, while excluding regulator
   replacement.
4. Ada has not seen the terms and has not received confirmation of the message.

Trace row 2 extracts two candidates without repair. Row 3 verifies both with no
mismatches and all three dimensions true. The report record says:

> **Reported by Ada Marlow:** Ada Marlow reports only Bo Winters’s words: the Zephyr QX-100 service terms permit sending the device to a technician for regulator calibration, not regulator replacement; she has not seen the terms themselves or received confirmation of this message.

The sibling says `Ada Marlow states that she gave no instruction to collect the
Zephyr QX-100 device.` This retained set preserves the Ada/Bo reporting chain,
permission rather than performance, the regulator calibration/replacement
contrast, Ada's two personal limits, and the independent collection denial.
The report is stored under the service-terms entity; the collection-denial
record's final subject is unresolved, but the record itself remains written and
source-faithful.

Queries 0–5 and 7 publish faithful complete-record answers. English queries
0/2/4 copy E1. Russian queries 1/5/7 use the unambiguous outer heading `По
словам Ada Marlow`, then explicitly say Ada relays Bo's words. Query 3 uses the
awkward heading `Сообщено Ada Marlow`, which in isolation can be read as
reporting *to* Ada. Its immediately following clause says `Ada Marlow сообщает
только слова Bo Winters`, explicitly restoring Ada as outer relayer and Bo as
the inner source. I preserve the heading ambiguity as a language-quality
concern, but do not classify the complete public proposition as an attribution
error. Local guards and row 21's full-source verdict accept it. All seven
published report answers preserve regulator calibration, exclude replacement,
and keep both Ada-specific limits.

Some private generation notes are imperfect but do not alter the public answer:
query 0 lists “a specifically dial-calibration service report” in
`missing_concepts`, while the exact copied record correctly applies the Russian
source clarification. Other runs leave that field empty or use similarly
fallible explanatory wording. These private notes are neither published text
nor verification authority.

### Query 6 false hold

The exact path is:

- row 32 generates the exact English complete-record copy above, with a private
  reading that correctly says the original frame clarifies regulator
  calibration and excludes replacement;
- local guards pass;
- row 33's own `source_context` and `comparison.source_meaning` also describe
  regulator calibration rather than replacement;
- despite that reading, `object_and_mechanism.relation=changed` claims that the
  answer's regulator conflicts with the earlier dial wording;
- `proposition_supported=false` and
  `action_arguments_preserved=false`, with `qualification_scope_preserved=true`
  and `selected_by_retained_excerpt=true`.

The two mismatches repeat the supposed dial/regulator change. They ignore frame
anchor `E1_da7fc5167671_4`, which explicitly states in Russian that regulator
calibration is permitted and replacement is excluded. This is an internally
inconsistent semantic false hold, not evidence of an answer defect. The final
row has `generated_blocks=1`, `passed_guards=1`, `verified_blocks=0`, and
`rejection_counts.semantic_support=1`.

The smallest evidence-supported correction remains verifier guidance about
source-explicit cross-language clarification and internal consistency. It
should compare the complete ordered frame and must not turn an earlier query or
source term into an unresolved alternative after the source resolves it. The
failure does not justify relaxing the three booleans, excerpt selection, or any
negative verdict.

## `v18-held-question`

The source records Ada's unresolved question whether the service agreement
includes preventive filter cleaning. Ada still has no answer, and the note
establishes neither inclusion nor exclusion.

Trace row 39 extracts two records without repair; row 40 verifies both. E1 is
Ada's open question. The sibling explicitly retains Ada's lack of an answer and
the note-level nonresolution of both alternatives. Its affirmed polarity types
the whole asserted proposition containing the negative predicates; readable
prose does not promote either coverage result.

All queries 0–7 retrieve E1 and publish a faithful complete rendering. English
rows 45/53/61/69 copy it. Russian rows 49/57 say `нерешённый вопрос Ada Marlow`,
and rows 65/73 use the synonymous `неразрешённый вопрос Ada Marlow`. Each keeps
Ada as the question owner, names the agreement and preventive filter cleaning,
and asserts no answer. All eight verifier rows 46/50/54/58/62/66/70/74 return
preserved actor, object/mechanism, and qualification, all three booleans true,
selection true, and no mismatches. Omitting the separate no-answer record from
the focused response does not change the selected open question.

## `v18-held-rejected`

The source says Ada declined an offer to send Zephyr QX-100 to the service
centre for thermostat measurement, has no plan to send it under that offer, no
handover was booked, and the offered shipment was rejected rather than
accepted.

Trace row 76 extracts both final records correctly on the first call:

- position 0 is an asserted, rejected plan containing Ada's decline, the
  device, destination, thermostat-measurement purpose, and no plan under the
  offer;
- position 1 is a negated event, `No handover of Zephyr QX-100 has been
  booked`, with the preceding named-device sentence and the exact booking
  denial as its two source spans.

Row 77 verifies both without mismatches. It treats the preceding source span as
identity context rather than as proof of booking or performance. There is no
repair call, position substitution, or sibling duplication. The explicit
source sentence that the offered shipment was rejected rather than accepted is
materially represented by E1's `declined an offer` and rejected disposition,
while E2 independently preserves no booking.

Queries 0–7 retrieve E1 and publish its complete record at rows
82/86/90/94/98/102/106/110. The Russian outputs preserve Ada as the declining
actor, service centre as destination, thermostat measurement as purpose, and
the scoped absence of a plan `в рамках этого предложения`. Query 7's
`измерения параметров термостата` is a natural rendering of thermostat
measurement and supplies no result, method, or specific unstated property.
Every corresponding verifier row 83–111 is fully positive. The focused answer
does not need the separately retained no-booking record to identify the offer
Ada declined.

## `v18-held-alternatives`

The Russian source says Ada considers two competing hypotheses: a loosely
inserted internal connector or a faulty temperature probe. Both remain
assumptions, neither has evidence, and Ada selected neither cause.

Trace row 113 extracts one complete tentative record on the first call. It
preserves the connector's insertion relation, the faulty-probe alternative,
shared evidence absence, and Ada's personal nonselection. Row 114 verifies it
without mismatch. No repair is needed.

All queries 0–7 retrieve and publish that complete record at rows
118/122/126/130/134/138/142/146. English copies say `loosely inserted internal
connector`; Russian translations retain `неплотно вставленный внутренний
разъём`. Every answer keeps the alternatives disjunctive and tentative, applies
the absence of evidence to both, and keeps Ada as the person who selected
neither. All verifier rows 119–147 are fully positive. I find no factual
promotion, generic-component substitution, actor loss, or qualification loss.

## V65-specific scope and private audit quality

This built corpus does not contain the V65 motivating `unknown to us` group
predicate, so it supplies no live evidence about the new group-experiencer
instruction. It does preserve all personal epistemic subjects that are present:
Ada has not seen the terms or received confirmation, Ada still has no answer,
and Ada selected neither cause. None becomes bare or global absence.

The corpus also does not exercise the motivating product-named exclusion-record
versus generic motor-repair attachment. The retained report's service-terms
subject and the rejected case's Zephyr handover antecedent are source-supported,
but they do not validate the new record/component distinction generally.

Several private verifier `source_context` strings contain truncated phrases,
stray non-English characters, or invisible characters. They remain schema-
valid bounded notes and are not exposed publicly. For positive rows I accepted
only meanings independently confirmed against the original source, not those
narratives or booleans. Row 33 shows why that distinction matters: its private
source reading is substantially correct while its final relation and booleans
contradict the explicit clarification.

No structural retention, placement, retrieval, renderer, language-check,
schema, provider, or byte-integrity defect appears in these four cases. The
only observed coverage loss is the single report semantic false hold, and no
published error accompanies it.
