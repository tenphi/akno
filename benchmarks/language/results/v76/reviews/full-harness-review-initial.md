# V76 conditional full-trial harness review — initial

Independent Sol review, read-only. I inspected the conditional plan, launch-integrity and start scripts, both split runners, final provenance validator, frozen launch manifest used by the exposed probe, and trace lifecycle validator. I did not inspect fresh V21 held-out contents, execute a provider or benchmark call, prepare a full manifest, or create an approval artifact.

No final full manifest, proceed decision, independent approval, full start marker, split launch receipt, or full output exists at review time.

## Finding

### Medium — final diagnostic readiness is stated incorrectly and is not yet bound to full launch

`tmp/v76-full-trial-plan-draft.md` says the ten declared V76 provider controls must pass and says not to run replacement controls. The preserved evidence is instead:

- the original ten-control suite completed once and failed its deep-exact gate at 9/10;
- the original failure remains preserved;
- one separately declared and independently reviewed natural-sentence amendment then passed;
- readiness must describe eleven logical controls and all endpoint requests without rewriting the original suite as passing.

The current `tmp/v76-full-launch-integrity.mjs` does not bind a final V76 readiness receipt or either original/amendment protocol receipt. Its future proceed decision is checked only for `decision`, `runtimeCommit`, and `freshHeldOutExecutedBeforeDecision`; the independent approval is bound to the manifest, decision, and 96-observation provenance hashes. As written, those artifacts could satisfy the executable launch path without mechanically proving that the proceed decision incorporated the preserved 9/10 failure, successful separate amendment, completed compiled/CI/deployment evidence, and independent readiness disposition.

Before preparing the final manifest, update the plan's control history and bind the final readiness interpretation. The smallest coherent correction is to include the final readiness receipt in the manifest file-hash map and require its runtime SHA and success fields, with that receipt itself hash-binding the original protocol declaration/result, amendment declaration/result, compiled groups, deployment, and exact CI/docs. Alternatively, require and validate those exact hashes directly in the proceed decision and bind that decision as already designed. Do not turn the original protocol receipt into a pass or label the amendment an unchanged retry.

This is a conditional-launch provenance blocker, not a runtime or semantic finding.

## Controls that are sound

### Matrix and runners

The runners invoke the complete V21 `development` and `held-out` splits with `--runs 2`, no case filter, fixed 2,400 answer overlay, separate report/trace paths, and frozen instrumentation. The declared matrix is four separate split/run cells: 11 cases per cell, ten writable and one read-only, eight unique EN/RU query-language × answer-language × explicit/inferred-view coordinates. The validator requires 320 writable and 32 read-only observations in aggregate and keeps read-only production separate.

### Frozen provenance and input review

Manifest preparation derives exact source/dist tree digests from the frozen exposed launch manifest and rechecks both against the current tree. It binds the benchmark, instrumentation, integrity/start/runner/validator/trace-plan files, the final selected V76 report, and the V21 blind-input metadata file. It validates the independent input review's fixed corpus fingerprint, 22 approved cases, and review-without-outputs status without printing held-out content.

The manifest embeds the current derive/answer/embedding/expansion model policy. Luna derive and answer roles must remain enabled at 2,400 tokens. Final reports must reproduce the selected baseline's model map, token limits, thresholds, knowledge language, and all prompt/view version fields.

### Once-only launch behavior

The global start script first runs the complete integrity check and refuses any existing global marker, split receipt, report, or trace. It then writes a durable marker bound to the final manifest and approval. Each split entry reruns integrity, validates that marker, refuses its own prior receipt/output paths, and writes its launch receipt before invoking the benchmark. This preserves a partial start and prevents silent replacement.

The two split scripts use distinct result, trace, receipt, and benchmark temporary paths, so concurrent execution does not merge cell evidence.

### Result and lifecycle validation

The final validator verifies the selected-baseline and blind-input hashes before reading them, reconstructs all 22 case/run rows per split, rejects duplicate case/run or query coordinates, verifies every required coordinate, and records report/trace hashes, availability, source-byte changes, and production counts per cell.

`validateTrace` recognizes the current trace kinds, requires unique lifecycle starts, matching terminal records, exactly one semantic decision for typed model operations, correct language/non-language terminal kinds, and completion of every model call and transport. It records throws separately and rejects unknown fields, schema keywords, lifecycle orphans, and duplicate terminals.

The validator intentionally establishes provenance and production rather than source usefulness. The later independent grading/forensic decision must enforce the stated 72/80 useful-answer threshold, retention/retrieval floor, zero accepted-error requirements, and availability ceiling **for each split/run cell**, without averaging. That separation is coherent as long as the final decision artifacts retain the four individual cell outcomes.

## Disposition

**Hold final harness approval pending the diagnostic-readiness binding and factual plan correction above.** The strict 2-split × 2-run matrix, baseline/input provenance, model/cap checks, start uniqueness, trace lifecycle validation, and final report accounting are otherwise coherent.

Selected V76 results, source-only grades, forensics, completed provenance, an explicit proceed decision, a final prepared-manifest review, and an independently signed approval remain mandatory. This review neither authorizes the full trial nor inspects fresh held-out source content.
