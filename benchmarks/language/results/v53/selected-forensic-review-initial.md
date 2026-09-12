# V53 selected diagnostic: source-first forensic review

## Scope

Reviewed only the current [output packet](language-selected-output-packet-v53.json), [report](selected-diagnostic.json), and [trace](../../../../bench-results/language-selected-v53-trace.jsonl). I did not inspect an independent grader receipt or call a model.

The six case-runs contain 48 answer rows. V53 produced 33 non-null answers. Fifteen are null: two language-check failures, eight protected-value holds caused by one retention omission, four deterministic undated-answer holds, and one semantic rejection. Five of six cases retained at least one useful record, but the report and exclusion sets each lost one source proposition.

## Retention

### `v19-held-report`: useful nested report retained; separate booking denial lost

The written record faithfully preserves:

- Ada Marlow as outer relay and Bo Winters as inner speaker;
- permission to send Zephyr QX-100 to a service bench;
- return-spring tension measurement rather than spring replacement;
- Ada's personal limits: she has not read the terms and has no independent confirmation.

This demonstrates that the coordinated report-uncertainty change fixed the prior pre-verifier false hold. The wording does not claim universal nonconfirmation: both limits remain explicitly scoped to Ada.

The separate candidate `Ada Marlow states that no collection of her device has been booked` passed semantic verification but ownership returned `uncertain`; it was held as `routing_uncertain`. The candidate itself faithfully preserves the source's passive booking denial and does not invent a booking actor. Its own text/page does not establish that “her device” is Zephyr, so the reduced-input routing hold is defensible. The retained set is nevertheless incomplete relative to the complete source.

### `v19-held-hypothesis`: complete

The record preserves Ada's hypothetical two-month foam-filter rule, the coupled conditional missed-check consequence, unknown actual requirements, and no reported real missed check. Frequency remains a property rather than a calendar event.

### `v19-held-exclusion`: unresolved record retained; primary exclusion held

The retained record correctly says that Ada's exclusion record does not determine fan-motor repair coverage and does not say the whole contract is silent.

The primary candidate was held by the semantic verifier. Source: `повреждённый опорный кронштейн ... не покрывается гарантией`; candidate: `damage to the ... support bracket is excluded from warranty coverage`. The verifier treated the latter as changing the coverage object from the damaged bracket to damage as an abstract object. This is a defensible conservative distinction, but semantically disputed: ordinary warranty language often expresses noncoverage of a damaged component as exclusion of damage to that component. No outside warranty convention should decide it. The candidate does not clearly add a different component, process, or coverage result, so I classify this as a disputed false rejection and a material retention-coverage loss, rather than a proven unsafe candidate.

### `v19-held-assistant`: complete

The record preserves generic assistant attribution, modal/tentative status, quarterly functional status-display checking, the assistant's personal lack of examination and confirmation, and contractual-condition sense. It makes no physical-state claim.

### `v19-held-fiction`: complete

The two records separately preserve Ada's actual proposal to discuss and the fictional promise. Vulpine Mutual remains promisor, fictional Bo Winters remains recipient/character, `axle-cap` remains `колпачок оси`, the first ten weeks remain intact, and no real agreement is asserted.

### `v19-held-undated`: complete

The record preserves Ada as proposer, next year relative to the undated source record, unknown calendar year, asserted proposal/proposed disposition, tentative time, and Ada as actor of both non-adoption and non-arrangement.

## Answer nulls

Coordinates use `(query language → answer language, view)`.

### Language-check failures

- `v19-held-report`, `(ru → ru, explicit)`: the generated excerpt is entirely Russian apart from exact supplied names/identifier. It faithfully preserves all nested-report content and qualifications. The language checker returned `compliant:false`, and no raw answer reached later guards. This is a false language hold.
- `v19-held-hypothesis`, `(ru → en, inferred)`: the requested output was English, but the generated excerpt was Russian (`Ada Marlow допускает ...`). The language hold is correct.

### Exclusion: eight protected-value holds

