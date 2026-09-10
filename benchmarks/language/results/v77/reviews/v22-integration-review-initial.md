# V77 / V22 registry integration review — initial

Scope: read-only review of the V22 corpus integration, registry, input-review provenance, and inherited gate behavior. I did not call a provider, edit runtime or test code, or reproduce held-out source text here. The source packet remains identified by corpus fingerprint `b0e1d4871ac78007863609b90dd432588d7ef4d8e1c441f1255bdbf7bd564c8a`.

## Findings

### P1 — the copied input-review artifact is not accepted by the evaluator schema

`benchmarks/language/v22-input-review.json:4` and its temporary source encode `reviewer` as a string. The live input-review schema requires the object declared at `packages/core/src/bench/language-review.ts:45-56`, including `kind`, `id`, `independent:true`, `didNotAuthorCorpus:true`, `didNotTuneRuntime:true`, and `reviewedWithoutOutputs:true`.

I reproduced the failure by passing the tracked review to `languageReviewPacket([], review)`. Parsing stops before report validation with:

```json
{"name":"ZodError","issue":{"expected":"object","code":"invalid_type","path":["reviewer"],"message":"Invalid input: expected object, received string"}}
```

The registry tests do not expose this because `packages/core/src/bench/language-review.test.ts` synthesizes a schema-valid reviewer object. The approved source review therefore cannot currently be used to construct or adjudicate a V22 review packet. This should be corrected by the independent input reviewer, rather than by inferring its attestations in implementation code.

### P2 — the integration receipt's source-file digest is no longer the digest of the named file

`tmp/v22-blind-integration-receipt.json:8-11` names `packages/core/src/bench/language-corpus-v22.ts` and records source SHA-256 `36dda319...`, while the current formatted file is `d4dd09f8...`. The integration script confirms that the receipt hashes the pre-format generated `code` string (`tmp/integrate-v22-inputs.mjs:14-18`). The semantic corpus fingerprint remains correct, so this is provenance ambiguity rather than corpus drift. A closure receipt should preserve and label the initial generated hash and add the current post-format file hash and final input-review hash.

### Resolved during review — prior scenario-label equality was not a valid invariant

The first registry test compared V22 and V21 held-out scenario-label multisets. Both the all-case and ten-writable multisets differ, so narrowing that check to writable cases would still impose an unapproved constraint. Exact corpus fingerprint, unchanged development fingerprint, 10 writable plus one read-only case per split, held-out text novelty, and ten distinct writable held-out labels are the supported mechanical invariants; the independent input review owns semantic scenario adequacy.

Root removed the cross-version equality check and retained those supported invariants at `packages/core/src/bench/language.test.ts:35-64`. The corrected focused run `tmp/v77-v22-registry-tests-reviewed.log` reports 81/81 tests passing.

## Verified integration behavior

- The exported corpus hashes to the approved fingerprint, is deeply equal to the proposed 22-case packet, and preserves the V21 development subset byte-for-structure.
- Each split contains ten writable cases and one read-only case. Case IDs and item IDs are unique; all cases have both query-language entries and nonempty source-item sets.
- `packages/core/src/bench/language.ts:48-60,71-114,270-286` admits V22, resolves it to the new corpus, and preserves the existing per-case runner.
- `scripts/bench-language.mjs:18-50` admits the explicit V22 CLI value without changing run, live-opt-in, answer-ceiling, or output behavior.
- `packages/core/src/bench/language-review.ts:125-151` binds the report and input-review fingerprints and exact case IDs. Its V22 additions retain source-dimension checks, review packet v2, source-entailment adjudication, zero unsupported-output thresholds, 90% useful-answer threshold, and breakdown reporting.
- Gate calculation still excludes the one read-only admission from useful retention/retrieval/answer denominators through `expectedHold`, while requiring every read-only case to be independently judged a safe hold (`packages/core/src/bench/language-review.ts:408-426,453-475,513-515`). Every answer coordinate remains separately adjudicated; retrieval is counted once per query/view across answer languages.
- The copied machine-readable review bytes match their temporary source and the review hash in the initial receipt. The review's schema shape, not its case decisions or hash, is the current blocker.

## Initial disposition

The corpus and registry integration itself is mechanically coherent, and the unsupported scenario comparator is resolved. Freeze should wait for (1) a fresh independently authored, schema-valid input review over the identical fingerprint and (2) an unambiguous post-format/current-review provenance receipt. I will re-review those exact final artifacts before issuing the final disposition.
