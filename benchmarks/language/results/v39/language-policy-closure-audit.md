# PR70 knowledge-language closure audit

Read-only audit of frozen runtime `5759f46` while its complete V39 trial executes. No runtime changes or fresh-output tuning. Existing passing tests are evidence of deterministic contracts, not proof of live semantic quality.

- Configuration supports deliberate `knowledge_language: en` or legacy null and injects it into all model roles, including maintenance. Explicit answer language overrides storage policy; context exposes the resolved storage policy.
- The shared ModelClient applies generation instructions and a bounded language check to generated semantic/prose fields. Original support, discourse-frame, attribution, source and destination structures are not selected as generated prose. Source image extraction explicitly opts out to preserve source language.
- Curator revisions supply an additional schema-specific generated-prose selector for `after` bodies. Exact authorized originals are occurrence-counted across operations; changed or duplicate bytes cannot reuse one original exemption. Invalid selection produces a typed failure before acceptance.
- Provided retention checks the caller's language attestation without model calls or translation, and emits typed missing/mismatch holds without creating a replay receipt. Replay precedes current-policy validation and returns the recorded language/outcome. Restart/rebuild and byte preservation are covered by `packages/core/test/prose-language.test.ts`.
- Generation-only localized speaker/status aids never replace the original semantic fields in verifier input or public evidence. Answer policy remains independent of query/evidence language.

No additional actionable policy bypass was found in these inspected paths. The documented initial scope remains English generated knowledge with English/Russian answers. Exact caller-provided semantics are the caller's responsibility; finite live evaluation and fallible language/semantic model judgments do not establish arbitrary-language or longitudinal reliability. The full V39 gate remains pending.
