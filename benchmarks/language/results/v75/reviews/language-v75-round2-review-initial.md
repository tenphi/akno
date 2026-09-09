# V75 independent Sol code review — round 2 initial findings

## Scope

I reviewed the seven-file staged diff against `65b62c6`, the V74 failed protocol and four-call regex diagnostic, the V75 trial plan, both production validators and their tests. I ran the two focused test files locally: 85 tests passed. I did not edit runtime/tests, call a provider, inspect held-out inputs, or run a corpus probe.

## Findings

### P2 — a locally invalid clock repair can reach the language provider before the new refinement runs

The wire correction is sound at the eventual transaction boundary: `retain-clock-repair.ts` exports only the inherited single-line terminal-punctuation pattern, while the Zod `.refine` still rejects every punctuation-only segment during `transactionSchema.safeParse` in `retain.ts`.

There is an earlier call-path difference. `ModelClient.chat` invokes `additionalLanguageProse` and then the language audit before returning the repair result to `runRetain`. The current callback delegates to `clockRepairLanguageProse`, which normalizes whitespace and checks only that the clock fields are strings. It does not apply the composed repair schema or the new Unicode-content refinement. Because punctuation-only values are now legal in the provider-visible schema, a response such as a clock segment `"."` can trigger a second language endpoint request before the later local transaction parse rejects it. If that language check fails, the operation can also surface a language failure rather than the malformed repair that caused it.

This does not permit a write or partial repair: the later transaction remains atomic. It does change cost, availability and typed failure ordering for an invalid generated result, contrary to the intended preservation of the existing call behavior.

The bounded correction is to validate the normalized transaction with the same composed local repair schema inside the `additionalLanguageProse` callback before returning excerpts. Invalid local refinements should fail prose selection locally and must not start a language transport. An actual `ModelClient` transport-stub regression should return a punctuation-only clock transaction and prove one endpoint request, no repair/write and no retry. A valid multilingual/numeric clock transaction should still take the existing language path.

## Clean observations

- The two validators preserve their original `min`/`max`, closure and Unicode letter/number policies. Negative evidence also retains its independent exact-substring and `hasContent` checks in `consistent()`.
- Every V75 protocol fixture is structurally identical to its V74 counterpart after removing JSON Schema `pattern` properties. The negative schemas now emit no pattern. The clock branches emit only `^[^\\r\\n\\u0000]*[.!]$`; they emit neither Unicode-property escapes nor lookaround.
- The V74 diagnostic directly establishes both endpoint constraints: the provider rejected `\\p{L}/\\p{N}` as an invalid regex and rejected lookaround as unsupported, while the otherwise identical plain and ASCII-content schemas passed.
- Focused tests cover punctuation-only failures, CR/LF/NUL, missing punctuation, overlength, strict transaction shape, RU/CJK/numeric positives and unchanged negative-evidence atomicity. They do not exercise the real `ModelClient.chat` ordering described above.
- The extraction/verifier version bumps and changeset correctly identify the private wire-contract change; no public schema, semantic gate, repair count, model or token ceiling changes.

## Initial disposition

One bounded call-path fix is required before I can close round 2. Provider compatibility still requires the independently reviewed V75 protocol after freeze; deterministic schema tests do not establish endpoint acceptance.
