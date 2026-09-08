# V51 validation in progress

This revision follows the [validation plan](../../v51-trial-plan.md) after the complete failed V50 results at `6de02db`. Two independent Sol code reviews are clean. Final local validation passed **2,300 tests across 136 files**, build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed-package smoke and repository safety.

The private retention-verdict wire schema now uses a direct object for one candidate and nested `anyOf` for two, with distinct single-value ID enums and strict branches. Source auditing, complete JSON, exact candidate/frame accounting, semantic dimensions, budgets, roles and no-retry rules remain intact. Transport tests reproduce the previous incompatibility and exercise both live request envelopes.

The post-freeze protocol controls will capture the exact compiled verifier schemas using a local extraction stub, then send one invented constant-JSON echo per declared one-/two-candidate shape through the configured provider. This is a deliberate deterministic protocol control, rather than relying on generative extraction to produce a desired number of candidates. It makes no semantic-quality claim, writes no knowledge and remains separate from benchmark scoring. Review round 1's alternative end-to-end control suggestion is preserved.

No V51 live control or corpus result exists at this commit. Build/restart/socket deployment and protocol controls precede the declared exposed probes. Fresh independently approved V20 held-out remains unexecuted; PR #70 remains open and unmerged.
