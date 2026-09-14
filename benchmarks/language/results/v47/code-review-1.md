# V47 code review — round 1

Reviewed the working diff against `bbc705d`: answer generation and verifier prompts, shared semantic comparison, source-clock helper/tests, operation regressions, prompt versions, changeset and V47 trial plan. This was a read-only review; I made no runtime changes or live calls.

## Disposition

No actionable correctness or safety blocker found.

The proposal instruction now makes the source-supported actor and proposing/rejecting action explicit before timing and status. It correctly distinguishes that embedded actor from outer report provenance and still instructs generated answers to retain a real outer reporting clause when one source reports another person's proposal. It does not infer an actor from `source_speaker`, does not assign unknown booking agency, and does not weaken the existing deterministic agency floor or semantic action-role comparison.

The negative-epistemic scope instruction addresses the observed error at the right contract layer. It requires comparison of whose knowledge is unresolved and whether the candidate newly assigns nonresolution to a document or its terms. It expressly preserves document-silence/inconclusiveness answers when the original source actually establishes them. Treating an added epistemic subject or means as both unsupported proposition and changed qualification scope is internally consistent; acceptance remains the conjunction of all existing dimensions, so this does not create an alternate acceptance route.

The Russian source-clock addition is narrowly source-bound. It requires an actual source noun (`источник`, `запись`, `заметка`, or `разговор`) immediately followed by `без`, one or two known/calendar modifiers, and `даты`. The tests cover the observed `исходной записи без известной календарной даты`, a shorter source-linked form, an unrelated device date, a near-spelling noun (`датчик`), and the opposite known-date polarity. The operation tests show a matching answer proceeds to mandatory semantic verification and that an unrelated proposition is still rejected there. This is a bounded lexical floor rather than a general temporal parser.

The V46 static public-note boundary is unchanged: model `missing_concepts` and recalled coverage labels continue to control partial outcomes without being interpolated into public notes. No new generated-text passthrough appears in this diff.

Prompt/version alignment is consistent: answer generation `v44`, answer verifier `v28`, retention extraction remains `v36`, and retention verifier advances to `v24` because the shared semantic contract changed. The benchmark expectation reflects the answer versions. There is no schema, model, call-count, retry, semantic-verdict dimension, threshold or gate change.

The changeset and V47 plan accurately preserve the V46 evidence, its corrected 28/32 selected and 15/16 built usefulness accounting, the unexecuted V19 fingerprint, and the rule that exposed accepted errors or substantial losses defer the full trial. The plan does not claim that prompt guidance deterministically guarantees actor or scope correctness.

## Finite limits

The first-sentence proposal instruction is generation guidance, not an enforced surface grammar; source-only grading remains necessary. The source-clock matcher intentionally recognizes a small family of Russian constructions, and the semantic verifier remains responsible for attachment and truth. These limits are stated by the unchanged evaluation workflow and do not constitute a bypass.

The parent reported 354 focused tests passing and the broader checks still in progress at review time; I did not independently rerun them.
