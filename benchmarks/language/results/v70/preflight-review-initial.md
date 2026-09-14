# V70 independent preflight review

Reviewed the V70 plan, frozen provenance, local/deployment/compiled-control evidence, actual-provider protocol receipts, source and built harnesses, capture instrumentation, readiness writer and once-only start guard. This was read-only. I made no provider or semantic-probe call and inspected no private configuration, knowledge base, fresh held-out source, or GitHub content.

## Current disposition

**Pending final readiness, not yet approved for launch.** All presently available evidence is coherent and I found no actionable harness or control defect. The launch must remain blocked until `tmp/v70-postdeploy-check.json` exists and records successful CI `34380970436` on exact frozen SHA `1ceb557224602d132bb3c5944c2ac81ac7d2a696`. Documentation CI `34380970553` is already reported successful.

## Frozen provenance and local evidence

- `HEAD` and `tmp/v70-frozen-runtime.txt` both contain `1ceb557224602d132bb3c5944c2ac81ac7d2a696`; the working tree is clean and `tmp/core-v70` exists.
- `tmp/v70-final-suite.log` reports 3,298 passing tests in 145 files. The preserved review artifacts state build/typecheck, lint, knip, formatting, repository safety, documentation doctor/build, smoke and installed-package smoke passed. I did not rerun or independently claim those checks.
- `tmp/v70-redeploy.log` records a build, restart of `dev.akno`, and an up socket.
- Fifteen named compiled postdeploy groups have nonempty result records. They cover the property schema/enforcement, presentation/repair, 400-unit boundary, translation, source clocks, retention shape, source attachment, semantic negatives, immutable anchors, selection and unchanged source bytes. Stub/compiled controls establish code-path enforcement, not model competence.

## Provider controls

All four declared actual-provider echoes are bound to the frozen SHA and completed once:

- complete-record copy generation;
- the actual two-framed-record verifier with maximum description fields;
- translation-only generation;
- two-candidate retention verification.

Generation, verification and translation entries are `ok`, schema-valid and exact. The retention receipt is `ok` and schema-valid; the readiness writer recomputes exact equality from the returned JSON and original message. The answer-verifier control exercises two evidence IDs, selected/omitted/not-selected categories, a present property and an answer-added property, current source/answer anchors, and negative semantic dimensions. Its 1,063 output tokens are below the unchanged 2,222 caller cap and declared 2,400 role ceiling. These exact echoes validate transport and strict contract shape only; they do not demonstrate semantic competence.

The final provider-visible schema uses strict entry alternatives: an all-null `tested_property:not_selected` branch retains 80+80 operation descriptions, while active property branches require selected/omitted operation shapes and use 50+50 operation plus 30+30 property descriptions. Both alternatives preserve the prior aggregate 160-character allowance. The preserved code reviews and compiled controls reject the provider-invisible dependency found in round one and avoid `oneOf`/`const`.

## Probe matrix and once-only controls

`tmp/run-v70-selected.sh` invokes the source harness with V21 development, one run, exactly eight `v20-held-*` cases (report, hypothesis, counterfactual, exclusion, assistant, fiction, undated, alternatives), all eight language/view coordinates, a 2,400-token answer override and unique V70 output/trace paths: **64 observations**.

`tmp/run-v70-built.sh` invokes the built-package harness with V20 development, one run, exactly four `v19-held-*` cases (report, question, rejected, alternatives), the same coordinate matrix and isolated answer override, and separate V70 paths: **32 observations**. Source and built capture modules retain their intended source-versus-dist imports and append diagnostic trace evidence without changing operation results or adding retries.

Both launchers require `tmp/v70-probes-started.json` and refuse an existing report or trace. `tmp/start-v70-probes.mjs` requires the final readiness receipt, exact clean runtime SHA and this preflight artifact, then refuses an existing start receipt, either report, or either trace before writing the receipt. It inherits the preserved V67 matrix and changes only V70 runtime/time/plan fields. At this review point, no V70 start receipt, report or trace exists, so no semantic probe has started. A failed process after receipt creation remains visible and cannot be silently replaced by an unchanged-runtime rerun.

## Policy consistency and finite limits

The plan keeps Luna runtime, Sol independent review, answer generation/verifier versions 65/45, retention extraction/verifier versions 51/34, current semantic/language/selection gates, one structural repair, no semantic retry, the 2,400 isolated answer ceiling and all acceptance thresholds. The service's unchanged 1,024-token overlay remains outside this evidence. The approved V21 fingerprint remains `208d2ea60ef5f5bcf2158ef56a35e57e1ee6b5c36069ac2fbb606abe1ab1cf44`, and fresh V21 held-out inputs remain unexecuted.

## Finalization condition

After CI `34380970436` succeeds on exact SHA, run the existing readiness writer once. Approve the declared once-only exposed 64+32 launch only if its receipt binds the same clean SHA, both CI jobs, 3,298/145, all fifteen compiled groups, four exact/schema-valid controls, deployment receipt, `modelCompetenceClaimed:false`, and `freshHeldOutExecuted:false`. Any mismatch or pre-existing start/report/trace is a blocker.
