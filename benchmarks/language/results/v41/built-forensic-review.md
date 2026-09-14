# V41 built-probe forensic review

Reviewed `bench-results/language-built-reliability-v41.json`, its trace, and `tmp/language-built-output-packet-v41.json`. This is a forensic review of the exposed built probe, not an independent gate receipt. No fresh V19 held-out output exists or was inspected.

## Result and exact hold cause

The built probe retained 1/2 writable cases and produced 8/16 answers. All eight nulls belong to `v17-held-question`; `v17-held-assistant` retained one record and produced all eight answers.

For `v17-held-question`, extraction reached the language check with exactly these generated prose excerpts:

- `Zephyr QX-100 agreement return delivery`
- `Ada Marlow has no answer to whether the Zephyr QX-100 agreement includes returning the device after repairs; the question remains open, and neither coverage nor exclusion of the return delivery is established.`

Both excerpts are English. `Zephyr QX-100` and `Ada Marlow` are source-exact name/identifier material; the remaining words are ordinary English. The second excerpt faithfully preserves Ada's unanswered question and the fact that neither coverage nor exclusion is established. The first is an awkward but English subject label. The language-check model returned `{"compliant":false}`. `ModelClient` therefore returned `language_mismatch`, discarded the extraction value before structural cleaning, repair, semantic verification, or placement, and the benchmark produced eight downstream nulls from absent evidence.

The supported diagnosis is a false language verdict. The current boolean-only language schema provides no rationale or offending span, so the trace cannot establish *why* the checker made that error. It would be inaccurate to attribute it to a particular token beyond observing that the request supplied no explicit source-reference hints.

## Other built case

`v17-held-assistant` retained a source-report record with assistant attribution, tentative/preliminary and unverified scope, twice-yearly indicator checking, and explicit lack of contract study or verification. Structural repair added readable `unverified` wording, and the unchanged semantic verifier accepted it against the complete Russian source. All eight answers preserve the possibility rather than promoting it to a contractual requirement, localize the generic assistant label, keep the twice-yearly frequency, and avoid the earlier contractual-condition/device-state sense error. I found no accepted content, role, qualification, or language error in this case.

## Bounded improvement direction

Retention currently calls `ModelClient.chat` without `languageReferences`; answer generation supplies source-backed title, speaker, and indexed-identity references. The failed retention check consequently received no `supplied_references`, even though both generated excerpts contain exact source-backed identifiers.

The smallest coherent improvement is to give retention the same one-way reference-hint path using only immutable caller/source authority available before generation:

- structured `sourceItems[].speaker` values, excluding generic translatable role labels;
- exact identifier-shaped tokens present in the original source, such as `Zephyr QX-100`;
- exact admitted page titles or canonical identity labels only when the caller already supplied them as authoritative metadata, not candidate-generated subjects or proposed pages.

`ModelClient` already filters hints to references that occur in generated excerpts, counts them against the bounded request budget, leaves the prose unmasked, and does not override a false verdict. This change would not authorize mixed prose or create a retry. Add an end-to-end retention regression that inspects the check payload for `Ada Marlow` and `Zephyr QX-100`, then confirms a deliberately false checker verdict still holds the operation. A positive stub can verify the same English question reaches cleaning and semantic verification.

If stronger observability is desired later, the language-check schema could require a short cited offending span for `compliant:false`. That would distinguish actual foreign prose from an unexplained verdict in future evidence, but it should remain fail closed on malformed output and should not by itself override a model rejection.

The gate, model, and no-retry policy need no change. This probe is too weak for a full trial because one false first-pass language verdict erased an otherwise faithful case and half of the answer matrix.