All eight generated drafts included both the damaged-support-bracket exclusion and the retained unresolved fan-motor statement. Because the bracket record was not retained, its proposition was not authorized by the cited retained excerpt. Every draft was rejected before semantic verification with `protected_value`.

These holds correctly enforce selected-record authority; the user questions remain source-answerable, so all eight are production coverage losses caused upstream by the disputed retention rejection.

### Fiction: one semantic hold

- `v19-held-fiction`, `(ru → ru, inferred)`: draft begins `По словам Ada Marlow, предложено обсудить ...`. It preserves fictional promise roles and scope but renders the real proposal impersonally. Outer attribution (“according to Ada”) does not make Ada the grammatical proposer. The verifier correctly rejected the omitted action agent. This is a protected generation error, not a false hold.

### Undated: four deterministic holds

All four drafts preserve next year relative to the undated source, unknown calendar year, actual proposal, tentative timing, and absence of adoption/meeting. They never substitute today's date.

- `(en → ru, inferred)`: `Ada ... предложила ... Срок предварительный ... она не приняла план и не организовала встречу.` Rejected as `discourse`. The source says she has not adopted a plan; this is materially faithful. `не приняла план` is less explicit than `не приняла предложение как план`, but does not change the actor or create adoption. Conservative false hold.
- `(en → ru, explicit)`: `план не был принят, и встреча не была организована.` Rejected as `attribution`. This drops Ada as actor of both personal negative actions. Correct hold.
- `(ru → ru, inferred)`: `Ada ... не приняла план и не организовала встречу.` Rejected as `discourse`. Actor, polarity, proposal, timing, and source clock are intact. Conservative false hold; the trace exposes no more specific failed predicate.
- `(ru → ru, explicit)`: `Ada ... не приняла его как план и не организовала встречу.` Rejected as `discourse`. This is nearly exact source meaning and preserves every typed qualification. It is a clear deterministic false hold; the report exposes only the broad `discourse` category.

The accepted English undated answers sometimes use ordinary same-record backshift (`had not adopted`, `remained her proposal`). That does not invent a dated past event and is valid under the established narrative convention.

## Accepted-answer audit

I found no clear source-entailment, qualification, language, actor, or polarity error among the 33 non-null answers.

- Seven report answers preserve Bo/Ada nesting, measurement-versus-replacement contrast, and both personal epistemic limits. Russian `якобы` adds an “allegedly” shade, but within the explicit unconfirmed relay context it does not promote the report or relocate uncertainty.
- Seven hypothesis answers preserve hypothetical/conditional scope. The final Russian explicit answer omits the redundant sentence that no actual missed check was reported, but it keeps the rule hypothetical, the consequence conditional, and actual requirements unknown; it does not assert a real miss.
- All eight assistant answers preserve the assistant's personal epistemic subject and contractual-term sense.
- Seven fiction answers preserve Ada as proposer, fictional Vulpine/Bo roles, axle-cap replacement, duration, and no-real-agreement scope.
- Four undated answers preserve Ada's proposal and both personal negative actions, with complete source-relative unknown-clock wording. The tentative status is attached to timing rather than review manner.

There are no accepted answers for the exclusion case because the protected-value floor blocked every generated composition.

## Bounded next scope

The evidence supports structural fixes rather than more synonym accumulation:

1. Expose a precise deterministic guard reason for broad `discourse` holds, then reconcile the undated personal-negative-action/status floors so an exact actor-bound `не приняла его как план и не организовала встречу` reaches the unchanged semantic verifier. Keep the passive unassigned contrast rejected.
2. Treat component-versus-damage nominalization as a source comparison question in the existing semantic verifier, requiring a concrete changed object or coverage proposition before rejection. Do not add a warranty synonym dictionary or bypass excerpt selection.
3. Keep the no-booking routing issue deferred until ownership can receive explicit source-backed antecedent authority. Do not borrow a neighboring product merely by proximity.
4. Investigate the Russian language-check false negative using its existing source-backed name references; no extra model call or automatic language override is warranted.

No evidence here supports semantic retry, gate relaxation, or broader model changes.
