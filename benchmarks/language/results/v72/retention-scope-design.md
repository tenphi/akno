# V72 retention-scope design review

## Scope and conclusion

This review is limited to two source-true retention losses in frozen V72 SHA
`93c7444ff2d860d88649af97db3ccf75bc6c82fd`:

1. the independent no-pickup denial in built `v19-held-rejected`; and
2. the actual discussion of competing tentative hypotheses in built `v19-held-alternatives`.

I compared the invented original sources, exact extraction/repair/verifier payloads in
[`language-built-reliability-v72-trace.jsonl`](../../../../bench-results/language-built-reliability-v72-trace.jsonl),
the source-first forensic evidence, and frozen `tmp/core-v72` (local frozen snapshot). I also considered the related
selected mixed-polarity and optional-reporting-act failures only to assess whether one governing-proposition
clarification is coherent. I did not inspect independent grades or fresh held-out inputs, call a provider, or
edit runtime code.

The two built failures need different treatments:

- The no-pickup record should eventually use a **repair-only typed identity-context selection**. Its exact
  antecedent can be available to the semantic verifier without making a neighboring rejected offer part of
  the denial's local governing frame. A global rejection exception or a generic-device inference is unsafe.
- The hypotheses record supports a smaller next-revision change inside the **existing retention-verifier
  call**: make the server-owned label-scope contract structurally separate from the candidate's untrusted
  fields, require comparison to identify the governing predicate before selecting polarity/scope, and state
  that a verifier may not reinterpret the typed tentative label as syntactically governing the whole string.
  Every negative semantic verdict must continue to hold; this is better elicitation, not an acceptance
  override.

Of these, I would include the narrow existing-call governing/scope correction alongside the planned report
text repair. It caused the entire alternatives record and eight writable answers to disappear and can be
changed without a new pass, retry, cap, public schema, or local grammar exemption. I would defer the no-pickup
repair-protocol change unless the next revision explicitly includes retained-set completeness work: its safe
fix needs a typed repair context rather than another prompt sentence, while its omission did not affect the
focused offer answers in this run.

## Independent no-pickup assertion

### Exact source and failure path

The source has two independent propositions:

> An offer concerned sending Zephyr QX-100 to a laboratory for a rotor-balance measurement. I, Ada Marlow,
> declined that offer; I have no plan to send the device under it.

> No pickup of the device has been booked. The offered shipment was rejected rather than accepted.

The initial extraction at row 75 produces the faithful main rejected-plan record and a separate negated,
asserted, active no-pickup claim. The latter says `Zephyr QX-100` in readable prose, but its only frame is the
second item, which contains only `the device`; the local subject/frame check therefore correctly asks for an
exact antecedent span.

Row 77 repairs original zero-based candidate index 1 to:

> Ada Marlow states that no pickup of Zephyr QX-100 has been booked.

The repair retains the exact deciding denial, adds the exact sentence in the first item that names Zephyr, and
does not turn the denial into the sibling rejected offer. The proposition and its `polarity: negated` metadata
are source-faithful.

The repaired tuple nevertheless has two support spans and two frame spans. Its first frame contains the whole
second item, including `The offered shipment was rejected rather than accepted`; its second frame is the
Zephyr offer sentence used as identity context. Frozen cleaning holds it before semantic verification as
`discourse_uncertain`.

The exact cause is structural. `leadingIndependentDenial` requires `support.length === 1` and
`frame.length === 1`. The repair necessarily has an additional antecedent span, so the exception cannot apply.
The ordinary canonical floor then sees rejection wording in `sourceEvidence(spans.frame)` and treats it as
governing the asserted denial. Row 78 consequently submits only candidate 0 to the verifier.

### Why a wider rejection grammar is not sound

The existing helper deliberately distinguishes a leading booking denial followed by a separately named
offered/proposed action rejection from rejection of the denial itself. It also scans residual complete-source
rejection language conservatively. Simply permitting multiple frames, removing every `reject/decline` token,
or ignoring every admitted sibling would admit cases such as:

- `The denial was rejected.` or `Ada Marlow rejected the denial.`;
- a quoted, hypothetical, questioned, or retracted no-booking proposition;
- an unrelated identifier occurrence attached to `the device`; and
- a second source item that reverses the denial.

Full-source verification is mandatory, but widening the ordinary local floor would remove a useful defense
for all generated denials. The correction should apply only to the failed-position repair whose original
validation issue was missing subject-frame identity.

### Smallest coherent structural design

Keep the public candidate schema unchanged. In the existing repair request, give each missing-identifier target
server-assigned IDs for the bounded exact `source_identifier_context.spans`. Allow the repair to return at most
one private `subject_antecedent_span_id` for that target. Validate all of the following before using it:

