# V73 retention-verifier evidence design — independent second review

## Source-first diagnosis

The V73 built report candidate in trace row 2 is source-faithful. Its immutable text contains Ada as outer reporter, Bo as reported speaker, the permission to send Zephyr QX-100 to a service bench, return-spring tension measurement rather than replacement, and Ada's unread/unconfirmed/not-personally-verified limits. It contains no CJK text.

Trace row 3's verifier accurately interprets all three frame spans and preserves actor, action, property, contrast, attribution, qualification, and affirmed governing report polarity. It then inserts `報告` only into its own `comparison.candidate_meaning` and cites that invented token in an `unsupported_content` mismatch. The runtime accepts the internally consistent negative boolean/mismatch pair and holds the candidate.

This is verifier self-paraphrase contamination. The candidate and source are not defective. A strict candidate-owned mismatch witness would have made the response invalid because `報告` is not a substring of the immutable candidate.

## Recommendation: implement negative mismatch witnesses first

A `selected_predicate_witness` on **every positive verdict is not necessary for this observed failure** and is not the smallest coherent first change. Exact bytes do not prove that a phrase is the governing predicate; the same model still chooses and interprets the phrase. Requiring that shape on every accepted candidate adds schema and output cost to the common path, increases malformed/availability risk for multi-candidate batches, and duplicates the existing frame audit/comparison/polarity elicitation without mechanically improving positive semantic truth.

Implement a mandatory, kind-specific exact witness contract for **every outcome that can hold a candidate**:

- every mismatch attached to a false semantic dimension;
- every source-selected-polarity disagreement with the immutable candidate; and
- every changed-repair-proposition finding, if that remains a distinct hold source.

Keep the current comparison-before-polarity ordering and governing-predicate prompt. Revisit an all-positive selected-predicate witness only if later preserved evidence shows unsafe positive acceptance caused by the verifier selecting the wrong governing proposition. Current evidence shows a false hold, and negative witnesses address it directly.

## Strict witness branches

Each mismatch remains candidate-local inside its verdict. Replace the free mismatch object with strict `anyOf` branches whose null pattern is visible to the provider:

| Mismatch kind | Source witness | Candidate witness | Meaning |
| --- | --- | --- | --- |
| `unsupported_content` | `null` | required exact candidate text or approved metadata pointer | alleged addition must actually exist in the submitted candidate |
| `omitted_scope` | required exact candidate-owned source-frame excerpt | `null` | alleged required source material must actually exist; candidate absence remains a model judgment |
| `changed_value` | required source witness | required candidate text/metadata witness | both compared values are present |
| `changed_action_or_role` | required source witness | required candidate witness | both actor/action/object realizations are present |
| `changed_qualification` | required source witness | required candidate witness | both qualification realizations are present |
| `changed_repair_proposition` | required original-source witness and required current-candidate witness | optional separate repair-original coordinate | original draft is an obligation, never source evidence |

Text witnesses should be `{ frame_id, exact_excerpt }` on the source side and `{ exact_excerpt }` on the current candidate side. `frame_id` is an enum from that candidate's own validated frame. The server verifies a nonempty exact substring within that exact frame/candidate after strict JSON parsing. It must reject foreign candidate/frame IDs, sibling bytes, normalized-but-not-exact text, empty excerpts, and over-cap values.

Metadata witnesses should be a closed union such as `{ metadata_field: 'kind' | 'discourse.commitment' | 'discourse.disposition' | 'epistemic.basis' | 'polarity' | 'time...' | 'relations...', submitted_value: <server-schema value> }`. The server compares the pointer/value to the immutable submitted candidate. Free model-written metadata paraphrases are not witnesses. Only fields that can materially drive the existing gate belong in this list.

### Polarity disagreement

If `source_selected_polarity !== candidate.polarity`, require a negative evidence record with:

- an exact source-frame witness for the source predicate the model classified; and
- the closed candidate `polarity` metadata pointer/value.

This does not prove the model chose the right governing predicate, but it prevents an ungrounded polarity disagreement from carrying no observable source bytes. Equality remains an independent mandatory gate. Invalid evidence produces an invalid verifier response, never acceptance or a repaired polarity.

### Omission and unsupported absence

Absence has no positive substring. Do not invent one:

- `unsupported_content` requires the alleged added candidate bytes and has source witness `null`; complete-source absence remains a model judgment.
- `omitted_scope` requires the allegedly required source bytes and has candidate witness `null`; absence from candidate remains a model judgment.

The null side must be schema-required and exactly null. A nearby surviving phrase, comparison paraphrase, sibling candidate, or repair original cannot fill it. These witnesses ground the claim's present side; they do not mechanically prove corpus-wide absence.

## Repair obligations and ownership

For repaired candidates, `repair_obligations.original` can show that the model changed a draft, but the original candidate is explicitly not evidence. A `changed_repair_proposition` mismatch must therefore cite:

