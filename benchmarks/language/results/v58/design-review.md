# V58 bounded design review

## Conclusion

The four proposed changes form a coherent, bounded V58. The booking and subject-identifier changes are rejection/repair gates over generated retention; neither can establish source truth. The insertion and collective-selection changes are prompt clarifications inside the existing extraction, generation, and verifier calls. No public schema, model, pass, retry, routing shortcut, output ceiling, or threshold needs to change.

The two deterministic changes should be implemented independently. The booking exception repairs a false activation in `hasAffirmedBooking`; the identifier rule prevents a generated record from using source-wide identity only in private metadata. Combining either with a broader pronoun, temporal, or ownership inference would exceed the evidence.

## 1. Negative booking with a quoted alias appositive

### Observed mechanism

V57 extraction generated this source-faithful candidate:

> Ada Marlow states that no handover of Zephyr QX-100, referred to as “the device,” has been booked.

`hasAffirmedBooking` finds `has been booked`. Its existing negative-subject prefix recognizes `no handover of Zephyr QX-100`, but the comma-delimited alias prevents that prefix from reaching the auxiliary. The candidate is consequently held as `time_unresolved` even though it asserts absence. The repair call then returns another admitted candidate in the booking position; positional validation correctly rejects that duplicate as `derive_failed`. Removing only the alias appositive admits the actual candidate, so there is no demonstrated later frame-floor obstruction.

### Smallest sound form

Keep the change inside `hasAffirmedBooking`. Before testing the matched booking auxiliary, allow one optional alias appositive only when it is:

1. immediately after the current negative subject/object phrase;
2. exactly comma-delimited on both sides;
3. introduced by `referred to as`;
4. followed immediately by the matched `is/was/has been ... booked` auxiliary apart from whitespace; and
5. a bounded quoted generic alias with no newline, clause punctuation, connective, finite verb, or nested quote.

A small generic-noun form such as quoted `the device`, `the unit`, `the item`, or `the product` is safer than arbitrary quoted prose. It captures the appositive shape rather than this one product name. The existing negative booking-noun and optional `of/for/with` tail remain authoritative. An equivalent implementation may mask the one exact appositive before applying the existing negative-subject regex; it must not remove every `referred to as` phrase globally.

The exception only prevents a false *affirmed-booking* classification. It does not approve the candidate. Exact support/frame validation, source qualification, semantic verification, repair-position integrity, and routing still run. An actual later booking in the same or a later clause must continue to require a time envelope.

Meaningful tests are:

- the V57 structural shape with smart double quotes and invented values;
- the same bounded appositive under straight double quotes and, if the helper supports them, guillemets/smart single quotes;
- an actual booking after the negative clause, both before and after the alias form;
- missing closing comma, unquoted alias, alias containing `has been booked`, a connective, punctuation, or a newline;
- a comma-separated `referred to as` clause that is not immediately attached to the negative subject;
- one `runRetain` integration in which the structurally admitted candidate still passes or fails according to the existing semantic verdict.

This design is preferable to exempting all text beginning with `no`, stripping arbitrary appositives, or inferring a negated time envelope.

## 2. Generated subject identifiers across complete source and deciding frame

### Gap and authority boundary

The existing generated-only floor computes `sourceIdentifiers` from the selected `discourse_frame`. It therefore does nothing when the generated subject is `Zephyr QX-100`, the readable fictional record omits that identifier, and its frame contains only `In that invented example ...`; the named antecedent occurs in a different supplied source item. The candidate can remain semantically faithful to the fictional promise while becoming independently unidentifiable and unresponsive to a product-specific query.

The proposed two-level check is sound:

- derive identifier tokens from the complete immutable supplied source;
- for each identifier also claimed by generated `record.subject`, require that exact normalized identifier in both the candidate’s readable text and its deciding frame.

The complete source establishes only that the identifier exists somewhere in the input. Requiring the frame occurrence prevents that source-wide fact from authorizing a relation to the selected proposition. Requiring readable occurrence prevents private subject metadata and a destination slug from substituting for user-visible identity. The semantic verifier must still decide whether the frame actually makes the antecedent relation unambiguous.

This remains generated-only and rejection-only. It should use the existing `subjectIdentifiers` normalization and exact source item bytes. It must not:

- add an identifier to text or frame automatically;
- infer that `that example`, `it`, or `the device` refers to the nearest identifier;
- use a question, page title, destination, local configuration, or ownership result as source evidence;
- accept merely because the identifier appears in an unrelated frame clause; or
- change caller-provided candidate behavior.

For bounded scope, identifiers in `record.subject` that do not occur anywhere in the complete source can remain governed by existing support and semantic verification. Rejecting all such subjects may be defensible separately, but it is broader than the reproduced omission.

