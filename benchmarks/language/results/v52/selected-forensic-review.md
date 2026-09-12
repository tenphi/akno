# V52 selected-probe forensic review

## Scope and method

This is a source-first, read-only audit of `tmp/language-selected-output-packet-v52.json`, `bench-results/language-selected-v52.json`, and `bench-results/language-selected-v52-trace.jsonl` at frozen runtime `7658928`. I did not read an independent grading receipt. Coordinates below use the report case ID and the answer order `(query language → answer language, view)`.

The probe contains six case-runs and 48 answer rows. It produced 39 non-null answers: eight rows are `no_eligible_evidence` because one case retained no record, and one row is `verification_rejected`. Five cases retained their useful source material; the report case retained neither generated candidate. There are no model-availability failures.

## Retention audit

### `v19-held-report`: complete source meaning generated, but no record survived

The source has two independently useful propositions:

1. Bo Winters told Ada Marlow that the Zephyr QX-100 terms permit sending the device to a service bench to **measure the tension of its return spring**, rather than replace that spring. Ada has not read the terms, independently confirmed the report, or verified it as a condition.
2. `No collection of my device has been booked.` This is Ada's direct negative booking statement; no booking actor is supplied.

The first raw candidate contained the substantive nested report, measurement object, not-replacement contrast, Bo/Ada roles, and Ada's verification limits. It was held at validation as `discourse_uncertain`. The one repair changed the readable qualification from the awkward coordination “has not ... independently confirmed ... or verified” to:

> this was Bo Winters's wording in Ada Marlow's retelling, and Ada Marlow has not read the service terms or independently confirmed the report, so it is not a condition she has verified.

That repair is faithful to all three source turns, but it still did not reach the semantic verifier. The trace exposes the stage and reason text, not the exact deterministic predicate that failed. This is therefore a structural false hold with some implementation-level uncertainty about which attribution/qualification form rejected the repaired prose; it is not a semantic omission in the repaired candidate.

The second candidate faithfully states:

> Ada Marlow states that no collection of her device has been booked.

The semantic verifier accepted it and correctly observed that the source supplies no booking agent. Placement then returned `selection:"uncertain"`, producing `routing_uncertain`. This hold is defensible for the reduced ownership input, because the candidate has `page:null` and a generic subject (`Collection of Ada Marlow's device`). The complete source does contain Zephyr QX-100 in the adjacent nested report, so the lost record is potentially routable with source-level antecedent resolution; the current ownership decision did not establish that identity.

Result: retention `0/2`; all eight report answer rows are `no_eligible_evidence`. These are writable-evidence coverage losses, not justified source-level abstentions.

### `v19-held-hypothesis`: complete and qualified

The retained record preserves Ada as the person who presents the hypothetical two-month foam-filter rule, the coupled conditional consequence (a missed inspection would violate the rule only if accepted), unknown actual requirements, and the explicit absence of a reported real missed inspection. All source-frame spans are represented and qualification remains hypothetical.

### `v19-held-exclusion`: complete two-record decomposition

Record 0 preserves Ada's negated warranty-coverage assertion for the damaged support bracket. Record 1 correctly keeps the epistemic subject narrow: **the exclusion record** does not determine fan-motor repair coverage and does not assert that the contract is wholly silent. It does not turn that statement into whole-contract absence. Both records retain Ada's self-attested attribution and their respective polarities.

### `v19-held-assistant`: complete and qualified

The record preserves the assistant's preliminary reading, modal `may include`, quarterly status-display check, the assistant's personal lack of contract examination and confirmation, and “possible contract condition, not an established requirement.” It does not globalize the assistant's epistemic limits.

### `v19-held-fiction`: complete two-record decomposition

The plan record preserves Ada as proposer of discussion and says no real agreement exists. The hypothetical record preserves Vulpine Mutual as promisor, fictional Bo Winters as recipient, free axle-cap replacements as the benefit, the first ten weeks as its duration, and fiction-only scope. Russian `колпачок/колпачки оси` is a faithful translation of `axle-cap`; it is not an untranslated technical token or a changed component.

### `v19-held-undated`: complete and qualified

The record preserves Ada as proposer, warranty exclusions as the review object, next year relative to the undated original record, unrecoverable calendar year, and Ada as the actor of both negative actions: she has neither adopted the proposal as a plan nor arranged a meeting. The temporal envelope remains tentative, unknown-precision, undated, and non-actionable.

## Answer audit

### Accepted answers

I found no clear source-entailment, qualification, role, polarity, or language error among the 39 non-null answers.

- **Hypothesis (8/8):** every answer preserves Ada's authorship of the hypothetical rule, the two-month foam-filter interval, the conditional missed-inspection consequence, unknown real requirements, and no reported real missed inspection. No answer promotes the scenario to fact.
- **Exclusion (8/8):** every answer preserves the damaged-bracket noncoverage and the narrow exclusion-record uncertainty about fan-motor repair. Phrases such as “the contract is entirely silent” occur only under negation, matching the source.
- **Assistant (8/8):** every answer localizes the generic assistant label in Russian, preserves modal/tentative status, quarterly status-display checking, and the assistant's personal non-examination/non-confirmation. No physical-state/contract-condition sense error appears.
- **Fiction (8/8):** every answer keeps Ada as discussion proposer, Vulpine Mutual as fictional promisor, Bo as fictional recipient, axle-cap replacement and the ten-week duration, and no-real-agreement scope.
- **Undated (7/8 non-null):** every produced answer binds Ada to the proposal, non-adoption, and non-arrangement; preserves the warranty-exclusion review; and anchors next year to the undated original record with an unrecoverable calendar year. “The timing was/is tentative” is supported by the typed temporal envelope and does not negate that Ada actually made a proposal.

There is a limited interpretive issue in the Russian forms `предложила предварительно пересмотреть/рассмотреть`. Russian permits reading `предварительно` as modifying the act of review (“review preliminarily”) rather than the proposal's tentative timing/status. In context, each answer immediately supplies the source-relative tentative timing and the explicit non-adoption/non-arrangement, so I do not treat the accepted instances as clear source errors. They remain slightly less precise than putting `предварительный` on `срок` or `предложение`.

### Nulls and exact causes

- **`v19-held-report`, all eight coordinates:** `no_eligible_evidence`, downstream of the two retention holds described above. The questions are answerable from the source and from the semantically faithful first repaired candidate, so these are coverage losses.
- **`v19-held-undated`, `ru → ru`, inferred view:** draft: `Ada Marlow предложила предварительно рассмотреть ...`; the verifier rejected `предварительно` as unsupported manner/stage, while accepting its qualification scope. This is a conservative and disputed false hold: the typed record expressly has tentative temporal status and the complete answer anchors the phrase to the source-relative unknown date. The wording is ambiguous enough that a stricter verifier can prefer rejection, but it does not clearly invent a new event or erase an actor. It remains an answer-coverage loss over adequate writable evidence.

## Bounded next scope

Evidence requires two concrete follow-ups, without broadening semantic acceptance:

1. Make the report candidate's deterministic readable-attribution/uncertainty floor accept a complete, source-faithful nested-report construction after the one bounded repair, and retain the exact negative-booking candidate when ownership can resolve its source-backed device antecedent. This should be tested as two independent candidate outcomes; neither repair nor routing should borrow generated subject authority.
2. For tentative source-relative proposals, keep temporal qualification syntactically attached to `timing/date/proposal` in generation so the existing verifier need not decide whether an adverb modifies the review action.

The probe gives no evidence for weakening the semantic verifier, adding retries, expanding models, or relaxing language/qualification gates.
