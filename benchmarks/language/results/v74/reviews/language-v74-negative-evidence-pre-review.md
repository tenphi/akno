# V74 retention negative-evidence pre-review

## Scope and disposition

I reviewed only [retention-negative-evidence.ts](../packages/core/src/write/retention-negative-evidence.ts), its verifier integration in [retain.ts](../packages/core/src/write/retain.ts), `tmp/language-v74-plan.md`, and the preserved V73 second evidence design. I made no implementation/test edit or provider call.

**Changes required before the broader code-review rounds.** The candidate/source byte ownership, polarity null/evidence split, strict verifier parsing, and batch-atomic failure path are coherent. I found two candidate-specific scope defects that can validate evidence for a finding the submitted candidate does not actually contain or a repair state it never had.

## Findings

### P1 — absent metadata states can witness alleged added or changed candidate content

[retention-negative-evidence.ts:11](../packages/core/src/write/retention-negative-evidence.ts) builds catalog entries for optional metadata by substituting absence defaults:

- absent `attribution.source_speaker` becomes `null`;
- absent/empty `attribution.chain` becomes `[]`;
- absent `time` becomes `null`;
- absent/empty `relations` becomes `[]`.

Every catalog ID is then accepted by the shared `current` union at lines 26–29, including as the required candidate side of `unsupported_content` and all `changed_*` findings. The local consistency function assumes the enum membership is sufficient and performs no presence check for metadata pointers.

This means a verdict can claim unsupported added content while pointing to `time` whose catalog value is `null`, or to an empty reporter chain/relations list. Those are absence states, not alleged added candidate content. In some cases the property is not present in the submitted candidate object at all; the evidence-coordinate builder synthesized the null value. It also violates the V73 branch contract that changed findings have both compared values present. Such a verdict can hold a candidate despite lacking the candidate-owned present side that the new schema is intended to require.

Use a candidate-witness catalog containing only actual, meaningful present submitted values:

- always-present scalar fields such as kind, subject, polarity, discourse fields, epistemic basis and source role;
- source speaker only when present;
- chain and relations only when nonempty;
- time only when present.

An absent candidate value should use the existing `omitted_scope` branch with `candidate:null`, grounded by the required source witness. It must not masquerade as a present metadata witness. If later semantics need to distinguish an explicit empty collection from an omitted property, add a separate typed absence-state branch rather than making it eligible for `unsupported_content`.

Required controls:

1. `unsupported_content` with pointers to absent time/speaker or empty chain/relations is schema-invalid or consistency-invalid and fails the whole batch.
2. The same fields, when actually present and nonempty, can be candidate witnesses and a valid semantic negative remains held.
3. A source-required value absent from the candidate uses `omitted_scope`, exact source evidence and `candidate:null`.
4. Mandatory scalar pointers remain available, and no model-authored metadata value is added to the response.

### P1 — `changed_repair_proposition` is available for candidates with no repair obligation

The changed-finding enum at [retention-negative-evidence.ts:39](../packages/core/src/write/retention-negative-evidence.ts) includes `changed_repair_proposition` for every candidate. `retentionNegativeEvidence` receives only the candidate and has no knowledge of `repairObligations`. The prompt says this kind concerns repaired positions, but neither its schema nor `consistent` checks that the enclosing candidate ID occurs in the batch's repair obligations.

An unrepaired candidate can therefore receive a valid-shaped `changed_repair_proposition` mismatch with exact source and current candidate witnesses and be held for changing a repair proposition that never existed. Exact ownership of the excerpts does not cure the false premise.

Pass candidate-specific repair-obligation state into the schema builder. Include `changed_repair_proposition` only for a candidate whose ID has a real server-owned repair obligation in this verifier batch; omit that enum value for ordinary candidates. Preserve the existing rule that the source witness comes from the current candidate-owned frame and the repair-original draft is never source authority.

Required controls:

1. An unrepaired candidate returning `changed_repair_proposition` fails the strict response atomically.
2. A repaired candidate may use the branch only with exact source-frame plus current-candidate evidence; the valid negative is final.
3. A repair-original-only excerpt cannot serve as the source witness.
4. Mixed one/two-candidate batches expose the repair-only kind only on the proper candidate-ID branch.

## Requirements that are correctly preserved

### Source and candidate ownership

Source evidence uses a candidate-local `F#` enum and an exact excerpt of at most 80 UTF-16 units. `consistent` checks the unnormalized response bytes with `quote.includes`; frame IDs cannot point to siblings because each verdict branch closes over its candidate's own frame map. Those frames have already been validated against the original source. Candidate text evidence likewise must be a nonempty exact substring of the enclosing immutable `candidate.text`.

The server-owned metadata coordinate table sends values in the verifier input while the model returns only a closed ID. It does not let the model recopy an arbitrary metadata object into evidence. Page routing, origin, evidence projection, comparison prose, span interpretations, related candidates and repair-original drafts have no catalog IDs. Subject, attribution, discourse, epistemic, time and relations are legitimate semantic candidate fields once the P1 presence restriction above is applied.

