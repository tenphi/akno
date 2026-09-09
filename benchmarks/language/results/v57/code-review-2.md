# V57 code review, round 2

## Scope

I reviewed the current worktree against `6e0f5bd`, including the untracked `reporting-roles.ts` helper and tests. The review covered the 600-character complete-record boundary, copy/translation language choice, current-retained-prose reporter ordering, Russian coverage roles, generic passive assistant attribution, source-relative time, selected retained content versus private-frame constraints, prompt/receipt versioning, documentation, and the V57 trial plan. I made no implementation edits and ran no provider calls.

## Findings and resolutions

### Medium — the new source-clock quote filter initially mishandled backticks and single quotes

The first reviewed version of `hasSourceRelativeAnchor` stripped a backtick span without capturing its contents, so the intended positive `` `Next month` is understood from this undated note. `` returned `deictic=true`, `anchor=false`, `unknown=true`. It also left bounded straight and smart single-quoted full sentences visible, so both of these incorrectly supplied the new anchor:

- `Example: 'Next month is understood from the source record.' The record has no date.`
- `‘Next month is understood from the source record.’ The record has no date.`

I reproduced those outcomes directly against the current TypeScript at the time of review. The issue affected a deterministic source-clock floor: semantic verification remained mandatory, but the documented distinction between an isolated quoted deictic term and a quoted example was not enforced.

**Resolved.** The current implementation applies a list of capture-group patterns for backticks, guillemets, straight/smart double quotes, smart single quotes, and bounded straight single quotes. It unwraps only content exactly matching the bounded deictic expression and masks every larger quoted span. Tests now include isolated positives and full-sentence negatives for backticks and both single-quote forms, along with negation, source-noun attachment, processing-time, and separated-clause negatives.

### Medium — three new lexical floors initially had incomplete single-quote exclusion

The initial passive-label, reporter-role, and coverage-role implementations masked double-quoted/guillemet/backtick examples but not bounded straight or smart single-quoted examples. This allowed:

- a quoted `Сообщено ассистентом: ...` example to satisfy the generic reporter-presence floor;
- a quoted `Reported by OUTER: INNER said ...` example in current retained prose to manufacture a reporter-chain activation, or a quoted reverse in answer prose to trigger a false hold;
- a quoted `Неизвестно, покрывается ли ремонтом устройство` example to activate the new unresolved repair-instrument rejection.

These helpers are followed by semantic verification, so the defect did not independently authorize publication. It still violated their stated quote boundary and could either remove a deterministic safeguard or cause an avoidable local hold.

**Resolved.** All three current helpers mask the same bounded smart/straight-single forms as their other quotation forms. The tests include quoted source and answer reporter chains, straight/smart-single coverage examples, and generic passive labels with internal bold markers. Apostrophes inside words and names are protected by the surrounding letter/number boundary in the straight-single pattern.

### Medium — copy/translation guidance initially excluded visible status labels from language choice

The first reviewed prompt revision told the generator to inspect retained prose but ignore its visible status label. That contradicted the runtime unit: copy mode materializes the entire canonical current record, including visible labels. A Russian body under an English managed label such as `**Open question:**` could therefore choose copy, after which the existing language policy could correctly withhold the mixed-language text. Generic attribution labels are explicitly translatable prose rather than protected names.

**Resolved.** `ANSWER_RECORD_RENDERING_CONTRACT` now requires mode selection from the complete current readable text, including status and attribution labels, while excluding only the query and private frame. It explicitly requires translation when any readable label needs localization. The new ModelClient integration supplies Russian body text under an English `Open question` label and proves both paths: copy materializes the exact English-labeled current payload and is withheld by the language check; translate localizes the label, passes language checking and mandatory semantic verification, and publishes.

## Current retained prose and private-frame authority

The current `reportingRolesSupported` design is sound as a conservative rejection floor. It obtains the outer speaker from the qualified record metadata, extracts exactly one distinct proper-name inner reporter from the selected current retained prose, strips quoted/code examples, and rejects only a novel explicit `According to INNER, OUTER reported ...` / `По словам INNER, OUTER передала ...` reversal. Zero or multiple extracted inner names defer to semantic verification, as do unrecognized, recursive, and ambiguous constructions.

Using current retained prose for this activation is justified here. The helper cannot approve a block; all locally surviving blocks still undergo complete bound-frame alignment, excerpt selection, and the three semantic dimensions. Requiring the private original frame to repeat the same surface construction would disable first-person and bilingual sources whose roles are faithfully projected into different retained grammar. Keeping the frame out of the local parser also preserves its existing role as a private semantic constraint rather than a source of newly selected answer obligations.

The residual limitation is explicit: a bad but already admitted retained paraphrase could cause an avoidable rejection, and syntax outside the closed patterns defers to the model verifier. This is consistent with the helper's narrow role and is not a semantic approval path.

