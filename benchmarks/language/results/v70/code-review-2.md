# V70 independent code review — round 2, final

Reviewed the current uncommitted diff against `6444de3`, the declared plan in
[`benchmarks/language/v70-trial-plan.md`](../../v70-trial-plan.md), the production
answer/retention paths, relevant tests, and the prepared compiled controls. This was a read-only review:
I made no runtime or tracked-source edits, called no provider, and did not inspect private configuration,
the live knowledge base, fresh V21 held-out material, or GitHub state.

The initial review and its two findings remain preserved in
[`tmp/language-v70-round2-review-initial.md`](code-review-2-initial.md). Both findings are
resolved in the current tree. I found no remaining blocker to freezing V70.

## Resolved findings

### Medium — the Russian clock instruction originally omitted the undated marker

The initial `ANSWER_RECORD_RENDERING_CONTRACT` recommended
`отсчитывается от времени первоначальной записи`. That literal output did not satisfy the unchanged
source-clock floor, even when a later sentence stated calendar unknownness. The integration fixture used
the stronger source-backed construction and therefore did not expose the mismatch between the instruction
and the local floor.

The current contract at
[`packages/core/src/ops/answer-record-rendering.ts`](../../../../packages/core/src/ops/answer-record-rendering.ts)
now gives the exact procedural construction
`отсчитывается от времени первоначальной записи без даты`. The actor/action and interval, processing-time
contrast, and unknown calendar period remain separate, and the instruction is explicitly conditional on
those qualifications already being in the retained record. No recognition grammar was broadened. The
answer integration test uses this same construction and continues through all existing language, local,
source-alignment, excerpt-selection, and semantic checks.

**Disposition:** resolved without source-authority expansion or a new acceptance path.

### Medium — the first property schema reduced the ordinary operation-description allowance

The initial entry schema used 50-character source and answer operation descriptions in both entry arms.
That preserved 160 aggregate characters only when a tested property was active (50+50 operation and
30+30 property). For an ordinary record whose property was all-null `not_selected`, the former 80+80
operation allowance fell to 50+50.

The current
[`packages/core/src/ops/answer-source-audit.ts`](../../../../packages/core/src/ops/answer-source-audit.ts)
parameterizes the operation cap by the provider-visible entry branch:

- an all-null `tested_property` retains 80+80 operation characters;
- an active, omitted, or answer-added property uses 50+50 operation plus 30+30 property characters.

Both arms therefore retain the previous aggregate limit of 160. The 50/51/80/81 boundary matrix verifies
the local schema, and the Chat Completions and Responses wire tests assert 80 on the incidental branch and
50 on the active branch.

**Disposition:** resolved without changing the role/caller output ceiling.

## Final review

### Tested-property schema and enforcement

The new property decision is structurally independent of `object_and_operation`. Its strict wire shapes
correctly distinguish:

- a present source/answer comparison (`preserved`, `generalized`, or `changed`);
- an omitted answer property, with a source anchor/value and null answer anchor/value;
- an answer-added property, with null source anchor/value, an answer anchor/value, and `changed`;
- a genuinely incidental or wholly unselected property, with all four coordinates/values null and
  `not_selected`.

The round-one correction makes the containing-operation dependency visible during constrained decoding.
The all-null property branch permits the ordinary operation alternatives. A present, omitted, or added
property permits only a selected or omitted containing operation. Thus a property cannot be paired with
an all-null or merely incidental operation and then fail only in a local refinement. The entry arms are
strict and disjoint by property shape; emitted schemas use `anyOf` without `oneOf` or `const`, and require
every property in each branch.

After decoding, `answerAlignmentsSupported` reparses the exact schema, checks every source anchor against
the cited evidence record and every answer anchor against the current block, requires the exact cited
evidence set, and accepts only `preserved` or `not_selected` relations. A negative property relation cannot
be overridden by positive actor/operation/qualification comparisons, all-positive semantic booleans, or
positive excerpt selection. The answer still requires the original three semantic booleans, consistent
negative details, selected retained excerpts, and the full source-frame comparison.

The verifier instructions make the new distinction concrete without treating the private
`source_context` or descriptions as authority: the tested/ measured property is compared separately from
the containing operation and object; broader integrity cannot preserve a specified electrical property;
an absent property is `omitted`; and a substituted or answer-added property is `changed`. The final prompt
cleanup correctly limits the generic incidental-source-anchor rule to actor, operation, and qualification,
because `tested_property` has its own all-null shape. It also refers to the operation/property comparison
descriptions rather than a nonexistent property `detail` field.

The inherited “all categories not selected” and unique/exact evidence-set checks remain parser refinements,
so a provider can still produce a wire-valid but locally invalid all-incidental response. That is a known
fail-closed availability limit, not a semantic acceptance route and not introduced by the property
dependency. It does not block this bounded change.

### Retention and presentation

Retention remains one compact candidate record with a normalized 400 UTF-16-unit cap, immutable original
positions/admitted siblings, at most one structural repair, and mandatory full-source semantic
verification. Allowing short complete sentences inside the record gives a personal epistemic limit room
for its explicit subject without changing the candidate count, source span, repair transaction, metadata,
or acceptance threshold.

The revised report-uncertainty diagnostic accurately describes a confirmation/verification limit that was
not recognized in a closed readable clause. It requests an explicit subject only when that source limit is
personal. It therefore does not turn generic report-level uncertainty into an invented personal
experiencer. The underlying helper and semantic verifier are unchanged, and a repaired candidate still has
to pass the same full-source comparison.

### Complete-record translation and source authority

The counterfactual and clock guidance is a presentation procedure for qualifications already in the
selected retained record. It expressly prohibits adding an absent actor, date, property, plan status,
nonoccurrence, or processing-time contrast. The exact-name instruction copies only a supplied
`named_source_reference` already bound to current readable evidence. Private source frames continue to
constrain interpretation and cannot expand record selection or public prose.

Complete-record rendering remains limited to one selected current record. Copy/translation language
checks, source-clock and discourse floors, immutable source/answer anchors, excerpt selection, and full
semantic verification all remain mandatory. The model, generation/verifier pass counts, retry policy,
2,400-token role ceiling, public API, and source-byte behavior are unchanged.

## Verification

I independently ran the four principal focused files before the final cleanup: 755 tests passed. After the
final fixes I reran the two directly affected files: 193 tests passed, and `git diff --check` was clean.

The root-reported final gate on the same current tree is 3,298 tests in 145 files, with typecheck, lint,
formatting, knip, docs doctor/build, smoke, installed-package smoke, repository safety, and all 15 compiled
prefreeze control groups passing. One inherited control initially navigated the old non-union schema path;
its failure log was preserved and its navigation was corrected. No V70 live provider or semantic probe had
run at review close.

## Limitations

- The larger strict `anyOf` response and extra property descriptions increase JSON overhead under the
  unchanged 2,400-token ceiling. The compiled two-record controls exercise the maximum-description shape,
  but only the declared frozen provider controls can establish transport behavior; neither stubs nor unit
  tests establish model semantic reliability.
- The 30-character per-side property descriptions require concise wording. Exact original and answer
  anchors remain available for full comparison, and malformed or overlong verdicts fail closed. Live
  exposed evaluation must reveal whether this bound causes material availability loss.
- Procedural translation guidance cannot guarantee a faithful draft. Its safety comes from the unchanged
  deterministic and semantic rejection layers; evaluation remains necessary to measure usefulness.

**Final disposition:** clean after the two bounded corrections. I found no remaining source-authority,
anchor-ownership, repair-position, strict-decoding, semantic-gate, retry/pass-count, or public-schema defect
in the reviewed V70 diff.