- the repair position is exactly the original failed zero-based index;
- the original held candidate's only relevant issue is missing readable/frame identity, rather than a
  qualification, polarity, quotation, or time failure;
- the selected span ID belongs to that target's server-produced allowed set and resolves to unchanged source
  bytes and item ID;
- the repaired `subject` and readable identifier exactly match the selected identifier and its occurrence;
- there is exactly one bounded deciding no-booking support sentence with negated polarity, asserted/active
  discourse, direct user self-attestation, and the existing closed booking-denial grammar; and
- the candidate does not add the antecedent sentence's offer, destination, measurement, rejection, or plan as
  part of the retained proposition.

Treat that selected span as **identity context**, not as a generated claim that coreference is true and not as
governing modal/disposition scope. The server may append the exact span to the private frame supplied to the
semantic verifier, while the local unsafe-scope check evaluates the exact deciding denial frame. The semantic
verifier still receives the complete original source, the complete candidate, the original repair obligation,
and the identity span. It decides whether `device` actually denotes Zephyr and whether another source clause
retracts the denial. A positive selector or a local match never writes the record by itself.

This makes authority explicit:

- server validation proves only source-byte membership, target position, and identifier equality;
- the repair model proposes which allowed antecedent resolves the subject;
- the immutable original source remains semantic authority; and
- all three semantic booleans plus source-selected polarity remain mandatory with no retry.

Do not infer `device = Zephyr QX-100` merely because only one identifier is globally present. Do not
automatically copy the sibling record's frame, disposition, or subject. Do not persist the private span-role as
a user-visible fact. The accepted record's provenance can retain the exact antecedent bytes normally; the
identity-only role is transaction-local data used to reach verification.

Required invented controls include:

- the V72 shape with one exact denial span, one allowed antecedent span, and an independent rejected offer;
- same-item and separate-item retractions of the denial, including passive and active forms, all semantically
  rejected after reaching the verifier;
- two possible product identifiers, a quoted-only identifier, a title/header-only occurrence, and an
  identifier attached to a different device, all held unless the model supplies an unambiguous valid span and
  the verifier confirms it;
- an antecedent span that contains a hypothetical, question, or negation actually governing the device
  identity;
- altered subject, arrangement type, booking polarity, speaker, or item/quote bytes;
- a repair that replaces the denial with the already admitted offer or changes another position;
- a positive and negative semantic verdict after the bounded structural admission, proving no retry and no
  local acceptance override; and
- exact provided/automatic candidates remaining on their existing no-repair/no-new-model contract.

Positive stubs establish position/span plumbing only. They do not prove a live model's coreference judgment.

## Actual discussion of competing tentative hypotheses

### Exact source and failure path

The source explicitly says Ada Marlow is discussing two competing Zephyr fault hypotheses: a slipping drive
belt or a jammed cooling fan. Both are preliminary; neither has supporting evidence; Ada has not selected a
cause. The tentative status belongs to the embedded hypotheses. It does not hedge whether Ada is discussing
them.

Row 113's readable candidate preserves every proposition but initially declares the coupled record asserted.
The local cleaner correctly requests noncanonical metadata. Row 115 repairs the record to `commitment:
tentative` while preserving:

- Ada Marlow's actual `is discussing` activity;
- both named alternatives and their competing/preliminary status;
- lack of supporting evidence for either; and
- Ada's personal nonselection.

Row 116's frame audit accurately interprets both source spans. Its `source_meaning`, `candidate_meaning`, and
`action_arguments` also correctly say that Ada actually discusses the same alternatives. It then returns
`qualification_scope_preserved: false` solely because it treats the candidate's record-level tentative value
as applying to the whole claim, including the discussion act.

That rationale conflicts with the server-supplied `record_scope`, which defines this exact conditional label
semantics: for a coupled asserted discussion/consideration and preliminary unsupported hypotheses, tentative
qualifies the hypotheses rather than whether the act occurred. The record is source-faithful. The verifier
false hold removes the whole retained set and yields eight `no_eligible_evidence` answers.

### Governing-proposition and label-scope correction

Do not override row 116's negative boolean, special-case its prose, change the record to asserted, or split the
hypotheses from their governing evidence/nonselection. Those would weaken the gate or permit the embedded
hypotheses to become factual/current. Do not add a second semantic attempt.

The smallest coherent correction stays in the existing verifier call and preserves the existing response
fields:

1. Move server-generated label definitions out of each untrusted candidate object into a top-level
   `typed_label_contracts` table keyed by the existing candidate ID. Use a closed value describing the
   **conditional application rule**, not a claim about the source—for example
   `tentative_embedded_when_asserted_discussion_is_explicit`. The candidate still carries its actual typed
   `discourse` value.