1. exact original **source-frame** bytes supporting the obligated proposition;
2. exact current-candidate bytes showing the change; and
3. optionally, a server-owned pointer/excerpt from the repair original for diagnostic comparison.

The optional repair-original witness can never replace item 1. This prevents a flawed original draft from laundering its own wording into source authority.

All source witnesses are restricted to the verdict candidate's frame IDs. If a required proposition is only in another candidate's frame, the model must treat it as related context and cannot cite it as this candidate's support. The complete original source remains present for semantic reasoning, but witness ownership follows the candidate's submitted proof. Cross-candidate borrowing makes the whole strict verdict invalid.

## Acceptance and failure behavior

Preserve the existing gates:

- exactly one verdict per submitted candidate;
- false semantic booleans correspond exactly to mismatch dimensions;
- source-selected polarity equals immutable candidate polarity;
- repair obligations remain enforced;
- all-positive verdicts require empty mismatches;
- negative verdicts remain final holds;
- no semantic repair or retry.

A semantically negative verdict with a valid witness remains negative. A negative verdict with a missing, foreign, invented, wrongly null, or inconsistent witness is a typed invalid verifier response under the current atomic batch policy. It must not be converted to all-true, have its mismatch discarded, or admit unaffected candidates from that response. The resulting availability/whole-batch cost is real and should be measured; it is preferable to rescuing an ungrounded negative as positive.

`reason_code: null` remains legal for negative verdicts under the existing fallback and is unrelated to witness validity.

## Budget conservation

Do not add excerpts on top of the existing free mismatch allowance. Reallocate each current detail budget into a fixed total, for example:

- source excerpt: up to 72–80 UTF-16 units;
- candidate excerpt: up to 72–80 units;
- short relation explanation: only the remaining fixed allowance.

Null sides do not donate capacity. Keep the current mismatch count ceiling. Reduce free comparison prose if actual strict-schema echoes show the extra keys threaten the unchanged role ceiling; do not raise caller/role caps. Because all-positive verdicts carry no witness objects beyond an empty mismatch array, the common positive path avoids the proposed universal selected-predicate overhead.

For candidates with frame audits, source witnesses should reuse existing `frame_id` enums. Candidate excerpts need no new model-chosen candidate ID because the enclosing verdict already owns one; the server validates against that exact immutable text.

## Minimum controls

1. Exact V73 row-3 response with alleged candidate excerpt `報告`: strict parse or ownership validation fails atomically; no candidate is admitted and no retry occurs.
2. Exact source/candidate with all-positive verdict and empty mismatches: accepted without a universal selected-predicate witness.
3. Valid negative `unsupported_content`, `omitted_scope`, each changed-* branch, polarity disagreement, and repaired-proposition change, each remaining a final hold.
4. Opposite null patterns for unsupported addition and omission; non-null forbidden sides fail schema.
5. Metadata-only commitment/disposition/polarity/time changes use only approved pointer/value shapes and exact submitted values.
6. Repair-original-only evidence fails; source frame plus current candidate is mandatory.
7. Foreign/stale/sibling frame IDs and excerpts, cross-candidate bytes, nonexact Unicode/whitespace normalization, empty and over-cap excerpts, duplicate dimensions, and boolean/mismatch inconsistency all fail atomically.
8. A false proposition with valid witness cannot be rescued by true action/qualification booleans; an invalid witness cannot be dropped to accept the candidate.
9. One- and two-candidate Chat/Responses schemas use strict objects, required nulls, enums and provider-supported `anyOf`, with no `oneOf`/`const` transport regression.
10. Maximum frame-audit plus maximum mismatch branches complete under the unchanged effective ceiling in an exact frozen protocol control; usage is evidence of observed fit, not a universal guarantee.

## Corrections to the initial design

The initial review's negative-witness design is sound, including exact candidate excerpts rather than anchor IDs alone. Narrow it in four ways:

1. Defer `selected_predicate_witness` on every positive verdict. It is not required to prevent the observed comparison self-contamination and adds common-path cost without proving governing-predicate semantics.
2. Treat source-polarity disagreement as a negative outcome that needs its own source-frame plus metadata evidence, rather than requiring a universal positive predicate witness.
3. For `changed_repair_proposition`, require original-source evidence independently of any repair-original pointer; the original candidate is an obligation, not authority.
4. Make absence-side nulls and metadata pointers provider-visible strict union branches, so invalid patterns are rejected before semantic consistency logic.

## Final recommendation

Implement the strict negative mismatch/polarity witness contract first, within the existing verifier call and budget. It directly invalidates the V73 `報告` self-paraphrase finding while preserving every negative semantic gate. Do not add a selected-predicate witness to all positive verdicts in this revision. Preserve complete original source authority, candidate/frame ownership, repair obligations, atomic typed failure, unchanged caps, and no retry. Evaluate whether positive governing-predicate errors remain after this smaller structural change before adding common-path schema fields.