Exact occurrence proves ownership, not semantic relevance. A model can still choose an irrelevant phrase that happens to occur in the right frame. The unchanged semantic verifier remains a fallible judge of that relationship. This is an acknowledged limit of a witness contract, not authority for automatic acceptance.

### Strict negative branches and polarity

The mismatch union has the intended null patterns:

- `unsupported_content`: source is exactly null; candidate evidence required;
- `omitted_scope`: source evidence required; candidate is exactly null;
- changed findings: source and candidate evidence both required.

All branches are strict objects. The existing dimension/boolean consistency check still requires exactly one mismatch per false semantic dimension and none per true dimension. A positive equal-polarity verdict needs empty mismatches and `polarity_evidence:null`.

Polarity disagreement is independent of the three booleans. It requires an exact candidate-owned source excerpt plus the literal server-owned `polarity` catalog ID; equality requires null evidence. The runtime still compares `source_selected_polarity` directly with immutable candidate polarity and never rewrites it. The excerpt cannot prove that the model selected the correct governing predicate, but it prevents a disagreement with no observable source bytes.

### Atomic failure and negative finality

[retain.ts:1033](../packages/core/src/write/retain.ts) retains strict `JSON.parse`; incomplete/trailing verifier text is not repaired. Verdict objects and all evidence branches are strict. A schema, ownership, polarity-evidence or semantic-consistency failure calls `reportInvalidResponse`, returns no accepted IDs, and makes the entire retention verification unavailable. `verifyCandidates` discards decisions from earlier two-candidate batches when any later batch errors. There is no evidence salvage, semantic repair or retry.

A valid negative evidence object does not become acceptance. False semantic booleans, a supported polarity disagreement, and relationship invalidation after verification remain final holds under the existing paths.

The top-level envelope remains the inherited non-strict `z.object({ verdicts: ... })`; extra top-level keys are stripped. That does not let invalid nested evidence bypass the strict verdict/evidence branches, but a future strict-envelope cleanup would improve uniformity. It is not introduced by this change.

## Budget and transport assessment

The free prose ceiling per changed mismatch remains 240 characters: source excerpt 80, candidate excerpt 80, and detail 80. Unsupported/omitted findings cannot transfer their null-side allowance. The maximum mismatch count remains three. Common all-positive verdicts add only required `polarity_evidence:null` and no witness prose.

JSON keys, frame IDs and union structure add output/schema overhead that the old 240-character detail did not have. Two candidates with maximum frame audits and negative findings already run under the derive role's 2,400-token effective ceiling, regardless of the larger calculated caller request. This is not an intrinsic cap violation, but local stubs do not establish provider fit. Before freeze, capture actual one- and two-candidate Chat/Responses schemas and exercise at least one maximum practical negative response under the unchanged 2,400 ceiling. Record usage as observed fit only; do not raise caps or shorten away required evidence after a failure.

The metadata coordinate table duplicates some candidate values in the verifier input, including potentially nontrivial chain/time/relation objects. Those values were already supplied inside the candidate, and the input context—not output ceiling—is affected. Closed IDs avoid duplicating them again in model output. Measure the delta in the declared budget receipt, but I found no new private-data or public-schema exposure: this remains inside the existing private retention-verifier call.

## Minimum remaining matrix

In addition to the two finding-specific matrices:

1. Replay the V73 `報告` verdict. It cannot provide the invented candidate excerpt and must invalidate the whole response with no retry.
2. Cover every mismatch kind, correct/opposite null patterns, empty/whitespace-only and 80/81-unit excerpts/details, foreign frame IDs, sibling bytes, normalization-only differences and metadata IDs absent from that candidate's branch.
3. Cover equal polarity with nonnull evidence, unequal polarity with null/foreign/incorrect catalog ID, and unequal polarity with valid source evidence. Only the last is a valid final hold.
4. Require source evidence independently for a repaired-proposition finding; a repair-original pointer or comparison prose never qualifies.
5. Use two candidates with different frame and metadata catalogs. Cross-candidate IDs/excerpts fail atomically; verdict omission, duplication and wrong candidate ID retain their existing failures.
6. Assert provider-visible field order and strict `anyOf` branches for singleton and two-candidate Chat/Responses schemas, with no `oneOf`/`const` regression.
7. Confirm all-positive responses need no universal predicate witness and existing accepted candidates retain their behavior.

## Conclusion

The implementation has the right central architecture: negative decisions cite immutable candidate-owned/source-owned material, comparison prose cannot act as evidence, polarity evidence is independent, and invalid evidence fails closed. Before broader review, bind repair-only evidence to actual repair obligations and prevent synthesized absent/empty metadata states from serving as present candidate evidence. Those changes preserve the narrow V73 design without adding calls, retries, public fields or new semantic authority.