2. State that this table is authoritative only for what Akno's metadata labels mean. It does not establish that
   the candidate fits the source or that its outer act is asserted. Exact source/frame bytes remain authority
   for those judgments.
3. Require `comparison.source_meaning` and `comparison.candidate_meaning` to identify the governing retained
   predicate before discussing subordinate facts. For the V72 tuple that predicate is Ada's discussion; the
   hypotheses, evidence limits, and nonselection are embedded or coupled restrictions.
4. Emit `source_selected_polarity` only after the frame audit and semantic comparison in provider-visible
   field order. It must classify the governing predicate, not a convenient subordinate denial. This same
   wording addresses the selected V72 decision record where affirmative decline was incorrectly reduced to
   negative nonpurchase.
5. For qualification scope, apply the typed label definition after determining from both source and candidate
   bytes whether the conditional coupled-discussion shape is actually present. If present on both sides,
   tentative metadata does not hedge the discussion. If the candidate says `may be discussing`, changes
   discussion to consideration, loses an alternative/evidence limit/nonselector, or the source merely proposed
   a discussion, return the existing negative relation/boolean and hold it.

The output's comparison, polarity, and booleans remain fallible judgments. The server must never turn an
inconsistent or negative verdict positive from the input contract. The purpose of separating the label table
is to prevent a generated candidate field from appearing to define source truth and to stop the verifier from
inventing a different semantics for a valid typed label.

A new required response enum for `source_scope_application` and `candidate_scope_application` could make the
decision more observable, but it would not make it true; the same model can choose the wrong enum. I would not
add that schema in the first correction unless later evidence shows the reordered existing comparison remains
opaque. The current row 116 already exposes the wrong rationale clearly.

Required controls:

- exact positive coupled discussion with tentative embedded hypotheses;
- source and candidate both explicitly asserting the discussion while keeping alternatives tentative;
- outer activity hedged (`may be discussing`) or denied;
- source only proposing to discuss while candidate claims actual discussion;
- changed activity (`discussing` → privately `considering`) in either direction;
- one alternative asserted as the cause, removed, or changed;
- evidence absence omitted/generalized and personal nonselection omitted or made anonymous;
- an ordinary tentative proposition with no coupled outer act, where tentative still governs the whole
  proposition;
- a hypothetical/fictional embedded proposition and a rejected positive plan, showing their existing label
  semantics are unchanged;
- a mixed-polarity positive main action plus subordinate nonoccurrence, and a genuinely negated main
  proposition, proving `source_selected_polarity` follows the governing predicate in each;
- negative semantic responses remaining held with no repair/retry, and malformed/duplicated verdicts remaining
  atomic failures; and
- wire-order/schema capture through the compiled one- and two-candidate verifier controls.

Stubbed positive controls prove that the contract is carried and gates remain mandatory. Only a later frozen
evaluation can test whether the model applies the distinction reliably.

## Relation to the planned report text repair

The report text repair is a presentation repair before semantic verification. The hypotheses correction is an
interpretation contract inside the already mandatory semantic call. They compose cleanly: both retain exact
source spans, preserve repair positions, and end at the same unchanged three semantic booleans and polarity
equality gate.

Together with the separately bounded undated-clock correction, report and alternatives are the mechanisms
behind 24 of the 29 observed nulls. That makes the hypotheses scope correction materially more relevant to the
next answer-coverage trial than either the no-pickup omission or mixed-polarity decline record, which affect
complete retention but not the focused answers in these probes.

The no-pickup correction is also coherent, but it changes the repair transaction's private structure and
requires careful source-span role validation. Combining all three mechanisms plus the source-clock correction
in one revision would make failure attribution harder. Since V72's no-pickup omission did not affect the
focused offer answers, preserve it as a declared retained-set defect and implement it in a separately reviewed
repair-scope revision unless retention completeness is explicitly part of the next trial.

The shared governing-proposition wording may also reduce two selected false holds without adding separate
exceptions: affirmative decline should remain the main polarity despite subordinate nonpurchase, and an
optional metalinguistic `I describe` frame act should not replace the retained record's selected status as the
governing proposition. Those are supporting consistency checks, not authority to alter their V72 outcomes or
proof that one prompt change will solve model behavior.

## Recommendation

For the next bounded revision, include the report text-only repair and the narrow retention-verifier
governing/label-scope correction above. Keep the source-clock correction separately bounded as already
designed. Do not broaden `leadingIndependentDenial`, change tentative records to asserted, override negative
semantic verdicts, or add a retry.

Preserve the no-pickup loss as an explicit limitation unless the revision also implements the private,
repair-only antecedent selector with exact server-bound spans and complete semantic controls. Another prose
instruction telling the repair model to isolate its frame is not enough: V72 already supplied that instruction,
and the exact repair still mixed identity context with rejection scope.