The correct repair for the fiction shape is allowed to add the exact introducing source span to the candidate frame and the exact identifier to readable text. The positional repair transaction and semantic verifier then decide whether it is a valid repair. If the antecedent is ambiguous, the candidate should remain held rather than borrow identity or gain page ownership.

Meaningful tests should cover:

- identifier in `subject` and complete source, absent from both text and frame → held;
- identifier in text but absent from the deciding frame → held;
- identifier in frame but absent from text → held;
- identifier in complete source, frame, and text → admitted only as far as the existing semantic verifier;
- two possible product antecedents → no automatic selection;
- an unrelated source item containing the identifier → still held until its exact antecedent span belongs in the frame;
- generic subjects and caller-provided candidates → unchanged;
- repair returning a duplicate or changing an already admitted position → existing fail-closed transaction remains effective.

The new reason should say that readable identity or its deciding antecedent is missing. `validation_failed` is appropriate because the model can repair text/frame while all other candidates stay immutable.

## 3. Preserve connector insertion attachment during extraction

The V57 alternatives candidate changed `неплотно вставленный внутренний разъём` from an internal connector inserted loosely to an “internally loose connector.” The semantic verifier correctly held it, but the only usable record was lost.

A narrow extraction instruction should state that manner attached to an insertion/engagement participle remains attached to that action. “Loosely inserted internal connector” and “internally loose connector” are the useful contrast; neither generic installation wording nor a component dictionary is needed. The complete source, exact support/frame, and existing object/mechanism semantic dimension remain authoritative.

This is prompt evidence, not a deterministic guarantee. Bump the retention prompt version and its benchmark expectation. A prompt-presence/version test is useful; synthetic true-verdict fixtures should not be presented as evidence that the model will preserve the phrase. The next frozen exposed probe supplies that evidence.

## 4. Collective excerpt selection and focused rejection answers

V57 rejected two faithful focused blocks because its verdict treated E2 as if every cited excerpt had to select every answer detail. The frozen contract instead asks whether all material propositions are selected by the visible retained *excerpts* collectively. E1 visibly names Ada’s declined service-centre thermostat-measurement offer; E2 visibly reiterates rejection of that offered shipment. No private frame supplies the purpose.

The answer verifier prompt should state both sides of the rule:

- the union of visible excerpts must select every material proposition in the block;
- every cited evidence item must contribute to that selected proposition or one of its material qualifications, but it need not independently contain the whole proposition;
- a private original frame can resolve meaning and constrain roles, but cannot fill a selection gap in that union.

This avoids turning “collective” into permission to append unrelated citations. The `excerpt_selection` boolean/detail consistency and all three semantic dimensions remain mandatory. There is no need to change the schema or deterministic verdict aggregation.

The generator should prefer the smallest sufficient evidence set, but it may cite corroborating records that visibly select part of the same proposition. It should also receive the existing scope rule in concrete form: an ordinary focused answer identifying a declined offer may omit an independent neighboring no-plan sentence. Only `rendering_scope=complete_retained_record` requires every readable clause of its one record. A focused omission does not permit dropping rejection status, actor, purpose, or another qualification coupled to the selected offer.

Tests should capture the prompt/version and the mandatory verifier path for:

- E1 selecting actor/action/purpose and E2 selecting the same rejection → collective selection can be true;
- E2 contributing only a separate booking fact → collective selection must be false if the block asserts that booking;
- an unrelated second citation → cannot rescue or authorize content;
- ordinary focused rejection omitting an independent no-plan neighbor → semantic true remains publishable;
- complete-record rendering omitting the same clause → still rejected;
- any private-frame-only detail absent from the visible union → selection false.

These fixtures verify wiring and contract boundaries. They cannot establish semantic reliability by stubbing a favorable model verdict, so the live frozen evaluation remains necessary.

## Integration, budgets, and release evidence

The changes fit the current pipeline:

1. extraction returns the same candidate schema;
2. generated validation applies the booking and identifier floors;
3. one existing repair transaction may repair held positions without mutating admitted candidates;
4. the existing retention verifier checks complete exact source frames;
5. answer generation and the existing per-block verifier apply collective selection and focused scope.

No additional source bytes enter public evidence. The complete supplied source is already available to generated retention validation, and only identifier membership is used locally. No public API, stored marker, provenance format, answer rendering schema, or citation format changes. The new prompt text is small relative to the existing 2,400-token retention and answer evaluation ceilings; no budget increase is justified. Existing configured service caps remain authoritative.

The highest precision risks are an appositive regex that consumes a real second clause, a subject floor that treats source-wide identifier presence as antecedent proof, and “collective selection” wording that excuses unrelated citations. The adjacency, frame-presence, and contribution requirements above contain those risks. With those controls, the V58 scope is supported by the complete V57 evidence and is smaller than adding coreference resolution, a general time parser, a component dictionary, retries, or another model call.
