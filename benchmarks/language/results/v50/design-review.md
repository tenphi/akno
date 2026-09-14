# V50 bounded design review

## Disposition

The multi-span audit is a sound way to make the existing one-pass semantic decision inspect how a candidate combines source clauses. It should be implemented as a nested, server-keyed audit of every supplied frame span, without asking the model to reproduce coordinates. The current runtime verifies **two** candidates per batch, not three; budget and boundary tests must use that actual batch size.

## Multi-span retention audit

### Recommended payload and schema

For each candidate whose validated `discourse_frame` has more than one span, assign stable internal IDs after cleaning, for example `F1` through `F16`. Scope them under the candidate verdict rather than making them globally unique:

```ts
span_audit: [
  {
    frame_id: enum(candidateFrameIds),
    interpretation: string(max 240 or 320),
    relationship: enum([
      'restatement',
      'clarification',
      'contrast',
      'independent',
      'unresolved',
    ]),
  },
]
```

The input map should carry `{ frame_id, item_id, quote }`; the response should carry only `frame_id`, interpretation, and relationship. Requiring the model to echo quotes or item IDs adds a second fallible byte-copy operation and consumes output without increasing authority. Server-side IDs remain private and are derived only from already validated exact spans.

After Zod parsing, require exact set equality with the expected IDs: same count, every expected ID once, no duplicate, no foreign ID. Preserve current candidate-verdict uniqueness checks independently. For a single-frame candidate, omit `span_audit` entirely and retain the current legacy schema/path as proposed.

The relationship value describes how each source span contributes to the **candidate proposition**, not a pairwise relation to the preceding span. This avoids ambiguity about which span a clarification or contrast targets. The interpretation must explain that target in text. Do not turn `independent` or `unresolved` into an automatic boolean result: an independent span may supply a separate attribution or limitation that legitimately belongs in the complete candidate, while unresolved material may or may not affect the selected proposition. The existing three booleans and mismatch details remain authoritative and mandatory.

### Source and repair authority

- Build the audit from cleaned, validated `discourse_frame` spans and the immutable `source`, never model-returned coordinates.
- For a repaired position, audit the repaired candidate's validated spans against the original source. Continue passing the exact original repair obligation separately. The original candidate is an obligation, not evidence.
- Do not call only support spans “deciding” in code. Audit every supplied frame span; otherwise a model or heuristic silently decides which context matters before verification.
- Missing, duplicate, foreign, or inconsistent span audits should follow the existing malformed verifier path: abort the operation closed with its typed verifier/model failure and no accepted candidates. A complete audit with a semantic negative should hold only that candidate through the existing reason path.

### Output budget

Current `verifyCandidates` slices batches by **2**, and `verifyCandidateBatch` requests `1_024 + candidates.length * 1_200`, at most 3,424 tokens. Two candidates can carry 32 frame interpretations. At 320 characters each, interpretations alone can approach 10,240 characters before comparisons, mismatch details, and JSON structure. The current request is therefore not safely sized for the proposed worst case even though the provider-role ceiling may be higher.

Use a bounded formula based on actual audited span count, for example a fixed verdict allowance per candidate plus an allowance per required interpretation, capped by the configured role ceiling rather than an invented larger ceiling. Keeping interpretations at 240 characters materially helps. The model must still receive enough budget to return the required schema; otherwise valid maximum-size input becomes a predictable typed availability failure.

Minimum budget tests:

- two candidates with 16 spans each verify in one call and request the documented calculated maximum;
- one 16-span plus one single-span candidate requests only the needed audit allowance;
- unknown token telemetry and provider failure aggregation remain unchanged;
- configured ceiling truncation still fails closed and never falls back to a schema without the audit.

## Proposal-agency floor

Extend `unassignedDescription` in `proposalAgencySupported` to recognize the nominal/passive shape `(?:the )?proposed discussion attributed to NAME` and its bounded Russian counterpart if supported. Do not treat `attributed to NAME` as proposer syntax. Existing source activation remains essential: if readable source prose does not identify a proposer, the floor should defer to semantic verification.

Required contrasts:

