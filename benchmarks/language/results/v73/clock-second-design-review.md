# V73 clock text-repair: second design review

## Disposition

A source-conditioned clock text-only arm is coherent with the V73 report repair architecture, provided activation is based on typed validation state and exact candidate-owned source evidence. It must not be selected merely because the first observed hold has `reason_code: time_unresolved`. The current cleaner returns at that check, before several later checks, so the implementation needs a small validation-order refactor to establish that clock readability is the sole local defect.

This recommendation does not settle the published disagreement over whether the earlier processing-clock contrast was redundant. It supplies a conservative repair path for sources whose exact frame explicitly contains that contrast; the unchanged full semantic verifier still decides whether the repaired output is adequate.

## Activation boundary

Create a private typed deferred issue such as `source_clock_readability` with two independent booleans: `missing_relative_anchor` and `missing_unknown_reference`. It is eligible only when all of the following hold:

1. The candidate is generated, its normalized text is at most 400 UTF-16 units, and its provided time is a valid explicitly-unknown envelope for a frame containing relative calendar language.
2. At least one of `hasSourceRelativeAnchor(candidate.text)` or `hasUnknownReferenceClock(candidate.text)` is false.
3. Every guard before the current clock check has passed.
4. Validation continues past this deferred issue and every remaining per-candidate guard passes, including page/schema construction, noncanonical frame scope, fictional-scope checks, report uncertainty, and agency/qualification floors.
5. Raw `relations` is literally `[]`. This avoids hiding a later relation defect and matches the report text-only safety boundary.
6. A bounded source-side clock analyzer finds the required dimensions in exact discourse-frame text owned by this candidate. Model summaries, the draft, query wording, sibling records, and read-only admitted context cannot activate the arm.
7. The candidate has no deferred report-text issue or other typed issue. A report-plus-clock candidate, or any candidate with multiple local defects, remains on ordinary full repair.

The current control flow requires care: the time readability branch currently `continue`s before candidate construction and before later source-scope checks. Merely recording the issue and admitting the candidate would be wrong. Instead, finish a validation-only path, construct the same candidate value, run all remaining guards, and withhold it at the end if the deferred clock issue remains. Relation processing happens after the loop, so requiring raw empty relations is necessary for calling this a sole local defect without a second validation pass.

## Source-conditioned dimensions

Use a private analyzer over each exact candidate frame span. It may recognize only dimensions explicitly stated within one source item and within that candidate's validated frame:

- deictic period and direction (`next month`/after, `last week`/before);
- source-record attachment;
- unknown or absent source-record date;
- unresolved calendar period;
- zero or more explicitly excluded reference clocks, within a small declared bound.

Do not concatenate a positive anchor from one item with an exclusion from a sibling item. Do not treat quotations, questions, conditions, retractions, generic processing mentions, or a model-provided interpretation as witnesses. The analyzer should return exact item/span coordinates for each recognized dimension, not generated paraphrases.

The specialized branch should activate only when the analyzer recognizes the positive anchor, unknown source date, and unresolved period. If the source explicitly excludes a reference clock, the exclusion-bearing schema arm is required. If it recognizes no exclusion, use the no-exclusion arm. If exclusion evidence is ambiguous, exceeds the finite bound, or cannot be isolated safely, use ordinary full repair. This avoids both inventing an exclusion and silently dropping one.

## Strict output shapes and caps

Use two clock text-only shapes, selected privately from the analyzer result. The model returns only `candidate_index` and complete final-prose sentences; the server clones all original nontext fields and joins the segments with single spaces.

For a source with an explicit exclusion:

| Field | Maximum normalized UTF-16 units |
| --- | ---: |
| `proposition_and_nontemporal_scope` | 195 |
| `source_clock_anchor_and_unknown_date` | 90 |
| `excluded_reference_clocks` | 60 |
| `unresolved_calendar_period` | 52 |
| Three server-owned separators | 3 |
| **Total** | **400** |

For a source with no explicit exclusion, retain three semantic fields rather than requiring empty or invented prose:

| Field | Maximum normalized UTF-16 units |
| --- | ---: |
| `proposition_and_nontemporal_scope` | 220 |
| `source_clock_anchor_and_unknown_date` | 110 |
| `unresolved_calendar_period` | 68 |
| Two server-owned separators | 2 |
| **Total** | **400** |

