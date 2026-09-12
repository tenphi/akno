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

- `(en → ru, inferred)`: `... «следующий год» отсчитывается от самой недатированной исходной записи ...`. Rejected as `discourse`. The source-clock helper accepts bounded modifiers such as `этой`, `исходной`, and `недатированной`, but not `самой`; it also caps that modifier sequence. The meaning is exact, so this is a deterministic source-anchor syntax false hold.
- `(en → ru, explicit)`: the same faithful `от самой недатированной записи` clock form is outside the anchor grammar, but the row is rejected earlier as `attribution` because `план не был принят, и встреча не была организована` drops Ada as actor of both personal negative actions. The actor hold is correct even though the clock form would otherwise false-hold.
- `(ru → ru, inferred)`: contains the same `от самой недатированной записи` anchor and preserves Ada as actor (`Ada ... не приняла план и не организовала встречу`). Rejected as `discourse`; this is a deterministic clock-syntax false hold.
- `(ru → ru, explicit)`: contains the same `от самой недатированной записи` anchor and the nearly exact actor-bound `Ada ... не приняла его как план и не организовала встречу`. Rejected as `discourse`; this is a deterministic clock-syntax false hold.

The accepted English undated answers sometimes use ordinary same-record backshift (`had not adopted`, `remained her proposal`). That does not invent a dated past event and is valid under the established narrative convention.

## Accepted-answer audit

I found one clear actor/source-entailment error among the 33 non-null answers. The other 32 are source-faithful and qualified on this audit.

- Seven report answers preserve Bo/Ada nesting, measurement-versus-replacement contrast, and both personal epistemic limits. Russian `якобы` adds an “allegedly” shade, but within the explicit unconfirmed relay context it does not promote the report or relocate uncertainty.
- Seven hypothesis answers preserve hypothetical/conditional scope. The final Russian explicit answer omits the redundant sentence that no actual missed check was reported, but it keeps the rule hypothetical, the consequence conditional, and actual requirements unknown; it does not assert a real miss.
- All eight assistant answers preserve the assistant's personal epistemic subject and contractual-term sense.
- Six of seven non-null fiction answers preserve Ada as proposer, fictional Vulpine/Bo roles, axle-cap replacement, duration, and no-real-agreement scope. The `(ru → ru, explicit)` answer says `По словам Ada Marlow ... Обсуждение этого примера было лишь предложено`. Outer attribution does not bind Ada as the proposer of the passive second sentence. This is the same material actor omission as the rejected inferred row and is an accepted source-entailment error.
- Four undated answers preserve Ada's proposal and both personal negative actions, with complete source-relative unknown-clock wording. The tentative status is attached to timing rather than review manner.

There are no accepted answers for the exclusion case because the protected-value floor blocked every generated composition.

## Bounded next scope

The evidence supports structural fixes rather than more synonym accumulation:

1. Extend the existing Russian source-clock grammar only for the attested intensifier sequence `от самой недатированной [исходной] записи`, with device/other-noun and wrong-anchor contrasts. Keep the passive unassigned negative-action row rejected.
2. Make proposer alignment systematic for selected proposal actions. Both `По словам Ada, предложено обсудить` and `По словам Ada ... Обсуждение было предложено` omit the proposer despite outer attribution; generation and verification should compare the action actor rather than add another passive phrase exception.
3. Treat component-versus-damage nominalization as a source comparison question in the existing semantic verifier, requiring a concrete changed object or coverage proposition before rejection. Do not add a warranty synonym dictionary or bypass excerpt selection.
4. Keep the no-booking routing issue deferred until ownership can receive explicit source-backed antecedent authority. Do not borrow a neighboring product merely by proximity.
5. Investigate the Russian language-check false negative using its existing source-backed name references; no extra model call or automatic language override is warranted.

No evidence here supports semantic retry, gate relaxation, or broader model changes.

## V54 structured source-to-answer alignment design

The proposed direction is preferable to more lexical floors, with these bounds:

- A private generation `record_readings` section can force the model to inspect the bound original frame before drafting. Require the exact unique set of framed evidence IDs, bounded strings, no foreign IDs, and no duplicate/missing readings. Treat it only as generation scratch output: it cannot authorize a block, override retained selection, or be copied into the verifier as evidence. A malformed reading aborts generation closed. This may improve query-reopened clarification, but it is not evidence that the reading is correct.
- The independent verifier alignment is the stronger mechanism. Keep source substrings exact and verify them against the supplied frame; answer substrings must be exact or null and must be checked against that block only. Require entries for explicit categories that matter to the selected proposition—at minimum action actor/object and material qualification/contrast—rather than allowing the verifier to choose only an easy benign modifier. Otherwise an audit can omit the very Ada-proposer loss it is meant to expose.
- `changed` and `omitted` should deterministically hold when the audited item is a required part of the selected proposition. `generalized` needs care: a generalization can remain entailed but lose usefulness, so it should hold only when it erases a material mechanism/restriction required by the selected record. `not_selected` must not automatically fail for incidental text merely present in a multi-sentence source frame; doing so would recreate exhaustive-fiction/detail requirements. It should fail only when the source substring is declared part of the retained selected proposition.
- Preserve the existing three booleans and excerpt-selection verdict. Alignment can add a necessary failure condition but must never turn a false existing dimension true. Missing, contradictory, foreign-coordinate, or over-budget alignment output fails closed in the same verifier call. No retry or fallback to the old schema for framed records.
- Budget the worst case before adopting the schema. Shorten prompt prose if necessary; do not truncate answer blocks, frame text, or required audit entries to fit. Record readings and audits should scale with framed evidence IDs, not every source sentence.

Minimum adversarial tests should cover: missing/duplicate/foreign evidence IDs; a correct reading followed by an answer that drops Ada as proposer; a changed component sense followed by a later correct clause; a retained fictional promise whose incidental neighboring detail is legitimately `not_selected`; exact actor preservation with neutral narrative framing; null answer substring for an omitted required actor; and all-positive audit paired with one false legacy boolean, which must still hold.

The narrow `самой` source-clock extension is independently justified by exact meaning and can proceed without this larger schema. The proposal-passive defect is better addressed by actor alignment than another phrase-specific regex.
