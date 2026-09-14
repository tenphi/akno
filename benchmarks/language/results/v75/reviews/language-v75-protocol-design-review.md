# V75 provider protocol design review

## Reviewed declaration

I reviewed `tmp/v75-protocol-suite.mjs` and `tmp/v75-protocol-declaration.json`, whose SHA-256 is:

`465f40be4af3cf0daa4771a1970b5668590c5336288faf596e021ae9f416dafc`

I did not execute `--live`, use provider credentials, or run a corpus.

The declaration contains the same ten logical fixtures as the preserved V74 protocol. After deleting only JSON Schema `pattern` properties, every V75 fixture is structurally identical to its V74 counterpart: expected values, owned inputs, APIs, audit expectations, caller caps and effective caps are unchanged. The negative retention schemas now emit no patterns. The four-branch repair emits only the inherited plain `^[^\\r\\n\\u0000]*[.!]$` pattern; it contains neither a Unicode property escape nor lookaround.

## Findings and resolution

### Unbounded redacted error capture — resolved

The initial runner redacted exact secrets, bearer/API tokens and URLs but retained the resulting string without a bound. The final `safeError` redacts first and then clamps the stored excerpt to 2,000 UTF-16 units. This prevents a provider from expanding the protocol receipt by echoing an entire schema or request. The lack of an explicit truncation flag is a small forensic limitation; the fixed cap is clear in the reviewed runner and does not affect pass/fail logic.

### Incomplete transport outcome on an exception — resolved

The initial transport wrapper saved `status:'started'` and awaited the original method without a local exception handler. A throw could leave that transport permanently started while only the outer logical control was finalized. The final wrapper marks the transport `failed`, stores its bounded redacted error, saves the receipt and rethrows. The final all-pass gate now requires every transport entry to be `completed`, `ok`, and capped correctly.

## Protocol controls

The final runner:

- requires explicit `--prepare` or `--live` and refuses to overwrite either declaration or result;
- regenerates and byte-compares the declaration before live execution;
- requires exact frozen `HEAD`, a clean tracked tree, configured Luna/Responses and the 2,400 role ceiling;
- executes controls sequentially and persists logical and transport starts before each call;
- requires exact JSON equality, local schema validity, expected language-audit status, caller/effective caps and successful completed transports;
- records value, typed reason, usage, endpoint count and bounded redacted error without treating the echoes as semantic evaluation;
- preserves the V74 failed suite and does not retry it under the same runtime.

The three corrected retention fixtures are the necessary production-shape checks: positive verifier, maximum negative verifier, and four disjoint repair branches. The remaining seven unchanged fixtures retain answer, rendering and both API language-audit coverage. Caller ceilings above 2,400 remain explicitly clipped to the role ceiling, matching the declared configuration.

## Disposition

**Protocol design approved for one execution after V75 is frozen, built and deployed on the exact declaration above.** This approval covers strict transport compatibility only. A successful receipt is still required, followed by a separate preflight that verifies frozen source/dist and runner integrity before either 64- or 32-observation semantic probe starts. Any failure must be preserved and reviewed rather than replaced or retried.
