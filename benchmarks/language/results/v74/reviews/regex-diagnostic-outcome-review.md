# V74 regex diagnostic outcome review

## Scope and preserved evidence

I independently reviewed `tmp/v74-regex-diagnostic-results.json`, the declaration whose SHA-256 is `ef8b9217aee3cfc4bf2217e55b9442d03ce955b1ea03a7a17569c3a3801f4fda`, `tmp/v74-regex-diagnostic-live.log`, the three failures in `tmp/v74-protocol-results.json`, the relevant source schemas, and `tmp/v74-local-refinement-experiment.log`. I made no provider or corpus call and did not edit runtime code.

The diagnostic completed exactly four declared calls with one endpoint request apiece:

- `plain-sentence`: exact, schema-valid success;
- `unicode-content`: HTTP 400 `invalid_json_schema`, specifically reporting `[\\p{L}\\p{N}]` is not a regex;
- `ascii-lookahead`: HTTP 400 `invalid_json_schema`, specifically reporting unsupported regex lookaround;
- `ascii-content`: exact, schema-valid success.

The original V74 suite remains seven passes and three request failures. Its missing provider-error detail has not been reconstructed or rewritten. The diagnostic is additional evidence and does not turn any original control into a pass.

## Conclusion

This result isolates two endpoint schema-dialect incompatibilities rather than a generation-budget or semantic-competence failure:

1. the endpoint rejects the emitted Unicode property escape used by `retention-negative-evidence.ts`;
2. it rejects the lookahead used by the clock-repair sentence schema.

The passing plain and ASCII-content controls use the same model, transport, strict one-field object, value, and 400-token cap. Both failures occur as HTTP 400 schema validation before output or usage exists. The evidence therefore explains the shared transport failures without claiming that the earlier omitted error text said the same thing.

The mapping to the failed production fixtures is coherent. Both retention-verifier controls include `exactText` with the Unicode-property regex. The four-branch repair union includes the clock-repair branch, whose `completeSentence` contains both a lookahead and Unicode properties; an invalid nested branch invalidates the submitted schema even if the intended returned branch would be different.

## V75 boundary assessment

The proposed correction is the smallest justified one:

- replace `exactText`'s provider-visible `.regex(hasContent)` with `.refine(value => hasContent.test(value))`;
- keep a provider-compatible plain structural sentence regex for clock repair and add the Unicode letter/number requirement as a local `.refine`.

This retains the existing local `safeParse` behavior and atomic rejection of punctuation-only content while removing only unsupported keywords from the wire schema. The local experiment supports that specific mechanism: the converted wire shape contains `type`, `minLength`, and `maxLength` only for the refined field, while local parsing rejects punctuation-only input and accepts Unicode-letter and numeric input. The ordinary structural clock regex may remain on the wire, provided it contains neither lookaround nor Unicode property escapes; the local refinement must remain in the composed Zod schema used after the response.

This should be implemented only at these schema sites. There is no evidence supporting a global ModelClient schema-lowering rule, removal of local content checks, a public-schema change, a cap/model/pass/retry change, or semantic relaxation. Tests should assert both representations: endpoint JSON Schema contains no `\\p{...}` or lookaround, while local parsing still rejects punctuation-only, newline/NUL, missing terminal punctuation, and overlength values and accepts invented ASCII, Unicode, and numeric content as intended.

## Disposition

The diagnostic outcome is internally consistent and sufficient to proceed with the bounded V75 correction after V74 evidence is preserved. V74 corpus probes should remain blocked; the corrected frozen revision still needs its declared transport controls and normal independent code reviews. No additional V74 provider diagnostic or repeat of the three failed fixtures is warranted.