## Other reviewed boundaries

### Complete-record rendering

The 600-character change applies to the exact current canonical record after removal of only the list marker and boundary whitespace. Visible labels and interior bytes count toward the limit. The one-evidence, one-frame, one-qualified-line, resolved-language, reference/HTML exclusion, strict copy/translate schema, language check, local guards, and source verifier remain unchanged. Tests cover 400, 405, 600, and 601 characters. Longer or ineligible records fall back to legacy composition instead of being withheld. The expanded disclosure unit is documented as a fixed bound, not a promise that every legal 400-character candidate plus every possible label fits.

No public answer or memory schema changes, extra blocks, model passes, retries, or output-ceiling changes were introduced.

### Russian coverage roles

The extension activates only after source prose establishes repair as the covered object and no independent source clause makes repair the coverer. Within that source condition, a same-clause unresolved construction ending in `покрывается ли ремонтом ...` is rejected because instrumental `ремонтом` reverses the coverage provider/object roles. Quote removal and sentence/semicolon/colon/coordinating-clause splitting prevent the tested borrowing cases. A source that independently assigns repair the covering role still defers to full semantic pairing. The helper does not infer component identity or treat floor success as approval.

### Generic passive attribution

The new passive form is limited to a generic assistant source and morphology-bound instrumental `ассистентом`, at a record/clause or visible-label boundary followed by `:` or `·`. It does not admit recipient-ambiguous `Сообщено Ada Marlow`, `Сообщено для Ada Marlow`, negated reporting, a separate device-transfer action, or quoted examples. The same helper is used by the foreign-generic-role check, so Russian passive attribution is valid in Russian output and remains detectable as foreign prose in English output. Positive local admission still reaches the semantic verifier, and a negative semantic verdict withholds it.

### Source-clock construction

The new `understood from` branch binds a bounded English deictic expression as the grammatical subject and requires the source `record`/`note` noun in the same construction. Negation, an unrelated cause, `source record repair`, a separated source phrase, device-pickup/processing anchors, and full quoted examples do not activate it. Existing callers continue to require unknown calendar-clock language independently; the new phrase does not imply an unknown date by itself.

### Selected-record boundary and prompts

The verifier guidance correctly says that complete-record rendering selects every clause of the retained record, not every proposition in its private frame. A frame-only recording act is therefore not a mandatory omission when the retained record merely identifies the person's question; if the retained record or answer selects that act, its actor still requires comparison. The retention prompt's neutral possessive allowance is similarly limited to discourse association and expressly does not establish authorship, invention, completed discussion, or another embedded action.

Cross-language referent, unspecified measurement, reporter order, and coverage-role prompt additions preserve rather than relax the existing semantic checks. They remain fallible instructions, not deterministic guarantees.

### Versioning and evidence identity

The modified generation, answer-verifier, retention-generation, and retention-verifier prompts each receive a new version:

- `answer-generation-v53`
- `answer-verifier-v36`
- `retain-extraction-language-v41`
- `retain-verifier-language-v30`

The language benchmark already records those constants and its review fingerprint binds prompt versions and declared output ceilings. The answer benchmark fixture is updated. The V57 plan keeps the corpus and thresholds unchanged, records the explicit 2,400-token diagnostic answer ceiling, and distinguishes it from the service's existing 1,024-token overlay. The changeset and user-facing language/discourse documentation describe the 600-character bound and unchanged verification path.

## Validation and disposition

I independently ran the four direct helper suites after the fixes: 143 tests passed across `source-clock`, `coverage-roles`, `reporting-roles`, and `answer-record-rendering`. I also ran the focused answer integrations for visible-label language handling and passive attribution: 12 passed with 409 unrelated tests skipped.

The parent reports the final current-tree focused result as 546/4 files and the complete suite as 2,571 tests/141 files, with build/typecheck and lint passing. Its compiled invented boundary control also passed the 600 cap, all quote boundaries, unknown-source-time verification, reporter reversal, generic passive attribution, coverage-instrument integration, negative semantic controls, and source-byte preservation.

All substantive round-two findings are resolved in the current worktree. I found no remaining source-selection bypass, private-frame authority inversion, language-policy exemption, semantic-verifier weakening, retry/pass regression, budget change, or versioning blocker. The implementation is ready to freeze subject to completion of the repository's remaining routine gates.


Frozen runtime 12ba420 passed the final local gate (2,571 tests / 141 files, build/typecheck, lint, knip, format, documentation, smoke, installed-package smoke and repository safety). Build/restart/socket deployment, compiled boundary and source-audit controls, actual-provider strict-schema controls and both CI workflows passed. The declared exposed probes have not yet been graded.
