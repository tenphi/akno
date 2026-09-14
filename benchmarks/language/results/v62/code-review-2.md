# V62 code review round 2

Reviewed the current uncommitted diff from `bad22b4`, the preserved round-one review and resolution, the final restrictive-naming implementation/tests, extraction/repair schema order, governing-unknownness instruction, changeset, and V62 trial plan. No runtime files were edited and no provider was called.

## Preserved round-one finding and resolution

Round one reproduced a P2 deterministic-floor escape: title-cased run-on tails such as `Zephyr QX-100 Then A Collection` and a second `Ada Marlow` subject were consumed as a restrictive name, allowing a later affirmative-looking booking to borrow an earlier denial.

The current implementation resolves that finding. `hasAffirmedBooking` now removes a generated `the device referred to as NAME` tail only when all of these hold:

1. the complete normalized captured tail equals the candidate's complete declared subject;
2. that exact bounded subject occurs within one already validated source-frame span;
3. the tail has the closed one-to-six-token uppercase/digit name shape;
4. it contains none of the bounded predicate/connective heads;
5. the construction is directly adjacent to this booking auxiliary without punctuation.

The declared subject cannot self-certify a forged expansion because the same complete expansion would also have to occur in a frame span. The new forged-subject tests cover the two original expanded forms. The titlecase, uppercase, newline-folded second-subject, coordination, prior-predicate and separate-clause examples remain `time_unresolved`, while the intended exact `Zephyr QX-100` form reaches mandatory verification with both positive and negative semantic outcomes. The round-one defect is fixed without adding routing or source authority.

## Source and grammar boundary

The helper receives `spans.frame` only after support/frame validation. It checks each span independently rather than joining names across items. Regex state is stable because the source-name expression is non-global. NFKC and whitespace normalization make source/candidate comparison consistent with the cleaner's earlier whitespace folding; the code does not claim preservation of raw newline distinctions.

Quotation behavior remains conservative. The pre-existing quoted generic alias form is handled separately; the new restrictive proper-name tail does not cross commas, sentence punctuation, or newlines in its own match. A source name occurring in quotation can establish only that spelling for this presence floor; it does not establish the generated coreference. This is a finite limitation, not an acceptance bypass: exact support/frame checks and the mandatory full-source semantic verifier still decide whether `the device` actually denotes that subject. A useful future contrast is an unrelated quoted identifier in the same validated frame with a negative semantic verdict, but it is not necessary to make the deterministic booking classification safe.

The helper remains generated-only at its call site. Caller-provided candidates do not enter this new naming exception. It changes only whether an apparently affirmative `booked/scheduled` auxiliary belongs to a recognized negative noun subject; it creates no time envelope, record, page or ownership result.

## Schema order and repair immutability

`RETAIN_SCHEMA` now orders qualification/support/frame/time, then `text`, then `subject` and `page`. The actual endpoint-schema test asserts the final `text, subject, page` order. Parsing remains keyed, all fields remain required/nullable as before, and no public field or type changed.

The repair schema reuses `RETAIN_SCHEMA.shape.candidates.element`, so extraction and repair see the same ordering. Existing repair mechanics still target only failed original positions, preserve admitted candidates by deep equality and original position, and discard a transaction that mutates or loses an admitted sibling. The prompt correctly places governing actual-unknownness in the hypothetical record during initial extraction; it does not tell repair to merge a failed supplemental candidate into an admitted sibling.

Choosing subject/page after the readable proposition is only a constrained-generation aid. The prompt explicitly says those fields are not ownership proof and permits null when unresolved. Cleaner identifier checks, admitted-page/folder policy, independent ownership, and full semantic verification remain unchanged.

## Governing unknownness

The new instruction preserves `unknown to us` as its actual group-relative epistemic limit, keeps actual requirements distinct from an assumed rule, and requires the limit in the same hypothetical record it qualifies. It expressly forbids inventing a named group or group page. This addresses the V61 extraction omission without changing canonical semantics or weakening the whole-frame `UNSAFE_DISCOURSE` guard.

Its effect is model-dependent. A separately generated unknownness candidate still needs its own valid deciding frame and subject; if it cannot be independently repaired, it stays held. Nothing in the diff permits it to borrow the hypothetical sibling's metadata or mutate that admitted sibling.

## Tests and plan

The tests exercise:

- quoted-alias and unquoted restrictive-name positives;
- all-true and negative mandatory semantic outcomes;
- affirmative booking, prior predicate, coordination, separate sentence, newline-folded forms, titlecase connectives and second subjects;
- forged declared subjects;
- actual endpoint property ordering.

They test behavior through both `cleanCandidateBatch` and `runRetain`, rather than asserting prompt strings alone. The V62 plan accurately describes source/frame/subject binding, unchanged ownership and repair authority, no new model/pass/retry/budget, unchanged gates, and the fact that schema ordering is a fallible generation aid.

## Disposition

No actionable blocker found. The P2 round-one finding is fixed. Finite limits remain explicit: this is a closed English naming grammar rather than a coreference parser; whitespace has already been normalized; exact name occurrence establishes spelling, not antecedent identity; and semantic/ownership reliability still depends on the unchanged mandatory gates.
