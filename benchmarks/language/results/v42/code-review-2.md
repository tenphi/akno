# V42 code review, round 2

Reviewed the final V42 runtime diff, integration regressions, changelog entry, and `benchmarks/language/v42-trial-plan.md`. No production code changed since round 1. I did not inspect fresh V19 outputs or authorize execution.

## Disposition

No actionable blocker remains.

- `runRetain` computes one immutable source-derived reference set before generation and passes the same set to extraction and the sole structural-repair call. Semantic verification receives no reference exemption and continues to compare against the complete original source.
- The actual `ModelClient` regression checks the complete generated `subject` and `text` excerpts in the language request, verifies that only occurring source-backed references are supplied, forces `compliant:false`, and confirms the operation returns no candidates with `language_mismatch`. Exactly two transport requests prove that a negative language verdict triggers neither repair nor retry.
- The repair-path regression separately asserts that extraction and repair receive the same source identifier hint, while the repaired candidate still proceeds through the existing cleaner and semantic-verifier path. Candidate-generated subjects never enter `retentionLanguageReferences`.
- Structured non-generic speaker labels and uppercase-letter/digit source tokens are spelling hints only. They remain untrusted data, are exact-occurrence filtered and budgeted by `ModelClient`, leave all surrounding prose visible, and cannot override the checker verdict. Generic assistant/user labels remain excluded and therefore must be localized.
- Antecedent resolution remains a generation policy constrained by the complete supplied source and exact deciding spans. It provides readable identity before routing but does not select a destination, admit a page, or bypass ownership. Ambiguous references remain unresolved.
- The trial plan accurately preserves V41's exposed evidence, identifies the V19 development probes as exposed, keeps the V19 held-out split fresh, retains the original fingerprint and unchanged models/gates, and requires freeze/redeploy plus independent review before any justified full run. It does not claim the reference hints establish language correctness or semantic reliability.

Finite limits remain explicit. The identifier matcher intentionally misses mixed-case names/titles outside structured speaker metadata, so conservative language false holds remain possible. Antecedent resolution is model-generated rather than a deterministic resolver, so ambiguous or missed identity can still produce an ownership hold; full span, semantic, and ownership checks remain necessary. These limits reduce coverage rather than create acceptance authority.

The root reported build, lint, knip, format, safety, and documentation checks passing, with full tests and smoke/package checks still finishing at review time. I inspected the changed boundary and did not independently rerun that matrix.
