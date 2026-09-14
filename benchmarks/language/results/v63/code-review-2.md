# V63 independent code review round 2

Reviewed the current prompt-only diff, including the shared proposition and semantic contracts, retention and answer generation wording, answer-alignment instructions, all four version changes, the changeset, [`v63-trial-plan.md`](../../v63-trial-plan.md), and the compiled stub control [`postdeploy-v63-epistemic-object.mjs`](postdeploy-v63-epistemic-object.mjs). I did not edit runtime files or call a provider.

## Finding and resolution

### P1 — stale benchmark prompt-version expectations broke the focused suite — resolved

The first reviewed diff advanced `ANSWER_PROMPT_VERSION` from v57 to v58 and `ANSWER_VERIFIER_PROMPT_VERSION` from v38 to v39 but left `packages/core/src/bench/answer.test.ts:38-39` unchanged. My direct run of:

```text
pnpm vitest run packages/core/src/bench/answer.test.ts
```

failed one of four tests, with actual v58/v39 versus expected v57/v38. This was the only current stale runtime-version assertion found by a repository search; historical frozen result artifacts correctly retain their old versions.

The fixture now expects v58/v39. Re-running `packages/core/src/bench/answer.test.ts` with `packages/core/src/ops/answer-source-audit.test.ts` passes 29 tests in two files. Finding resolved.

## Prompt and authority review

The final wording implements the bounded design without adding source authority:

- `models/semantic-verdict.ts:36-59` treats each material epistemic limit as a complete predicate: grammatical subject/experiencer, exact predicate, object/referent, and clause attachment. It explicitly keeps reading terms, receiving confirmation of a report, and verifying a contractual condition separate. Personal passive/global substitutions remain forbidden.
- The same shared contract preserves a source-stated record as the subject of `does not establish/resolve` while allowing human provenance to scope over that statement without repeating a name in every clause. The adjacent sentence continues to require every personal verification actor and required report attribution. This addresses the V62 exclusion false judgment without making self-attested `source_speaker` metadata a material actor.
- `semantic-verdict.ts:100-146` requires comparison of the epistemic actor, predicate, object/referent, and attachment before booleans. The contractual/physical-state instruction is source-conditioned and expressly excludes inference from nearby vocabulary. It preserves legitimate physical state and status-display clauses.
- `write/retain.ts:60-65` and `ops/answer.ts:222-229` keep contractual sense explicit in the relevant epistemic clause or an unambiguous antecedent. Both warn that confirming a report, verifying a condition, and reading terms differ. They do not prescribe a public schema value, infer a contract from metadata, or use the query as evidence.
- `answer-source-audit.ts:135-166` assigns the actor alignment to the grammatical action actor, experiencer, or source-stated record/note subject rather than automatically to the outer reporter. It assigns epistemic object/scope comparison to existing alignment categories and retains all existing negative-relation rejection.

No lexical floor, schema field, source parsing rule, routing behavior, model call, retry, semantic repair, threshold, or token ceiling changed. Exact original anchors, retained-excerpt selection, all three semantic booleans, mismatch consistency, and `answerAlignmentsSupported` remain mandatory.

## Corrected V62 failure mechanics

The new instruction at `answer-source-audit.ts:157-166` accurately reflects the existing schema and fail-closed paths:

- `omitted` requires `answer_anchor=null` in `alignmentSchema`. An `omitted` qualification with a non-null answer anchor, as in the corrected V62 forensic mechanism, is schema-invalid. Verification becomes unavailable before semantic consistency or alignment support can approve it.
- A present but changed/generalized counterpart uses its actual answer anchor. It remains a supported schema shape but is rejected because `answerAlignmentsSupported` accepts only `preserved` and `not_selected`.
- A schema-valid negative actor alignment with positive semantic booleans is also rejected by `answerAlignmentsSupported`. There is no runtime cross-field relaxation. The new prompt asks the model to emit the corresponding false dimension and mismatch so the verdict is auditable and semantically consistent.

The changeset's statement that negative alignments require matching semantic failures is therefore a model-output contract, not newly added deterministic enforcement. Existing deterministic behavior is stricter for publication: any negative alignment rejects regardless of the accompanying booleans.

## Compiled and test evidence

I independently ran the compiled stub control after the current build. It passed all eight answer cases and two retention cases and reported:

- original-frame and answer-segment byte concatenation preserved;
- changed epistemic object and lost personal actor rejected through supplied negative semantics;
- schema-valid negative actor alignment rejected;
- `omitted` plus non-null answer anchor classified as verification unavailable;
- contractual, physical-state, status-display, and neutral-record positive controls remain available when the supplied verifier supports them;
- no extra model pass and source bytes unchanged.

These are dataflow and fail-closed controls. They do not establish that Luna will interpret the contractual or record-subject distinctions correctly. The V63 plan states that limitation and reserves semantic reliability for the single frozen evaluations.

Additional checks:

- `pnpm vitest run packages/core/src/bench/answer.test.ts packages/core/src/ops/answer-source-audit.test.ts` — 29 tests passed.
- `pnpm vitest run packages/core/src/ops/answer-source-audit.test.ts` before the fixture correction — 25 tests passed.
- `git diff --check` — passed.
- Parent-reported final current-tree gate: [`v63-suite-final.log`](v63-suite-final.log) records 2,722 tests in 143 files passing at 11:08:14 in 26.32 seconds after the version-fixture correction. Build, lint, knip, formatting, documentation doctor/build, smoke, installed-package smoke, and repository checks also passed in the corresponding `tmp/v63-*` logs.

## Limitations and conclusion

The expanded instructions increase prompt input modestly but add no output fields and do not consume a larger output allowance. The main residual risk is model judgment: it may still confuse confirmation of a report with verification of a condition, or may overread a contract mention. The text now gives both positive boundaries and explicitly keeps physical-state/status-display uses valid, without a deterministic vocabulary exemption.

After the version-fixture correction, I find no remaining blocker in the reviewed V63 diff. The implementation preserves source authority, distinguishes personal from record-level epistemic subjects, and keeps every existing rejection and consistency path intact.
