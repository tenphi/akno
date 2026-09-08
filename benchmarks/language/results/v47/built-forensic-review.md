# V47 built-probe forensic review

Scope: `bench-results/language-built-reliability-v47.json`, its trace, and `tmp/language-built-output-packet-v47.json`, reviewed directly against the invented original sources. I did not read independent grading. I made no runtime edits or live calls.

## Result

- Retention: 2/2 writable cases produced one complete written record each, with no hold, repair, degradation, routing failure or availability failure.
- Answers: 14/16 rows produced accepted answers. Both nulls are duplicate English drafts for the open-question case, rejected deterministically as `protected_value`; both are false holds. There were no provider, language-check or semantic-verifier availability failures.
- I found no accepted unsupported proposition, changed epistemic subject, actor/speaker error, qualification promotion, polarity error, answer-language error or protected-value error.
- V47 fixes the V46 accepted agreement-terms scope error: no accepted answer says that inclusion/exclusion is unestablished by the agreement terms.

## `v17-held-question`, run 1

The retained record is complete and correctly typed as an active open question with commitment `none`, user/Ada attribution, self-attested basis and no invented time. Its readable text preserves whether the agreement includes returning the device after repairs and explicitly says neither coverage nor exclusion is established.

The six accepted answers preserve Ada's unresolved question, the agreement scope, the post-repair return-delivery action and the absence of either established inclusion or exclusion. They use neutral record provenance rather than inventing a personal recording act. None answers the embedded question, asserts a delivery arrangement or exclusion, or attributes nonresolution to the agreement's terms. Russian `доставка при возврате` is less idiomatic than `обратная доставка` but remains the same return-delivery action in context.

One RU→RU explicit answer says `активный открытый вопрос`. This is somewhat technical/awkward, but the original says the question “remains open,” so it does not add ongoing investigative activity or change the proposition. I do not classify it as an error.

### Two false `protected_value` holds

The RU-query → EN-answer inferred and explicit rows generated the same draft:

> The recorded open question attributed to Ada Marlow is whether the Zephyr QX-100 agreement includes returning the device after repairs. It remains unresolved whether the agreement covers or excludes the return delivery.

Both were rejected before semantic verification with `protected_value: 1`. The draft is faithful: `remains unresolved whether ... covers or excludes` keeps coverage and exclusion inside the unresolved interrogative scope and does not assert either predicate.

The deterministic cause is the predicate-denial floor. `containsPredicateDenial` treats bare `excludes` as a denial, while `questionAssertionText` removes only narrower unresolved-question surface forms and does not recognize `remains unresolved whether ... covers or excludes ...`. This is a lexical false positive, not a semantic or source-value error. Writable adequate evidence existed, so both nulls are answer-coverage losses.

## `v17-held-assistant`, run 1

The retained record correctly preserves assistant attribution, preliminary/unverified status, possibility that service includes indicator checking twice per year, and that the assistant had neither studied the contract nor verified the assumption. It remains a tentative `source_report` and is not promoted to a contractual requirement.

All eight answers retain those meanings and roles. Generic assistant labels are localized. `Непроверенный отчёт` is slightly formal and `вариант/сообщение` varies the reporting noun, but each remains a preliminary unverified assistant account. None converts the report into an established condition, invents contract inspection, or changes frequency, action or object.

All assistant answers are marked `partial` despite their blocks passing deterministic guards and semantic verification. As in V46, this is uncovered recall-coverage control metadata, not a rejected or incomplete answer block; static public notes prevent those labels from becoming unverified user-facing claims.

## Bounded next scope

The two losses support extending only the existing typed-question `questionAssertionText` normalization to cover a bounded clause of the form `remains unresolved whether ... covers or excludes ...`. The normalization must stop at sentence/clause contrasts so a separate actual exclusion or denial still reaches `containsPredicateDenial`. The resulting draft must continue through the unchanged semantic verifier; no predicate-denial bypass, retry, model, schema, or gate change is warranted.

The built probe shows the new negative-epistemic document-scope instruction working, but 14/16 answer production remains below the 90% target. Selected-probe evidence is still needed before any full fresh V19 trial decision.