- Source `Ada proposed discussing ...`; candidate `the proposed discussion attributed to Ada ...` → false.
- Same source; candidate `Ada proposed discussing ...` → true.
- Source `Ada proposed a discussion attributed to Bo`; same candidate with Ada as active proposer → true, despite the nested `discussion attributed to Bo` substring.
- Source only attributes an anonymous proposal to Ada without naming a proposer → floor defers; semantic verifier decides.
- A proposed discussion and a separate attributed report in adjacent clauses must not lend actors to each other.

This remains a presence floor. Identity, multiple proposals, and embedded fictional scope stay with the full verifier.

## Russian coverage-role floor

The observed bad construction makes an instrumental repair phrase the covering means: `покрывается ли ремонтом по гарантии ремонт двигателя`. A structural floor is justified only when all of these are clause-local:

1. the validated source clause makes a repair/service the **covered subject** under a warranty/contract;
2. the candidate clause contains a coverage predicate;
3. the candidate places a repair phrase in instrumental case as the covering means and another repair/service noun as subject/object.

Hold the candidate; do not rewrite or coerce it. Do not activate merely from two occurrences of `ремонт` or from any instrumental noun near `покрывается`. Legitimate source propositions can say that one remedial service covers damage/cost, and a different clause may independently discuss warranty repair. Exact clause boundaries and source activation are load-bearing.

Minimum contrasts:

- Source asks whether `ремонт двигателя покрывается гарантией`; malformed repair-as-instrument candidate → hold.
- Canonical `покрывается ли гарантией ремонт двигателя` and `покрыт ли ремонт двигателя` → pass floor.
- Source explicitly says one repair/remedy covers a cost or damage; faithful instrumental candidate → defer to verifier.
- The malformed phrase appears only in quoted source text or an unrelated clause → do not transfer activation.
- English and caller-provided/model-free paths remain unchanged.

Prefer active/canonical Russian coverage generation as the first defense, but retain this generated-only presence/role floor because V49 showed the semantic model both accepting and rejecting the identical malformed relationship.

## Nominal assistant attribution

Add the bounded nominal form to `hasBoundReporter`, rather than creating a separate acceptance path:

```text
По предварительному/неподтверждённому/непроверенному сообщению ассистента, PROPOSITION
```

The source label must occur inside the nominal attribution phrase, and the proposition must be in its governed clause. This form only satisfies the deterministic attribution floor; tentative language, personal examination/confirmation limits, source roles, and full semantic entailment remain independently checked.

Required negatives include a wrong named reporter, `предварительное сообщение` as an unrelated object, the assistant mentioned in a following clause, and a different source's report followed by the assistant's unrelated action. Preserve the positive where the later sentence repeats that the assistant did not examine or confirm the proposition.

## Span-audit semantic examples

Use behavior tests that exercise actual verifier parsing and acceptance, not prompt snapshots:

1. A two-span report: outer nonverification + inner report. Audit labels them independent limit/report (or clarification as appropriate), all three booleans true → accepted.
2. Same input with the candidate turning personal nonconfirmation into global absence; audit present but qualification boolean false with matching mismatch → held.
3. Bilingual clarification: first span ambiguous, second explicitly clarifies same referent → accepted only with both coordinate audits.
4. Adjacent incompatible values without clarification → unresolved audit plus negative proposition/action verdict → held.
5. Fiction across multiple spans: proposal to discuss is independent from the fictional promise; the promise/recipient/limits remain fictional → accepted only when all selected material is scoped.
6. Duplicate frame text at different item IDs receives distinct server IDs and must produce two audit entries. Coordinate identity cannot be inferred from quote text.
7. Missing, duplicate, foreign, extra, and single-entry-for-two-spans responses all fail the verifier call closed.
8. Repair changes one failed position and preserves another admitted position: each final candidate's audit maps only to its own cleaned frame; original-position obligation remains exact.

## Remaining limit

The relationship enum makes reasoning visible and complete; it does not prove the interpretation is correct. The three semantic dimensions, exact source authority, relation-closure logic, generated-only structural floors, and no-retry policy remain necessary. Documentation should describe this as a required auditable first-pass judgment rather than deterministic semantic proof.
