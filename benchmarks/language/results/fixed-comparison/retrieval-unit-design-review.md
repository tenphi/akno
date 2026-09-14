# Semantic retrieval-unit contract review

## Disposition

The proposed replacement is coherent and bounded. It addresses a general
representation failure: downstream retrieval, complete-record rendering, and
verification operate on one managed record at a time, while extraction sometimes
places a selected proposition and its governing knowledge-state limits in
different records or assigns the record's one commitment from the outer act
rather than the embedded proposition.

This should be one replacement of overlapping extraction prose, not another
paragraph added to the current prompt. It changes no schema, model role, call,
retry, cap, filter, or lexical recognizer. Selection remains conditional on the
full comparison corroborating these failure families, followed by the one
predeclared 22-case/two-run verification.

The limitation is material: this remains a generation and verifier instruction.
The existing verifier has no batch-level source-coverage field that can
deterministically reject two individually true sibling records merely because a
source-coupled limit was placed only in the second. The final suite must measure
the behavior; the prompt text is not proof that the representation changed.

## Recommended compact contract

Replace the opening report-specific unit paragraph with one semantic rule:

```text
For each candidate, select one independently retrievable semantic unit: the
selected proposition together with every source-coupled truth, knowledge-state,
speaker, modality, polarity, time and corrective limit that governs how that
proposition may be read. Keep those limits in the same readable record, using
several short sentences when useful. Sentence or source-item boundaries do not
make a governing limit independent. A sibling record cannot carry a selected
proposition's required scope.

A durable open question keeps the named person's lack of an answer and the
record's neither-positive-nor-negative boundary when supplied. Competing
hypotheses keep all alternatives and their common evidence limits, named
nonselection and unconfirmed underlying state when supplied. A report keeps its
embedded proposition, reporter chain and verification limits. Keep an adjacent
fact separate when it remains independently true and does not constrain the
selected proposition. If the complete retrieval unit cannot fit the existing
text bound, omit it rather than store a misleading fragment.
```

“Source-coupled” should mean that omission changes the selected proposition's
truth conditions, epistemic status, attribution, applicability, or whether either
answer is established. Mere proximity, same subject, same source transaction, or
same paragraph is insufficient. This boundary keeps the nested report's separate
not-packed fact independent while joining an open question to its explicit
no-answer/neither-polarity scope.

Replace the later activity paragraph with:

```text
Distinguish neutral provenance from an independently asserted activity. Neutral
framing such as “In SOURCE's hypothetical example” identifies provenance and
does not claim that SOURCE wrote, recorded, described or performed an act. When
the source does assert that a person discusses, considers or proposes something,
preserve that actor and exact act in readable text. Type commitment from the
selected embedded proposition: tentative or hypothetical hypotheses remain so
even when the outer discussion or consideration actually occurred. The label
does not hedge the asserted act, and an asserted, proposed, denied or merely
planned act must not be changed into another status.
```

This directly uses the existing `semanticRecordScope` definition for tentative
records: tentative can qualify embedded hypotheses without hedging an explicitly
asserted discussion/consideration act.

## Existing prose to replace or remove

To avoid prompt accumulation:

1. **Replace** the `SYSTEM` opening from “For each candidate, select its complete
   source-supported unit” through the report-specific “Use short complete
   sentences within that record” text with the compact retrieval-unit contract.
   Keep the following subject/page-order and attribution-chain rules.
2. In `QUALIFICATION_CONTRACT`, **retain** the first two sentences that type
   competing hypotheses as tentative/hypothetical, but **remove** the physical
   one-candidate instructions beginning “Retain a coupled comparison as one
   complete candidate”. The new general unit rule owns co-location and lists the
   applicable group limits once.
3. In the direct-report block, keep the distinct self-attested/source-report and
   inner/outer attribution rules. **Remove or condense** “Each candidate must
   carry its own ... / a sibling candidate cannot carry ...” because the new
   retrieval-unit rule now owns that requirement. Preserve the important rule
   that an adjacent direct assertion does not inherit the inner reporter.
4. **Replace**, rather than supplement, the later Rules paragraph beginning
   “Preserve a source's actual activity when retaining that activity”. The new
   neutral-provenance/activity paragraph carries its useful actor/predicate and
   embedded-commitment boundaries without the repeated examples.
