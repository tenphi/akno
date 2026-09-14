# V74 clock text-repair pre-review

## Scope and disposition

I reviewed `packages/core/src/write/retain-clock-repair.ts`, its integration in
`packages/core/src/write/retain.ts`, `retain-clock-repair.test.ts`, the inherited report-repair
controls, `tmp/language-v73-clock-second-design-review.md`, and `tmp/language-v74-plan.md`. I made
no runtime or test edits and made no provider calls.

The deferred validation, transaction ownership, materialization, language-check, and final
semantic-verification flow is coherent. I found one source-witness blocker and one meaningful mixed
transaction coverage gap. The specialized source analyzer should be closed before the broader V74
review rounds.

## Findings

### P1 — A matched definition can borrow authority from unsafe unmatched source clauses

`sourceClockRepairWitness` searches for the three-sentence definition as a substring of each frame
span (`retain-clock-repair.ts:65-120`). It removes the matched substring, then rejects only a short
catalog of quote and clock words in the residual text (`:97-103`). The right-edge helper recognizes
several immediate correction forms, but it cannot establish that arbitrary text before or after the
match leaves the definition asserted and complete.

The current helper returns a non-null, exclusion-bearing source witness for all of these invented
single-span sources:

```text
Suppose. The original record's date is unknown. Next month means the month after this record,
not after processing. The calendar month cannot be established.

The original record's date is unknown. Next month means the month after this record,
not after processing. The calendar month cannot be established. This definition was withdrawn.

The original record's date is unknown. Next month means the month after this record,
not after processing. The calendar month cannot be established. It is not after delivery.
```

I reproduced those results directly against the helper; the existing `However, this is false.`
control correctly returns null. The first two cases violate the design's conditional/retraction
boundary. The third has a second explicit excluded reference clock that is absent from the witness:
`with_exclusion` remains true, but the only `excluded` coordinate is `, not after processing`.
Consequently, the specialized contract asks the model to preserve only that witnessed exclusion and
does not provide a typed obligation for the delivery clock.

The exact frame still reaches the final semantic verifier, so this does not bypass semantic
verification. It nevertheless makes a server-owned eligibility witness claim more source authority
than its bytes establish and can route a candidate into a shape that cannot represent all known
clock obligations. Reliance on the fallible verifier is not a substitute for the source-side
activation condition required by the preserved design.

The smallest defensible correction is to require the recognized clock definition to consume its
entire witness span apart from horizontal whitespace (or a separately enumerated, semantically
neutral wrapper if one is actually required). Anything else should use ordinary full repair. That
single structural bound handles quotation, sentence-scoping hypotheses/retractions, and additional
excluded clocks without growing another open-ended word list. If surrounding prose must remain
supported, residual text needs its own closed grammar; the present forbidden-word scan is not such a
grammar.

Add English and Russian controls for a sentence-scoping hypothetical, a later withdrawn/denied
definition, and an additional excluded event such as delivery/purchase. Each must return no witness
and must receive the ordinary full-candidate repair shape. Keep the current direct-definition
positives with and without the processing exclusion.

### P2 — The new four-way transaction ownership path has no mixed integration control

`retain.ts:639-674` correctly builds disjoint index enums for report text-only, clock with exclusion,
clock without exclusion, and full-candidate branches, and now passes all branches to `z.union`.
Strict objects and the post-parse duplicate-index check make the implementation plausible. Current
tests exercise each clock arm alone, and the inherited provider test exercises report text-only plus
full repair. I found no test that constructs all four branches in one transaction.

This path deserves a single meaningful integration/transport matrix because the previous two-arm
assumption was changed here. Use noncontiguous original indices and assert:

- the endpoint schema exposes four strict `anyOf` branches with the exact disjoint numeric enums;
- each index is rejected in every sibling repair shape;
- one valid response materializes both clock forms and the report form while preserving the full
  candidate repair, original positions, source/frame bytes, and admitted siblings;
- report and clock prose are included exactly once in the single language judgment;
- duplicate, foreign, missing, malformed, and wrong-shape entries fail the text-bearing transaction
  atomically; and
- a locally valid vector still reaches the existing full-source verifier with each original repair
  obligation.

This is a coverage blocker rather than an observed runtime ownership defect. The current branch
construction itself uses nonoverlapping position sets and strict shapes as intended.

## Confirmed properties

- `cleanSpans` establishes an exact, unique source occurrence before the witness analyzer runs.
  Each returned dimension is cut from one validated frame quote with its frame index and item ID;
  dimensions are not assembled across items. Distinct definitions fail closed.
- Clock readability is deferred rather than accepted. The candidate proceeds through attribution,
  epistemic, agency, source-scope, time-envelope, destination/schema, fiction, and report-uncertainty
  checks. Clock specialization requires generated input, no report-text issue, and raw `relations:
  []`. Re-cleaning catches dedupe and other vector effects.
- The two segment allocations total exactly 400 normalized UTF-16 units including server-owned
  spaces. Required fields are strict, nonempty, single-line, NUL-free, independently capped, and
  terminally punctuated.
- Any report or clock text arm switches the whole repair response to strict `JSON.parse`; truncated
  or trailing output is not salvaged. Branch enums and the duplicate check bind returned deltas to
  original extraction positions.
- Materialization clones the original raw candidate and changes only `text`. The joined prose enters
  the existing language check, the whole vector is re-cleaned, admitted siblings are compared by
  position and deep value, lost repair positions fail, and the original candidate is supplied as a
  repair obligation to the unchanged full-source semantic verifier. A negative verdict remains
  final with no retry.
- The existing 3,200-token repair ceiling and one-repair-call topology are unchanged. The finite
  segment bounds add no unbounded response field.

The finite source grammar will continue to send unfamiliar but faithful clock language through full
repair. That is the appropriate fallback and is safer than treating partial recognition as proof.
