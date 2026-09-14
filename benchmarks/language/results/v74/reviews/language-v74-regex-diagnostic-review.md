# V74 regex differential diagnostic review

## Evidence and scope

I independently reviewed `tmp/v74-regex-diagnostic.mjs` and the exact declaration at `tmp/v74-regex-diagnostic-declaration.json`. I did not execute `--live`, call a provider, inspect credentials/KB/fresh held-out data, or edit runtime/GitHub state.

The declaration contains four controls and hashes to:

`ef8b9217aee3cfc4bf2217e55b9442d03ce955b1ea03a7a17569c3a3801f4fda`

No `tmp/v74-regex-diagnostic-results.json` exists. The original ten-control receipt remains preserved as seven passes and three failures; this diagnostic neither overwrites nor repeats those fixtures.

## Design assessment

The four calls form a useful minimal differential:

1. `plain-sentence` tests the existing terminal/no-control-character pattern.
2. `unicode-content` changes to the exact `[` + `\\p{L}` + `\\p{N}` + `]` pattern shared by the failed retention schemas.
3. `ascii-lookahead` tests lookahead independently of Unicode properties.
4. `ascii-content` tests a simple content pattern independently of both lookahead and Unicode properties.

All four use the identical invented ASCII value, strict one-field object shape, min/max length, Responses API, Luna model, and 400 caller/role/effective cap. Each expected value satisfies its local JavaScript regex. This isolates wire-pattern dialect behavior without conflating it with a larger response, output budget, nested production unions, or multilingual generation.

The `/u` flag used to construct each local `RegExp` is not present in the emitted JSON Schema; only `regex.source` is serialized. The receipt can therefore support conclusions about the literal schema pattern accepted by the endpoint, not about provider support for JavaScript flags. Official documentation's general support for `pattern` does not establish a particular regex dialect.

The result intentionally has no all-pass criterion. That is correct: failures are the desired differential evidence in some outcomes. Every call receives its own started entry and the file is saved before execution and after completion/failure. The runner requires:

- exact declaration-byte regeneration;
- absence of an existing result receipt;
- exact `HEAD` equality with `tmp/v74-frozen-runtime.txt`;
- a clean tree;
- configured Luna/Responses and an explicit 400-token role cap.

It records the redacted error, typed reason, raw value, local schema validity, exactness, usage and endpoint count. Redaction uses the configured base URL, API key and headers as exact secrets and removes residual HTTP(S) URLs. The diagnostic does not try to reconstruct the omitted error from the earlier receipt.

The calls are sequential and each uses a fresh `ModelClient`; no shared compatibility state or parallel prototype patch can contaminate the comparison. They make no language-check call because `outputLanguage:null`, and they do not invoke corpus or semantic paths.

## Interpretation boundary

The strongest outcomes are:

- plain and ASCII-content pass, Unicode-content fails: evidence that the Unicode property escape is incompatible in this endpoint context;
- plain and ASCII-content pass, ASCII-lookahead fails: evidence that lookahead is independently incompatible;
- all three ASCII forms pass while Unicode fails: the common V74 retention/repair suspect is narrowed substantially;
- the plain pattern fails: do not attribute the issue narrowly to Unicode or lookahead;
- all minimal patterns pass: production-schema size/combination remains unresolved and requires a separately declared production-shape differential.

Even a clean differential does not retroactively pass the original three controls and does not authorize corpus probes. Any runtime schema change requires its own review, freeze, deployment, strict controls, and a new declared protocol receipt. Stronger multilingual checks must remain local if their wire regex is unsupported; they must not be silently discarded.

## Disposition

**Approved for one execution of the four declared diagnostic calls using declaration SHA `ef8b9217aee3cfc4bf2217e55b9442d03ce955b1ea03a7a17569c3a3801f4fda`.**

This approval is limited to transport diagnosis. Preserve every result, including partial success or failure, and do not replace or rerun the diagnostic without a newly declared and reviewed amendment.
