# V74 protocol correction review

## Reviewed evidence

I independently compared the preserved initial declaration and runner with the corrected files, then checked the current frozen provenance, preparation log, deployment receipt, and compiled-control receipt. I did not run the suite, call a provider, inspect credentials or held-out data, or modify runtime/GitHub state.

The preserved initial declaration remains at `tmp/v74-protocol-declaration-initial.json` with SHA-256:

`0e2af44e7e2a719764d70ddb8302ec26c5b54b8ea69caa6b7936ef628716c3a6`

The corrected declaration is `tmp/v74-protocol-declaration.json` with SHA-256:

`dd7e8a54389dc0a9011471ceda4a3404aeca1493cfedbc00d1e1224aff695e86`

The corrected preparation log independently reports the same new hash and ten declared fixtures. No `tmp/v74-protocol-results.json` exists.

## Correction disposition

The correction resolves the finding from `tmp/language-v74-protocol-design-review.md`:

- Each language capture now declares `expectedAuditStatus` as `compliant` or `noncompliant`.
- Each non-language fixture explicitly declares `expectedAuditStatus: null`.
- The live result records `auditStatus` from the frozen parser.
- The final suite predicate requires exact equality between actual and declared audit status for every fixture.
- It also requires actual top-level caller/effective caps to equal the declaration and checks every captured transport's effective cap against the configured 2,400-token role ceiling.

Thus exact echoed bytes are no longer sufficient if the local language parser interprets those bytes differently. The two positive language fixtures must parse as compliant and the two negative fixtures as noncompliant; malformed or incoherent parsing cannot yield a passing suite receipt.

The configured role is asserted once as `maxOutputTokens === 2400`, and each transport's effective cap is checked against `Math.min(transport.callerCap, 2400)`. The transport receipt does not repeat a separate `roleCap` field, but the global frozen role assertion plus the per-transport effective-cap assertion enforces the intended ceiling. The top-level declaration retains `roleCap: 2400` for all ten controls.

## Frozen launch conditions

The runtime is now frozen, pushed, and clean at:

`1f7309bc851690af3132cc00f0c7272347c7b2de`

`tmp/v74-frozen-runtime.txt` matches `HEAD`. `tmp/v74-redeploy.log` records a successful build, restart, and ready socket. `tmp/v74-compiled-results.json` binds all 21 completed compiled groups to the exact frozen SHA, reports zero provider calls, and passes. The supplied final local suite count is 3,661. Documentation CI `34410279006` is successful; general CI `34410279020` remains in progress at this review time.

The runner still enforces, before any live call:

- regeneration equal to the exact corrected declaration bytes;
- exact `HEAD` equality with the frozen-runtime receipt;
- a clean tracked tree;
- configured Luna answer model, Responses provider, and 2,400 role cap;
- absence of an existing protocol result receipt;
- a started durable receipt before the first call and incremental saves around every logical control and transport.

The correction did not change the ten fixtures, their owned input/schema/expected bytes, the sequential capture order, caller caps, model, pass count, or runtime. The earlier parallel-patching and short-field preparation failures remain preserved as preparation history and are not treated as provider attempts.

## Launch approval

**Approved to launch the single declared ten-control protocol suite using the corrected declaration hash `dd7e8a54389dc0a9011471ceda4a3404aeca1493cfedbc00d1e1224aff695e86`.** This approval is for the protocol-only strict-schema echoes, not semantic probes or model competence.

The still-running general CI is not a defect in the reviewed protocol fixture or its once-only guards; however, no semantic diagnostic probe or final V74 readiness approval should proceed until CI `34410279020` succeeds on the exact frozen SHA and the final readiness receipt records it. Any protocol failure must remain preserved and must not be replaced without a separately declared and reviewed amendment.
