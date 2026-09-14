# V44 code review — round 2

Reviewed the unchanged V44 boundary against `6668675`, focusing on the requested generated/provided split and proposer-source distinctions. I did not rerun tests or make live calls.

## Disposition

No actionable finding.

The retention call site applies `proposalAgencySupported` only when `options.generated` is true. Exact provided candidates continue through the prior model-free cleaning path and are explicitly covered by the integration regression. The helper receives readable frame evidence, not attribution metadata; a source speaker without a readable proposing construction cannot activate the floor.

A source passive with a bound agent is not mistaken for an anonymous proposal: the same clause satisfies `hasProposer`, so the anonymous-source exemption does not apply. Removing the passive agent from a recognized candidate form is held, while keeping `proposed by Ada Marlow` reaches semantic verification. Independently anonymous proposal clauses only defer cross-clause pairing to that verifier.

Passing the presence floor remains insufficient for acceptance. The answer regression with explicit proposer wording and a negative semantic verdict performs the verifier call and rejects the answer. Retention likewise retains its complete original-source semantic verification after generated cleaning. No schema, model, call count, retry policy, verdict dimension, or gate changed.

Prompt and report versions remain consistent at answer generation/verifier `v41`/`v25` and retention extraction/verifier `v34`/`v21`. The V44 plan accurately records the corrected V43 evidence, unchanged v19 fingerprint/models/thresholds, and freeze-before-probe workflow.

## Finite limit

This is a bounded necessary-presence screen, not general semantic-role parsing. Unrecognized English/Russian morphology, organizational actors, and multiple-proposal coreference remain for the full semantic verifier. The Russian possessive-like `предложение NAME` form can be ambiguous between proposer and recipient for indeclinable names and is therefore only admitted to semantic checking, never certified by this helper. This finite limit is explicit and does not block the reviewed change.
