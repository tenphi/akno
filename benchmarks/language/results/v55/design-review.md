# V55 bounded design review

## Disposition

The design is coherent and addresses the dominant V54 failures without weakening the three semantic gates, adding a retry, or adding a model pass. The safest unit is a **complete selected proposition**, while immutable references are only coordinates into source and answer text. Neither a sentence ID nor a retained record should itself define the semantic unit.

## Generation contract

Consolidate the accumulated generation guidance around this priority order:

1. The bound original frame controls meaning and resolves any explicit bilingual clarification or contrast.
2. The retained excerpt controls which proposition is selected and relevant to the query.
3. A selected proposition carries its material actor, action/object/mechanism, polarity, and truth-conditional qualification together.
4. If the selected readable content is already in the requested language, preserve it closely; otherwise translate that same proposition faithfully.
5. Do not add a personal writing, recording, approval, or performance event merely to express provenance.

Require one coherent selected proposition per answer block. This would keep the bracket exclusion and its record-scoped nonresolution together when both are selected, keep a hypothetical premise with its consequence, and keep a person's uncertainty limits attached to that person's report. It must not mean “one whole record per block”: one record can contain independent propositions, and unrelated neighboring private content remains omittable. Conversely, the generator should not split one proposition into blocks that independently cite the same evidence and then force each verifier call to treat the other half as omitted.

A shorter priority-ordered contract is preferable to appending another paragraph. Duplicate instructions currently invite incompatible choices between concise selection, complete qualification, neutral provenance, and actor preservation. Consolidation should preserve the existing explicit negative examples but remove repeated prose that states the same obligation differently.

## Immutable source and answer anchors

Server code should segment exact text before either model call and assign opaque, per-call IDs. Source anchors must be derived only from the immutable original frame attached to the cited evidence. Answer anchors must be derived only from the generated current block. The model selects IDs and relations; it never recopies text as a coordinate.

Minimum local validation:

- every cited framed `evidence_id` has exactly one audit entry;
- every source anchor ID exists and belongs to that same evidence record;
- every answer anchor ID exists and belongs to that exact answer block;
- duplicate IDs do not satisfy missing category or evidence coverage;
- foreign-record, foreign-block, stale, and unknown IDs invalidate the verdict;
- the source and answer segment tables themselves are server-owned and are not accepted back as model authority;
- the existing excerpt-selection result and all three semantic booleans remain independently mandatory.

Sentence anchors alone are too coarse for mixed sentences. Preserve exact source clause groups and allow a bounded server-defined subspan/phrase anchor where a sentence contains independent propositions. The model must choose among precomputed IDs; it must not submit offsets or arbitrary substrings. Complete frames remain in the verifier input so a short anchor cannot erase a clarification elsewhere.

Use a bounded full-frame interpretation before the category alignments. It should state the source-resolved selected meaning and any remaining ambiguity, then the actor/object/qualification relations must be judged against that resolved context and the **whole current block**, not merely the chosen answer anchor. This prevents a short answer anchor from causing the V54 fiction false holds when the supposedly missing product or qualifier is present elsewhere in the same block. The interpretation is fallible scratch output and cannot override a negative relation or semantic boolean.

## Null and relation invariants

For each actor, object/mechanism, and qualification category:

- `preserved`, `generalized`, or `changed`: source and answer anchor IDs are both required.
- `omitted`: a source anchor is required and the answer anchor must be null.
- `not_selected`: the answer anchor must be null. The source anchor may be present when locating adjacent source content deliberately not selected, and may be null only when that category has no applicable source content.
- `generalized`, `changed`, and `omitted` are negative and must withhold the block, regardless of positive aggregate prose or booleans.
- `not_selected` is neutral only when the answer truly makes no claim in that category and the retained excerpt did not select it.
- every cited evidence record must contribute at least one non-`not_selected` category; an all-`not_selected` entry is schema-invalid.
- every declared mismatch must agree with a negative category relation and the corresponding semantic boolean; contradictory or missing audit fields fail closed.

A positive relation still does not prove entailment. The existing proposition, action-argument, qualification-scope, and retained-excerpt decisions remain authoritative conjunction requirements. Full-block interpretation may correct a locally poor anchor choice, but it must not turn a real missing actor or modifier into `preserved`.

## Assistant uncertainty repair

The V54 assistant failure is specifically in `hasReportUncertainty`, not reporter recognition. The candidate states that the assistant has not examined the contract or confirmed the assumption and then continues `, and this is/remains a possible contract condition rather than an established requirement`. Extend the closed structure only to consume that same-proposition uncertainty continuation. It must still stop before adversative/retraction language, a new subject, or positive confirmation. Caller-provided candidate behavior and mandatory semantic verification remain unchanged.

## Cost and transport risk

The anchor audit adds schema fields and a server-generated segment table, but removes repeated source and answer quotes of up to 240 characters each. It should therefore reduce verifier output tokens in common cases even after adding a bounded full-frame interpretation. Input grows by the anchor table; bound it per cited record and block, reuse exact text already present rather than duplicating full frames, and apply it only when bound source frames exist.

Keep the configured 2,400-token answer ceiling authoritative. Set explicit limits for the full-frame interpretation and per-category detail, cap the number of source and answer anchors, and include those costs in the existing verifier token calculation. If the complete strict verdict cannot fit, the operation must fail closed as availability; do not drop audit tails, fall back to copied strings, or retry with a smaller schema.

Use provider-compatible strict ordinary objects/enums/arrays. Avoid `oneOf` and new unsupported `const` forms. Missing fields, trailing JSON, contradictory relations, or truncated anchor arrays remain invalid. Batch/call count stays unchanged: one generation call and the existing one first-pass verification call per block.

## Minimum regression coverage

- Exact V54-style translated report: immutable source anchor succeeds without translated/synthesized source text.
- Foreign evidence source anchor, foreign answer-block anchor, unknown/stale ID, and duplicate-ID coverage all fail.
- Each relation/null combination above has a positive or negative schema test.
- `generalized`, `changed`, and `omitted` with otherwise all-true booleans still withhold.
- A short anchor omits a product/actor that appears elsewhere in the same block: full-block comparison may preserve it.
- A genuinely missing proposer or personal negative-action actor remains rejected despite outer attribution elsewhere.
- One coherent exclusion plus nonresolution block passes; splitting the same proposition across two blocks is rejected during generation validation or audited transactionally without becoming availability failure.
- Independent neighboring source detail can be `not_selected` without forcing private disclosure.
- Explicit bilingual clarification controls the selected meaning; query wording and generated readings cannot reopen or resolve ambiguity.
- Assistant negative examination/confirmation followed by the bounded possible-condition continuation reaches semantic verification; positive confirmation, adversative retraction, new-subject continuation, and unrelated coordinated clauses remain held.
- Strict transport tests cover truncation, trailing garbage, missing anchor fields, maximum bounded audit size, and the configured output ceiling.

## Finite limits

Clause segmentation and proposition grouping remain bounded heuristics, not a general semantic parser. The independent verifier still decides meaning from the complete original frame and answer block. This design improves coordinate integrity and composition discipline; it does not certify that a model-selected alignment is correct, and documentation should retain that limitation.
