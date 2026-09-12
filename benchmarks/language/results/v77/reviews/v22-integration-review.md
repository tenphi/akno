# V77 / V22 registry integration review — final

Scope: independent read-only review of the V22 corpus integration, input-review provenance, registry selection, and inherited grading policy. I did not call a provider, alter runtime or tests, or reproduce held-out source content. The initial findings and their original evidence remain in `tmp/language-v77-v22-integration-review-initial.md`.

## Disposition

**Clean for the declared V22 registry integration.** The two initial provenance/consumption blockers and the unsupported scenario-label assertion are resolved. This approves the integrated, independently reviewed input registry and existing gate behavior; it is not approval to run a provider or evidence that the runtime satisfies the semantic gate.

## Recheck of initial findings

### Schema-invalid input review — resolved with a fresh independent review

The malformed initial artifact is preserved at `tmp/language-v22-input-review-before-schema-correction.json` and `benchmarks/language/results/v77/reviews/v22-input-review-initial.json` (SHA-256 `4dce3533...`). A fresh fork-none Sol reviewer independently reviewed the same immutable corpus and authored `tmp/language-v22-independent-input-review.json`.

The canonical temporary and tracked reviews are byte copies of that new artifact, all with SHA-256 `43cf93d1...`. Its reviewer value satisfies every field required by `packages/core/src/bench/language-review.ts:45-56`; its fingerprint is the approved V22 fingerprint; all 22 IDs exactly match the exported corpus; and all 22 decisions are approved with nonempty reasons. Passing it with a V22 report stub reaches the expected later `both splits required` check, while the preserved initial artifact reproduces the original `reviewer` type error.

The new regression at `packages/core/src/bench/language-review.test.ts:193-205` consumes the actual tracked review through `languageReviewPacket`. Its comment correctly limits the test to artifact/contract compatibility and does not present synthetic reports as semantic evidence. `tmp/v77-v22-artifact-contract-final.log` records 82/82 registry/review tests passing; `tmp/v77-v22-artifact-contract-initial.log` preserves the prior schema failure.

### Ambiguous source/review receipt hashes — resolved

`tmp/v22-blind-integration-receipt.json` now separates:

- the initial generated source-file bytes, SHA-256 `36dda319...`;
- the formatted current source file, SHA-256 `d4dd09f8...`;
- the unchanged proposed and blind-packet bytes, SHA-256 `be3be907...`;
- the initial malformed and current valid review hashes; and
- the original receipt hash, which matches preserved `tmp/v22-blind-integration-receipt-before-format-label.json`.

I recomputed each current/preserved hash named by the closure receipt; all match. The imported corpus still hashes to `b0e1d4871ac78007863609b90dd432588d7ef4d8e1c441f1255bdbf7bd564c8a`, so formatting and review correction did not alter source cases.

### Unsupported prior scenario-label equality — resolved

The V22/V21 cross-version label comparison was removed rather than narrowed. It was not part of the approved author contract, and the ten writable label multisets also differ. The final test at `packages/core/src/bench/language.test.ts:35-64` keeps the defensible invariants: exact approved fingerprint, byte-for-structure unchanged V21 development subset, ten writable plus one read-only case in each split, no held-out source-item text reused verbatim from V21, and ten distinct held-out writable scenario labels. The independent source review owns whether those labels represent adequate semantic coverage.

## Registry and grading-policy verification

- `packages/core/src/bench/language-corpus-v22.ts:1-6` mechanically reuses only the V21 development entries and appends the independently authored held-out entries. The exported array is deeply equal to the proposed 22-case packet. Both splits have 11 cases, with 10 writable and one read-only; case IDs are globally unique, item IDs are unique within each case, every case has a nonempty item set, and both query languages are present.
- `packages/core/src/bench/language.ts:48-60,71-114,270-286` carries V22 through the typed options, corpus resolution, corpus fingerprint, and unchanged case runner. `scripts/bench-language.mjs:18-50` permits the explicit CLI value while preserving live opt-in, run bounds, answer ceiling, and output behavior.
- `packages/core/src/bench/language-review.ts:125-151` resolves V22, validates the independently approved fingerprint and exact IDs, and rejects an unapproved case. V22 is included in the source-dimension check, review packet v2 contract, source-entailment policy, zero unsupported-retained/nonnull thresholds, 90% useful-answer threshold, and breakdown reporting (`:194-212,236-282,316-369,520-536`).
- Per-cell grading remains intact: each of eight answer coordinates is independently looked up and checked, while retrieval consistency is shared only across answer language for the same query/view (`packages/core/src/bench/language-review.ts:408-468`).
- Read-only exclusion remains intact: useful retention, retrieval, and answer denominators exclude `expectedHold` cases; the read-only case instead must receive a safe-hold judgment or the admission gate fails (`packages/core/src/bench/language-review.ts:395-426,453-475,513-515`). The thresholds remain retention/retrieval at 80%, answers at 90%, zero source/qualification/language/promotion/source-byte and unsupported-output errors, and no more than 5% case availability failures.
- The reviewed V77 trial plan preserves the V22 two-split/two-run full-gate requirement, explicitly keeps the quarantined V21 held-out split unexecuted, and does not change models, caps, pass/retry count, or acceptance thresholds.

## Practical limits

The corpus fingerprint and independent review freeze this particular packet; mechanical checks cannot establish model competence or future semantic quality. The novelty test rejects exact item-text reuse, not every possible paraphrase, and semantic scenario adequacy remains the independent source review's responsibility. Those are appropriate boundaries for registry integration.

No remaining blocker was found in this scope.
