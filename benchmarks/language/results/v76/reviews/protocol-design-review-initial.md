# V76 provider-control preparation design review — initial

Independent Sol review, read-only. I inspected `tmp/v76-protocol-suite.mjs`, `tmp/v76-capture-four-repair-schema.mjs`, the V75 protocol runner, `tmp/v75-natural-verifier-declaration.json`, and `benchmarks/language/v76-trial-plan.md`. I did not execute `--prepare` or `--live`, call a provider, or approve a semantic probe.

## Disposition

**Clean for declaration preparation.** I found no protocol-design blocker. The ten provider controls may be declared after the reviewed V76 runtime is frozen. Live control execution remains conditional on the script's frozen-HEAD, clean tracked-tree, immutable-declaration, and no-existing-receipt checks, followed by an independent receipt/preflight review. This is not approval to launch the semantic probes.

At review time, `tmp/v76-protocol-declaration.json`, `tmp/v76-protocol-results.json`, and `tmp/v76-frozen-runtime.txt` did not exist, and the worktree still contained the expected V76 tracked changes. Therefore no claim of frozen provenance or completed transport evidence is made here.

## Fixture continuity and bounded changes

The suite still contains ten logical controls: copy generation, the two-record answer verifier, clock translation, positive retention verification, maximum negative retention verification, four-branch retention repair, and four maximum language-audit cases across Chat Completions/Responses and compliant/noncompliant outcomes.

The maximum answer-verifier fixture is taken directly from the independently reviewed V75 natural-sentence declaration. Before declaration, the runner requires exact endpoint-schema equality between the current captured V76 verifier schema and that stored schema, and requires the current Zod schema to parse the complete natural expected value. It then places that expected value into the current capture. This preserves the current owned input/schema while avoiding the repetitive-padding fixture that produced the preserved V75 exact-copy failure. The old declaration's V75 `runtimeCommit` is not treated as V76 provenance; V76 provenance is recorded separately by the new declaration and live receipt.

The four-field repair change is also exact and bounded. `Processing time is not the reference point for «next month».` is **60 UTF-16 code units** (62 UTF-8 bytes), matches the source-defined period, and occupies the existing 60-unit `excluded_reference_clocks` field. With the unchanged 195/90/60/52 field caps and three joining spaces, the first clock repair materializes to 400 units; the 220/110/68 three-field repair plus two spaces also remains 400. The capture asserts all three text-only repairs materialize to exactly 400 and that the complete mixed repair response parses under the actual captured schema.

## Schema, caps, and acceptance

For every fixture, preparation converts the actual captured Zod schema through `toEndpointSchema`, requires zero strict-mode violations, and locally parses the expected response. The natural verifier additionally requires deep wire-schema equality to its reviewed V75 schema. Caller/effective caps remain 2,222 for answer controls, 1,024 for language controls, and capture-defined retention caps under the 2,400 role ceiling. The declaration records caller, role, and effective caps per fixture.

Live acceptance remains strict: provider success, local schema validity, deep exact expected output, expected language-audit status, unchanged caller/effective caps, and successful completion of every recorded transport are all required. A coherent negative language audit must therefore return the declared `noncompliant` result; transport success alone cannot pass it. These are transport/schema/exact-copy controls and make no semantic-competence or universal budget claim.

## Once-only accounting and preservation

Preparation refuses to overwrite a declaration. Live mode reconstructs the declaration and requires byte-exact equality, binds HEAD to `tmp/v76-frozen-runtime.txt`, requires a clean tracked tree, and refuses an existing result receipt. The result receipt is created before the first logical control. Each logical control is saved as `started` before calling the client, and the wrapped transport appends and saves its own `started` entry before the request. Completion or exception is saved after each transport and each logical call. This preserves partial progress and provider endpoint/usage fields if later controls fail.

Provider errors are passed through the existing secret redactor, URL redaction, and a 2,000-character bound. The receipt retains invented expected/output values for exact comparison; these are declared synthetic control data. The final gate requires all ten logical results and every observed transport to complete successfully. It does not rewrite or retry a failed fixture.

## Residual preflight limits

- The current runner checks tracked cleanliness with `--untracked-files=no`, consistent with its use of untracked evidence artifacts. Final readiness must separately hash the frozen source/dist and reviewed declaration so an untracked harness change cannot be mistaken for runtime evidence.
- The runner does not prescribe a fixed endpoint-request count because transport negotiation may vary; it records endpoint counts and every wrapper-observed transport. Final preflight should reconcile those counts with the provider receipts rather than infer a single request per logical control.
- Exact success of the natural fixture remains empirical. Its V75 success supports plausibility, but a V76 failure must be preserved and reviewed rather than replaced or counted as passing.

Subject to those existing preflight obligations, the preparation and once-only control design preserve V75's strictness, caps, accounting, and failure semantics.