Every field is required and nonempty in its arm, contains no CR/LF/NUL, and ends in `.` or `!`. The model supplies every semantic character and terminal mark. These allocations are initial implementation bounds, not evidence that every source can fit. If a faithful record does not fit its selected arm, the model must omit the repair; the candidate stays held. Do not truncate or transfer unused allowance between fields at parse time.

The exclusion field must state only analyzer-authorized excluded clocks. A field that reverses direction, substitutes another event, or adds an exclusion is structurally valid prose but still faces the complete local floors and mandatory semantic verifier; exact semantic correctness is not certified by the shape.

## Mixed repair transaction

Keep report text-only, clock-with-exclusion, clock-without-exclusion, and full-candidate repairs as strict disjoint branches. Derive nonoverlapping original-index enum sets from typed eligibility; a candidate index belongs to exactly one branch. Do not dispatch by matching human-readable reason strings. Use the existing atomic strict-JSON behavior whenever any text-delta branch is present, and reject duplicate/foreign indices, trailing data, missing closers, unknown fields, or partial transactions.

For clock deltas, clone the exact original candidate and replace only `text`. Preserve source/support/frame spans, subject/page, attribution, epistemic/discourse fields, polarity, time, relations, and original position byte-for-byte. Re-run the whole repaired vector through frame completion, every cleaner guard, language checking of the joined text, immutable-sibling/lost-position checks, the 400-unit cap, relation checks, and the existing full-source semantic verifier with the original repair obligation. A negative verifier result is final; there is no further repair or retry.

Ordinary full repair remains mandatory when:

- any local issue accompanies the clock readability issue;
- report and clock text issues coexist;
- raw relations is absent, malformed, or nonempty;
- candidate metadata or evidence itself needs repair;
- source dimensions are ambiguous, split across unrelated items, quoted/conditional/retracted, unsupported by the bounded analyzer, or exceed its finite exclusion bound;
- the specialized segment caps cannot carry the proposition faithfully;
- the candidate is caller-provided rather than generated.

## Required controls

1. The exposed invented clock source selects the exclusion-bearing arm. A repair preserving the proposal, both personal negative actions, proposal-only status, after-original-record direction, unknown record date, explicit not-after-processing contrast, and unresolved calendar month survives local cleaning and reaches an independently positive semantic verdict.
2. A source with the same anchor and uncertainty but no explicit excluded clock selects the three-field arm. The wire schema has no exclusion field, and the materialized prose contains none.
3. Omit or empty each required segment; exceed each individual cap; test joined totals 399/400/401; include CR/LF/NUL; remove terminal punctuation. Each fails closed without partial replacement.
4. Reverse before/after, resolve an unknown date, substitute processing as the anchor, exclude a different event, omit one personal negative action, or promote the proposal. Each valid-shaped output still reaches the mandatory semantic verifier and is held under a paired negative verdict.
5. Put clock dimensions in a quotation, question, condition, retraction, unrelated sibling, or different source item. They do not activate the specialized arm.
6. Combine the clock issue with report uncertainty, missing identity/frame, agency, polarity, page, schema, noncanonical discourse, or relation failure. Assert the candidate uses ordinary full repair.
7. Exercise one transaction containing report text-only, both clock shapes, and full-candidate repairs at noncontiguous indices. Verify strict branch ownership, exact indices, duplicate rejection, immutable admitted siblings, and lost-position detection.
8. Capture actual Chat and Responses schemas for singleton and mixed branch sets. Require strict objects, required fields, `additionalProperties:false`, numeric singleton enums, endpoint-supported `anyOf`, unchanged call count/model/caps, and strict parsing of truncated/trailing responses.

## Limits

This shape makes an explicitly witnessed set of clock dimensions harder to omit; it does not prove their translation or semantic attachment. The source analyzer is intentionally finite, so unfamiliar but faithful clocks will continue through ordinary full repair. The 400-unit budget can still be insufficient, and a structurally complete repair can still be semantically wrong. Those outcomes remain honest holds under the unchanged local and semantic gates.
