# V76 natural repair amendment — pre-execution review

Independent Sol review, read-only. I inspected `tmp/v76-natural-repair-declaration.json`, its local preparation script, the live runner, the amendment note, the original V76 declaration, and the preserved 9/10 result. I made no provider call and do not approve a semantic probe.

## Disposition

**Approved for one execution of this separately declared transport control.** I found no declaration, schema, provenance, cap, exactness, or once-only accounting defect.

The amendment declaration hashes to `37003af2f13fa09fc2de58cce5438e80fc0aea4ab44757b85e7cbbb892abf7fb`. Frozen runtime, declaration, and current HEAD are `44e6e714f1758948f306ec90cdae9b0d453e3604`, and the tracked tree is clean. No `tmp/v76-natural-repair-result.json` exists at review time.

## Fixture integrity

An exact recursive comparison with the original failed fixture finds only the six declared string changes:

- repair 1: 195-unit proposition, 90-unit source-clock anchor, 52-unit unresolved period;
- repair 2: 220-unit proposition, 110-unit source-clock anchor, 68-unit unresolved period.

Each replacement is complete invented prose, contains no cyclic `silverpine` filler, and has exactly the replaced field's UTF-16 length. No key, index, array count, enum, non-string value, or other field changed. The report text-only branch and full-candidate branch are byte-equivalent to the original expected value. The 60-unit `excluded_reference_clocks` field remains exactly `Processing time is not the reference point for «next month».`

The current capture's endpoint schema is deeply equal to both the amendment schema and the original failed control's schema. The current Zod schema parses the amendment value. The production materializer yields the same three 400-unit composed repair texts. Caller 3,200, role 2,400, effective 2,400, Responses API, model role, and branch count are unchanged.

## Preserved failure and provenance

The declaration binds both original artifacts:

- original declaration SHA-256: `89352e531e0274e79d60cd0583fa763652eb9bf73455275a977cf7182119ce0c`;
- original result SHA-256: `d5d779f311fb84d0081e42d3363e17516d14e417576acfeac3f0e9f335be385c`.

Before a request, the runner rechecks those hashes, frozen/clean HEAD, the original result's `passed:false`, exactly ten original results, exactly nine exact successes, and the sole failed identity/status (`four-branch-retention-repair`, provider-successful and schema-valid but not exact). It also reconstructs the current captured schema, checks exact schema identity, validates the expected value, confirms all 400-unit assemblies, checks unchanged caps, and recursively verifies identical shape and per-string lengths against the original fixture.

This makes the amendment additional evidence. It cannot rewrite or convert the original 9/10 suite into a 10/10 original result.

## Execution and failure preservation

The runner requires explicit `--live`, the exact reviewed declaration hash, and absence of an existing amendment receipt. It writes a `started` receipt before creating the request. Its transport wrapper writes a `started` entry before calling the endpoint, then persists completion or exception with bounded secret/URL-redacted errors and usage. The final receipt retains the exact expected and returned invented values.

Passing requires provider success, strict local schema validity, deep exact equality, exactly one endpoint request, numeric output usage no greater than 2,400, exactly one completed successful transport, caller cap 3,200, and effective cap 2,400. Failure is written before the final assertion and cannot be overwritten or retried by this runner.

The exact-one-endpoint requirement is appropriate for this separately scoped Responses control and matches the original failed fixture's observed transport. If endpoint negotiation changes, the control will fail visibly rather than silently broadening its accounting.

## Evidence boundary

A pass would show that this one natural maximum-field instance transported, parsed, and copied exactly under the current schema and caps. It would not prove semantic competence, universal budget adequacy, or erase the original cyclic-marker failure. A failure must be preserved without another reformulation.

Final readiness should report eleven logical controls and every endpoint: the original ten with their preserved 9/10 result, plus this one separate amendment outcome. Semantic launch remains subject to the remaining compiled, CI, deployment, outcome, and independent preflight requirements.
