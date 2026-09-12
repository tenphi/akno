# V53 bounded design review

## Disposition

The proposed V53 scope is sound with one implementation constraint on the report-uncertainty helper. I support changes 2–4 as stated and support change 1 if the new coordinated-negation branch is anchored to one finite negative auxiliary and a closed list of permitted report-limit predicates. Retain the current semantic verifier, one structural repair, model choices, and gate unchanged. Deferring generic no-booking routing is the safer choice: the V52 ownership input did not establish that “my device” was Zephyr, and a composition-only fallback would risk importing an adjacent report's product into a source-wide denial.

## 1. Coordinated report uncertainty

Replacing duplicated `REPORT_UNCERTAINTY.test(...)` calls with one helper is preferable because source and generated prose must use exactly the same recognition contract. Preserve all existing single-form matches, then add a bounded English clause recognizer for the form seen in V52:

> Ada Marlow has not read the service terms or independently confirmed the report.

The recognizer should require:

- one source/subject followed by `has|have|had not`;
- a first verb from `read|examined|seen|reviewed` with the bounded object `terms|service terms|contract|agreement`;
- subsequent elided predicates from `confirmed|verified` with `report` and optional `independently`;
- coordination inside the same clause, ending before `. ! ? ;`, adversative/subordinate conjunctions, or a new finite subject.

The shared negative auxiliary must govern every accepted list member. Do not accept a merely nearby negative plus a positive confirmation, for example:

- `Ada has not read the contract, but she independently confirmed the report.`
- `Ada has not read the terms; Bo verified the report.`
- `Ada has not read the agreement, and Bo confirmed the report.`
- `Ada has not read the contract, then independently confirmed the report.`

A comma-list form such as `has not read the terms, independently confirmed the report, or verified it as a condition` is defensible only when the grammar remains one closed complement list under `has not`; requiring a terminal `or` is a useful bound. Avoid accepting a bare comma followed by an unrestricted predicate or new proper-name/pronoun subject. The exact V52 repaired form with `or independently confirmed` should pass; a repeated positive auxiliary (`but has confirmed`, `and did verify`) must fail.

This helper is a necessary readable-qualification floor. It must not infer that confirmation is absent from metadata or from `source_report`, and it must not approve the proposition: the complete original frame and mandatory semantic verifier remain authoritative.

Minimum tests:

1. Existing lexical forms continue to pass for source and candidate text.
2. `has not read the service terms or independently confirmed the report` passes.
3. `has not examined the contract, confirmed the report, or verified it as a condition` passes only if the implementation deliberately supports the shared-auxiliary list.
4. Each `but`, semicolon, new-subject, and repeated-positive-auxiliary contrast above fails.
5. A source carrying the bounded uncertainty plus candidate text omitting it still holds; faithful candidate text reaches semantic verification, where a false semantic verdict still holds.
6. The one repair limit remains observable: no second repair occurs after either structural or semantic rejection.

## 2. Russian spaced `не установленные` qualification

Extending the existing head-bound `unconfirmed` morphology to the **attributive adjective** forms of `не установленн...` is safe if it stays inside the same `epistemicHead` construction. It should recognize grammatical agreement in forms such as `не установленные гипотезы`, without making `не установленный компонент`, `не установленное устройство`, or `не установленная деталь` tentative language.

The existing broad fallback already recognizes joined `неустановлен...` and short predicate forms such as `не установлена/о/ы`, including some physical-installation sentences. Those are pre-existing false-positive limits, not regressions introduced by V53. V53 should not narrow that legacy branch: doing so would also alter intentional cases such as `требование ... пока не установлено` and `гипотеза ... не установлена как факт`. A compatible head-bound replacement would require enumerating both epistemic heads and governed requirement/condition constructions, which is a separate behavior change and needs its own corpus evidence.

The key boundary is the epistemic noun, not the substring `установлен`. Tests should include singular/plural and predicate/adjective order, plus:

- positive established claim: `установленные гипотезы` — must not count as tentative;
- unrelated attributive installation denial: `не установленный компонент` — must not count because of the new adjective branch;
- cross-clause borrowing with an attributive form: `Гипотезы обсуждались; не установленный компонент лежал рядом` — must not count;
- negated epistemic adjective: `не установленные гипотезы` — must count;
- a semantic-verifier false verdict still withholds the answer even when the lexical tentative floor passes.

Mandatory semantic verification still decides whether “unestablished” preserves the source's exact evidence status; the lexical floor only prevents a false discourse rejection.

## 3. Source clarification over query ambiguity

The generation instruction is justified but should be a short specialization of the existing source-clarification and “question is not evidence” contracts, rather than another independent alias policy. Suggested contract shape:

> If the bound original frame explicitly resolves an ambiguous term used in the question, answer with that source-resolved meaning. Do not reintroduce the question's alternative sense. If the frame does not resolve it, preserve the ambiguity.

This keeps authority with the bound frame for the selected retained proposition. It must not use an unrelated adjacent frame, similarity, a dictionary guess, or the question itself to establish an alias. Every generated clause remains subject to the current proposition/action/qualification comparison; a later correct translation cannot cure an earlier incompatible component claim.

Minimum contrasts:

- query uses an ambiguous component, bound frame explicitly clarifies one sense: only that sense is generated;
- same query, frame lacks clarification: answer remains generic/ambiguous;
- an adjacent unselected source sentence clarifies a different proposition: it does not authorize specialization;
- answer first adds the wrong component and later names the right one: verifier rejects it.

## 4. Tentative timing placement

Attaching tentative status to `timing`, `date`, or `proposal` is a good generation-only correction. It avoids the V52 ambiguity in `предложила предварительно рассмотреть`, where `предварительно` can modify the review action. Prefer forms equivalent to:

- `Ada proposed reviewing ...; the timing is tentative.`
- `Ada сделала предложение ...; срок предварительный.`

Do not say that Ada “tentatively proposed” when only `temporal.time.status` is tentative, and do not lower asserted proposal commitment. Preserve source-relative anchor, unknown date, and personal non-adoption/non-arrangement separately. Tests should pair an asserted/proposed plan with tentative time against a truly tentative proposition, ensuring the display label does not migrate between those dimensions.

## Routing scope

No small safe V53 routing fallback is evident. The V52 no-booking candidate was semantically correct and placement-held because its own subject/page did not identify Zephyr. Automatically borrowing Zephyr from the neighboring Bo report would narrow `my device` without source-proven coreference. A future fix should expose source-backed antecedent identity to ownership as explicit authority and retain `uncertain` when that relation is absent; it should not infer identity from proximity or bypass ownership.