5. Keep the compact 400-unit shape/cap rule, but remove its repeated general list
   of actors/contrasts/epistemic qualifications if the new contract immediately
   precedes it. Keep the distinct no-confirmation/received-confirmation/personal-
   confirmation warning because it defines non-equivalent predicates.
6. Keep `PROPOSITION_SCOPE_CONTRACT`. Its neutral-provenance and real-act clauses
   are shared with answer verification and remain useful semantic checks. Do not
   copy those paragraphs a third time into `QUALIFICATION_CONTRACT`.

Rules for corrective contrasts, conditional premise/consequence, identity,
action agents, time, fiction, relations, and independent booking denials remain
unchanged. They protect different boundaries.

## Coherence with linked alternatives

This correction governs a **common** scope statement. It does not prohibit every
linked representation. Separately qualified alternatives may remain separate
only when each is independently readable and carries every distributive limit
that applies to it, while any non-distributive comparison/nonselection statement
is retained as its own complete group proposition. For the observed competing-
hypotheses family, a single complete record is the smallest safe representation
because the named nonselection, common lack of evidence, and unconfirmed rattle
scope the pair.

A typed `contradicts` relation cannot carry epistemic scope. It may preserve an
explicit incompatibility but cannot substitute for the retrieval-unit contract.

## Minimal controls

### Retention generation and semantic negatives

1. **Open question positive:** a two-sentence source produces one question record
   containing the question, the named person's lack of an answer, and the
   record-level neither-inclusion-nor-exclusion clause, with their subjects kept
   distinct.
2. **Open question split negative:** a generated question candidate that omits
   those coupled limits receives a negative `qualification_scope_preserved`
   verdict even if a sibling candidate states them. No semantic retry follows.
3. **Independent-neighbor positive:** add an independent same-subject fact in the
   next source sentence. It remains a separate candidate and is not copied into
   the question/report retrieval unit.
4. **Hypotheses positive:** one tentative record names the actual considering
   actor and act, both alternatives, named nonselection, lack of evidence for
   both, and the unconfirmed underlying state. The tentative label qualifies the
   hypotheses while readable prose still asserts the actual consideration act.
5. **Activity negatives:** reject/hold candidates that (a) hedge an actually
   asserted discussion, (b) turn a proposal to discuss into completed discussion,
   (c) replace discussing with private considering, (d) infer writing/recording
   from neutral provenance, or (e) type embedded unconfirmed hypotheses as
   asserted ordinary facts.
6. **Scope negatives:** omitting only personal nonselection, common evidence
   absence, or the unconfirmed underlying state must independently fail
   qualification scope. A sibling containing the missing text supplies no
   evidence.
7. **Cap behavior:** a complete unit at 400 normalized UTF-16 units survives; a
   unit that cannot preserve its governing scope within 400 is held/omitted, not
   split into a misleading proposition and qualifier.

These tests should exercise actual cleaner and existing-verifier orchestration
with independently specified negative stub verdicts. Positive stubs establish
wire/dataflow behavior, not model competence.

### Public path

1. Store the complete open-question record, then answer both query languages in
   both requested answer languages and inferred/explicit question views. Every
   accepted answer must preserve lack-of-answer and neither-polarity scope.
2. Store the complete tentative hypotheses record, then exercise inferred and
   explicit discussion views. The record must be retrievable; copy/translation
   must preserve both alternatives and all common limits.
3. Include an unrelated same-subject neighbor in each page. It must not become a
   required record, citation, or public answer clause.
4. Retain source/language semantic negatives: an answer selecting one hypothesis,
   claiming the question's positive answer, omitting common scope, or converting
   neutral provenance into an action remains rejected.

## Decision boundary

This is a suitable component of the one integration only if the completed fixed
comparison confirms that incomplete retrieval units or mismatched embedded-
commitment routing recur beyond the two inspected cases. Success means the final
fixed suite shows improved complete retention and useful answers without a new
accepted source, qualification, language, or promotion error. If the model still
splits governing limits or mislabels embedded content, record the prompt-only
limit and finish the comparison; do not respond by adding another phrase list or
another runtime iteration.
