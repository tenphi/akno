# V47 code review — round 2

Reviewed the final unchanged working diff against `bbc705d`, limited to the source-clock grammar, epistemic subject/scope comparison, proposal-actor generation guidance, public-note boundary, versions and validation plan. I did not rerun the completed checks, make live calls or modify runtime code.

## Disposition

Clean within scope. I found no actionable correctness, safety or contract issue.

- The source-clock addition remains bounded to an actual Russian source noun followed by an unknown-date construction. The negative controls prevent an unrelated device attribute, `датчик`, or a known date from qualifying. Passing the floor still requires the unchanged full semantic verifier.
- The epistemic comparison correctly distinguishes unresolved knowledge from a stronger claim that a document or its terms are silent or inconclusive. Explicit source-supported document absence remains permitted; the prompt does not impose a blanket ban on negative document claims.
- Proposal/rejection generation explicitly binds a readable source actor to the material action while retaining distinct outer-report and inner-proposer roles. It leaves genuinely unspecified booking agency unspecified and does not treat metadata alone as actor evidence.
- The V46 public-note fix is intact. Generated missing concepts and recalled coverage labels still control partial outcomes but only fixed scoped text reaches `AnswerOutput.note`; this diff introduces no other generated-text passthrough.
- Semantic verification remains mandatory after deterministic guards. There is no semantic retry, acceptance override, extra model call, schema change, verdict-dimension change, model change, threshold change or gate change.
- Version alignment is consistent: answer generation `v44`, answer verifier `v28`, retention extraction `v36`, retention verifier `v24`; the benchmark expectation matches.
- The V47 plan and changeset accurately describe the bounded behavior, preserve corrected V46 evidence and the approved unexecuted V19 fingerprint, and retain the rule that exposed errors or substantial losses defer full execution.

The implementation remains intentionally finite lexical and prompt guidance rather than a complete grammar or proof system. Source-only output review and the unchanged zero-error/usefulness gates remain necessary.

The parent reported all 2,153 tests across 133 files plus build/typecheck, lint, knip, formatting, documentation, smoke, installed-package smoke and repository-safety checks passing. I did not independently execute those checks in this round.
