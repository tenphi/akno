# V74 protocol declaration/design review

## Scope and status

I independently reviewed `benchmarks/language/v74-trial-plan.md`, the exact declaration in `tmp/v74-protocol-declaration.json`, `tmp/v74-protocol-suite.mjs`, the three capture helpers, the sequential preparation logs, and the locally imported rendering/clock wrappers. I did not execute `--live`, call a provider, inspect configuration credentials or held-out data, or modify runtime/GitHub state.

The declaration currently contains exactly ten logical controls and hashes to:

`0e2af44e7e2a719764d70ddb8302ec26c5b54b8ea69caa6b7936ef628716c3a6`

No `tmp/v74-protocol-results.json` exists. The repository is not frozen yet (`HEAD` is still the V73 evidence commit and staged V74 changes exist), so this is a declaration/design disposition rather than launch approval.

## Finding requiring a bounded runner correction

### Medium — language audit semantics are recorded but not included in the suite pass condition

Location: `tmp/v74-protocol-suite.mjs`, final result construction and `receipt.passed`.

The four maximum-language controls correctly declare exact schema-valid responses and attach `capture.parse`. The runner records:

```js
auditStatus: capture.parse?.(result.value ?? '') ?? null
```

but the final pass predicate checks only `ok && schemaValid && exact`. It never requires the compliant fixtures to parse as `compliant` or the negative fixtures to parse as `noncompliant`. Exact bytes make a mismatch unlikely on the currently prepared source, but the purpose of these controls includes the strict local contract, and a parser/schema drift should not produce a passing receipt merely because the provider echoed the declared bytes.

Add an expected audit status to each language capture/declaration entry, or derive it from the fixture ID, and require it in the per-control/pass assertion:

- compliant fixtures: `auditStatus === 'compliant'`;
- noncompliant fixtures: `auditStatus === 'noncompliant'`;
- non-language controls: no audit-status requirement.

Preserve the current declaration and review any amended declaration/hash before live execution. This is a runner/declaration correction only; it needs no runtime or provider call.

I also recommend making the final pass predicate assert each recorded caller/effective cap equals the declared value and that each logical control completed. Those values are already constructed deterministically, but explicit assertions prevent receipt-writing changes from turning them into documentary fields without gate force. Do not require one endpoint request for the rendering/translation controls: their existing output-language path legitimately invokes the language check in the same logical control. Preserve and disclose every transport entry and endpoint request instead.

## Design verification

### Declared matrix and once-only accounting

The ten controls match the plan:

1. rendering copy;
2. two-record answer verification;
3. structured answer-clock translation;
4. positive retention verification;
5. maximum two-candidate × sixteen-frame negative retention verification;
6. four-branch report/clock-with-exclusion/clock-without-exclusion/full repair;
7–10. 32-hint compliant and noncompliant language audits on Chat Completions and Responses.

The live path requires explicit `--live`, exact declaration regeneration, exact frozen SHA, a clean tracked tree, and absence of the receipt before writing a started receipt. It saves the receipt before each logical call and after every captured transport/result. A failed started result remains on disk and blocks an unnoticed rerun. The runner executes controls sequentially.

The prior preparation failures are preserved and occur before any provider call. The first was caused by concurrent top-level imports patching shared `ModelClient`; the current runner uses awaited sequential wrapper imports and then sequential captures. The second was a fixture-only negative repeat count for a short field; the corrected distinct filler is present, the sequential/corrected preparation logs succeed, and the declaration was written only afterward.

### Strict schemas and owned inputs

All ten declared schemas are strict according to the captured runtime conversion: required fields are present, object branches disallow additional properties, and the schemas avoid `oneOf` and `const`. Dynamic candidate, block, evidence, frame, hint and index IDs come from each captured owned input/schema.

The maximum negative retention fixture has two verdicts, sixteen span-audit entries per verdict, three negative semantic dimensions per verdict, 80-unit exact source/current/detail evidence, and candidate-owned F IDs. The expected object is accepted by the exact captured schema. It is transport/shape evidence only; its invented negative judgment is not model competence.

The repair fixture reaches all four disjoint branches in one captured transaction. The three text repairs materialize to exactly 400 UTF-16 units after the server-owned separators (report fields sum to 398 plus two spaces; exclusion clock fields sum to 397 plus three; plain clock fields sum to 398 plus two). Fields are distinct complete invented sentences. The full candidate remains a separate strict arm. The fixture does not claim that its filler prose is a semantically correct repair.

The two-record answer verifier fills applicable comparison/alignment fields to their declared caps and exercises selected, omitted, not-selected and absent-from-both states. Its expected response remains tied to the captured two-record schema.

### Language maximum shapes

Each language fixture has 32 distinct hint IDs and one exact occurrence per hint. Compliant variants supply exact identifier witnesses for every occurrence and return 32 `supplied_identifier` roles. Negative variants supply no exemptions, return 32 `foreign_ordinary` roles, and point to `h0` as the single coherent negative witness. Both transport APIs are declared independently.

This is the maximum response-record count, which is the output-budget concern. It is not a maximum request-occurrence fixture: repeated occurrences could increase the private input toward the existing 24,000-unit bound but do not increase the 32-role response count. That distinction is acceptable for these output transport controls because local tests own occurrence aggregation and bound rejection.

### Caps and plausibility

The declared caps match existing caller/role behavior:

- language: caller/effective 1,024;
- rendering and answer verification: caller/effective 2,222 under role 2,400;
- retention and repair: callers 3,744, 8,544 and 3,200, each effectively capped at role 2,400.

Expected compact JSON sizes are approximately 1.8–1.9k characters for the 32-hint responses, 5.1k for the maximum answer verifier, 6.6k for the maximum negative retention response, and 2.2k for four-branch repair. These make observed completion under the declared effective caps plausible. Character counts are not token guarantees, and provider reasoning consumes the same output allowance. A successful exact echo will establish observed fit only; any truncation, malformed output, or cap exhaustion must remain a preserved failed control, as the plan states.

The runner records raw returned value, usage, endpoint requests, caller cap, effective cap and each nested transport. It makes no semantic-quality claim. It changes only the API envelope for the declared Chat/Responses language controls while retaining the configured model and role ceiling.

## Readiness disposition

**Bounded correction required before provider calls:** make the four language controls' expected `auditStatus` part of the declaration and pass condition, then preserve the current declaration and independently verify the amended hash/runner.

After that correction, freeze/build/deploy evidence and the existing exact-SHA/clean-tree/absence guards remain required before `--live`. Subject to those steps, I found no further protocol-design blocker. The controls are appropriately described as once-only strict-schema echoes, not semantic grading, reliability evidence, or universal cap proof.
