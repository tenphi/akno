# V62 bounded retention design review

## Evidence basis

This review is limited to V61's two incomplete retained sets and current retention architecture. It proposes no provider call, retry, ownership fallback, semantic bypass, or schema-field change.

## 1. Report booking denial: decide routing fields after the proposition

The source supports two independent records. Retain verification accepted `No collection of my device has been booked`, but ownership could not place the generated relational subject `Ada Marlow's device collection booking` and returned `uncertain`.

The current constrained schema emits `subject` and `page` first, before kind, attribution, support/frame, time, and the final prose `text`. That order asks the model to choose a routing identity before it has committed to the complete proposition, its agent/possessor distinction, and its exact readable wording. The V61 source is especially sensitive: Ada is the device possessor and source, but the booking actor is unspecified.

A bounded ordering change is sound:

1. kind, attribution, discourse, epistemic, polarity;
2. exact support and discourse frame, relations and time;
3. complete qualified `text`;
4. `subject` and nullable `page` derived from that completed proposition.

The wire fields, strictness, cleaner, ownership call, folder policy and candidate identity remain unchanged. This is a constrained-decoding aid, not new authority. `subject/page` must still be checked against exact source spans and the finalized text; output order cannot make a person own an action merely because they spoke.

For the observed passive possessive denial, generation should make the canonical distinction explicit:

- readable proposition: no collection of Ada's device has been booked;
- subject: Ada Marlow, because the source explicitly binds possession to first-person Ada;
- action agent: unresolved, because passive booking does not identify who would book;
- page: Ada's exact supplied profile if admitted, otherwise a policy-valid proposed person page or null.

It must not choose the Zephyr page from neighboring report context, invent Ada as booking actor, or manufacture a relational subject merely to make routing easier.

### Required contrasts

- named first-person `my device` with an admitted person profile;
- the same source with no person profile available;
- anonymous `a device`;
- `Bo's device` stated by Ada;
- two named people in one source;
- an explicit Zephyr identifier in the denial, which should retain product subject/routing;
- `I booked collection` versus passive `No collection of my device has been booked`;
- generated `subject/page` inconsistent with otherwise faithful text, which must still hold;
- caller-provided candidates, whose existing behavior and authority must remain unchanged.

### Limits

Schema order influences model generation but cannot guarantee correct ownership. The independent ownership decision remains necessary. If the provider does not materially condition later fields on earlier fields, the change may have no observed effect; the trial plan should describe it as an ordering aid rather than a fix guarantee.

## 2. Hypothesis unknownness: keep a governing qualifier with its rule

The source's `Настоящие требования нам неизвестны` qualifies why the two-month rule is only a thought experiment. V61 extracted it separately, while the main hypothetical record omitted it. The separate raw candidate then claimed a Zephyr subject not present in its deciding sentence. Its repair added the whole hypothetical antecedent/frame, but that made an asserted candidate's frame contain canonical `UNSAFE_DISCOURSE` (`hypothesis/if`); it was held before verification. This is an expected consequence of the frame-wide safety floor, not a semantic-verifier decision.

The smallest robust correction is to keep the group-relative unknownness inside the hypothetical record's complete readable proposition:

`Ada ... stipulates the rule only for a thought experiment; the actual requirements are unknown to us; if the hypothetical rule were accepted ...`

This preserves:

- `unknown to us`, not unknown to Ada alone and not universal unknowability;
- the source's separation between actual requirements and the invented rule;
- the conditional consequence and absence of an actual missed-check report;
- one coherent qualification scope under hypothetical commitment.

It also prevents complete-record answer verification from seeing a material source qualification that extraction deliberately left outside the retained record.

A separate unknownness candidate is appropriate only if it can be independently supported and routed without importing a hypothetical span as asserted evidence. Its deciding span should be the exact unknownness sentence plus only a minimal exact antecedent that truly binds its subject. Here no such non-hypothetical named Zephyr antecedent exists in that sentence. Safer options are an unresolved subject with null routing, or no separate candidate because the statement is already retained as a qualifier. There is no source-established canonical group identity here, so the model must not propose a group page. Repair must not broaden `unknown to us` into `actual foam-filter requirements are unknown` unless the complete source explicitly makes that scope equivalence.

### Required contrasts

- `requirements are unknown to us` qualifying a hypothetical rule;
- `Ada does not know the requirements` (personal experiencer);
- bare `requirements are unknown` (no experiencer);
- `device state is unknown` (object state, not epistemic group limit);
- a separately named product sentence that genuinely resolves the unknownness subject;
- an unrelated product mention beside `unknown to us`;
- asserted candidate whose frame includes a hypothetical antecedent, still held by the existing floor;
- complete hypothetical candidate containing the actual-unknownness qualifier, admitted only after full original-source semantic verification.

## 3. Repair boundary

Repair should prefer correcting the original proposition rather than expanding its frame until an identifier appears. For this failure:

- If the unknownness is a governing qualification, repair candidate 0 to include it and leave candidate 1 held/omitted.
- If candidate 1 remains independent, repair its subject/page to match the exact deciding span; do not attach the entire hypothetical rule solely as identity evidence.

The one repair transaction, original index mapping, immutable admitted positions, deep-equality survival, full cleaner, and same verifier call remain unchanged. No repaired candidate may use the original failed candidate or sibling metadata as source authority.

## Recommendation

Apply the schema ordering change as a generation aid, with `text` followed by `subject/page`, and strengthen the extraction/repair contract to keep group-relative actual-unknownness with the hypothetical proposition it qualifies. Treat standalone unknownness as unresolved unless an exact non-hypothetical span binds a canonical subject. This is smaller and safer than routing fallback or weakening `UNSAFE_DISCOURSE`, and it addresses both V61 incomplete sets without changing calls, models, gates, ownership authority, or semantic verification.
