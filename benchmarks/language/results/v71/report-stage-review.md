# V71 selected report retention-stage review

## Scope

This is a source-first review of only the initial *v20-held-report* retention stage already present in
[bench-results/language-selected-v71-trace.jsonl](../../../../bench-results/language-selected-v71-trace.jsonl),
rows 1–6. The original invented source is
[tmp/language-v20-blind-inputs.json](language-v20-blind-inputs.json), case *v20-held-report*.
I did not inspect fresh held-out cases, make provider calls, modify code, or infer answer/case scores from the
incomplete benchmark. Final typed case diagnostics, retained output bytes, retrieval, and public answers await
the completed report.

## Original source obligations

The complete source establishes two independently useful records:

1. Ada Marlow directly says she has not arranged delivery of her Zephyr QX-100.
2. Ada passes on Bo Winters's account that the agreement permits sending Zephyr QX-100 to the workshop to
   measure the gap at the latch. Her Russian clarification fixes the action as measuring the latch gap rather
   than replacing the latch. Ada has not read the agreement, has not independently checked Bo's account, and
   has not personally verified the relayed meaning. Ada is the outer reporter and Bo the inner reporter; none
   of this establishes completed service or universal nonverification.

The direct no-delivery statement is negated. The principal proposition in the report record is affirmed:
its negative replacement contrast and Ada's negative personal epistemic limits do not make the report's
governing polarity negated.

## Extraction and structural repair

Trace row 2 returns two candidates after a successful language check at row 1:

- Candidate position 0: “Ada Marlow has not arranged delivery of her Zephyr QX-100.” Its supplied metadata
  is polarity “negated”, self-attested, asserted/active, with Ada as speaker. Its support and frame are
  the exact first source item. This is a faithful, independently retrievable personal denial.
- Candidate position 1: a source-report record with Ada as source speaker and Bo as the sole external chain
  member. It retains permission to send the product to the workshop, latch-gap measurement, a negative latch
  action, Ada's relaying role, nonreading, lack of independent checking, and lack of personal verification.
  Its supplied governing polarity is correctly affirmed. Its three exact support/frame spans contain the
  full report, correction, and personal epistemic limits.

The initial report prose says “not to change the latch”, whereas the source clarification says the latch is
not replaced. The subsequent repair changes that phrase to “not to replace the latch”, which is the faithful
action contrast.

Candidate 1 fails the pre-verifier cleaner with the row-4 repair diagnostic:

> the source report has a confirmation or verification limit that was not recognized in a closed readable
> clause

The single repair call is correctly bound to original zero-based candidate_index 1; position 0 appears only
in read_only_admitted_context. The repaired position keeps its source spans, attribution, affirmed polarity,
subject, destination suggestion, report action and personal limits. Its final sentence coordinates the limits
as “she has not read the agreement, independently checked Bo Winters's account, or personally verified this
meaning.” Row 3's language check accepts this repaired prose.

The repair nevertheless does not reach semantic retention verification. Row 5's verifier payload contains
only candidate 0, has no repair obligation, and has no related candidate; row 6 performs ownership only for
candidate 0. Because verifyCandidates would batch both surviving candidates together, this payload boundary
establishes that repaired position 1 was removed by structural cleaning before the verifier. The trace does
not expose a second postrepair diagnostic object, so the exact final typed hold record and whether it repeats
the row-4 diagnostic should be confirmed from the finalized case report rather than inferred from the missing
call.

## Delivery polarity and the new verifier field

Row 5 is the direct V71 polarity evidence. The verifier sees:

- the complete three-item original source;
- the exact no-delivery support and frame;
- candidate prose and immutable supplied polarity “negated”; and
- the self-attested asserted/active qualification.

It returns source_selected_polarity “negated”. Its comparison identifies Ada as the actor, arranging
delivery as the denied operation, and her Zephyr QX-100 as its object. proposition_supported,
action_arguments_preserved, and qualification_scope_preserved are all true, mismatches is empty, and
reason_code is null. Source-first inspection agrees with that classification. Ownership then selects the
existing Zephyr QX-100 page.

Thus the V70 incorrect affirmed metadata does **not** recur: this actual V71 candidate carries negated metadata
and the verifier returns the same source-derived polarity. The new field is exercised on the correct path and
the denial survives. This observation does not demonstrate a live mismatch rejection, because extraction was
already correct; the local V71 tests separately establish that a returned negated value paired with supplied
affirmed metadata is held.

The verifier's positive booleans are not source authority on their own. Here they are consistent with the exact
source, but this single call cannot establish the model's general ability to classify polarity independently
rather than repeat supplied metadata.

## Stage disposition and pending evidence

The delivery denial is faithfully extracted, correctly typed as negated, accepted by the new source-polarity
comparison, and routed. The complete nested report is source-faithful after repair in its main action,
speaker chain, affirmed governing polarity, and explicit personal limits, but it is absent from the semantic
verifier payload after the repair. On the trace available for this bounded review, the retained set therefore
contains the delivery denial while the material report has not survived the retention pipeline.

The finalized benchmark report must supply the authoritative typed candidate outcome, degradation state,
retained-item count and final bytes. Public answer availability, source faithfulness, retention/retrieval
coverage and any case-level score are outside this stage review and remain undecided.
