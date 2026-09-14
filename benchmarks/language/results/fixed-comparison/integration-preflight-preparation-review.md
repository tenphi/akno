# Integration preflight preparation review

## Scope

I performed a bounded, read-only static review of `verify-integration.mjs`, `packet.mjs`, and `assemble-grades.mjs`, including their single-arm integration prefix support, against the frozen comparison procedure and `integration/declaration.json`. I did not run the integration, generate model traffic, inspect live outputs or grades, create a selection or preflight approval, or change runtime or harness files.

## Structural assessment

The integration harness is structurally clean, pending completed comparison results, a bound selection, and independent preflight approval.

The integration runner preserves the comparison semantics that matter:

- it uses the same frozen worker and common case procedure;
- it uses the same corpus and source obligations and checks their frozen hashes;
- it requires the same Node version and reconstructs the same derive, answer, embedding, and expansion model policy from configuration;
- it evaluates the full corpus sequentially for two runs with no selective retries;
- it records the same receipt and trace forms through the unchanged worker; and
- its live output remains subject to the shared postvalidator, public-receipt validator, packet formatter, grade assembler, grading contract, and scorer.

The isolated candidate proof is frozen to commit `963bf68e3cd07c687007dceaadb4ebb0434613e6`, along with its package tree, protocol artifact path, Node runtime, ABI, executable, and lockfile hash. The declaration's hashes match the current integration runner, worker, common procedure, freeze helper, postvalidator, public validator, scorer, packet formatter, grade assembler, grading contract, and zero-egress control result.

The live gate correctly requires all of the following before creating `integration/live-started.json` or starting the worker:

- the completed `comparison-final.json` and `comparison-postvalidation.json`, because their hashes must be computed and match `integration/selection.json`;
- a selection whose action is `evaluate-one-integration` and whose candidate commit equals the freshly recomputed isolated-candidate proof;
- an independent preflight approval bound to the exact integration declaration and selection file hashes;
- equality of the frozen candidate proof and live configuration policy; and
- unchanged hashes for every execution, validation, packet, assembly, and grading-contract tool named by the integration declaration.

This prevents live integration from beginning against an absent or substituted comparison result, selection, candidate, config, or analysis tool. The `wx` writes also prevent silently replacing a prior live-start marker, run directory, completed artifact, blind map, packet, or assembled grade.

## Packet and grade assembly parity

`packet.mjs` confines integration reads and writes to the `integration/` prefix, creates a one-entry anonymous mapping for the isolated arm, and otherwise applies the same block, run, split-part, source, public retained-page, answer, retrieval, and coordinate formatting as comparison mode. The anonymous label starts separately from the comparison labels, and the later scorer validates exact mapping and candidate membership.

`assemble-grades.mjs` likewise confines integration artifacts to the prefix while retaining the comparison's four block/run aggregates and `first`/`rest` partition. It validates each initial part against its corresponding packet subset, rejects duplicate or incomplete aggregate case sets, preserves part hashes, and builds the final aggregate from a final part only where one exists. The scorer then requires exactly two hash-bound parts, exact ordered case concatenation, exact grade observation membership, and correction-ledger reconciliation against the preserved initial aggregate.

The integration scorer and postvalidator reviewed previously use the same fixed denominators, worst-block/run coverage thresholds, per-row availability ceiling, and zero-tolerance semantic, qualification, language, promotion, byte, ordinary-control, and replay gates. A pooled result cannot rescue a failing integration block or run.

## Disposition

Structural-clean, pending completed comparison and selection. No concrete validation or prefix-isolation defect was found. Preflight approval should remain absent until the completed comparison score and postvalidation artifacts exist, the one-candidate selection is written and bound to both exact hashes and the isolated commit, and an independent reviewer binds that selection together with the frozen integration declaration.
