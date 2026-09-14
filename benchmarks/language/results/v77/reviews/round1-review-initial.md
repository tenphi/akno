# V77 independent Sol code review — round 1 initial

Read-only review against `1d63519`. I inspected the staged scope in the answer source audit, counterfactual wording, retention cleaning and the new fictional-case identity helper/tests. I made no runtime edit, provider call, or held-out-data access.

## Findings

### High — the new fictional-case witness currently activates through conditional/uncertain prefixes

`packages/core/src/write/fictional-case-identity.ts:5-10,72-85`

The bounded `name` expression can consume `If Ada Marlow` or `Perhaps Ada Marlow` as a multi-token proper name. The negative lookahead applies only at the beginning, then the required capitalized-name tail absorbs the real actor. As a result, sources shaped as `If Ada Marlow proposes ...` and `Perhaps Ada Marlow proposes ...` return `qx-100` even though the design requires these scopes to defer. This is an introduced false admission into the generated-only missing-identifier repair trigger. The initial focused run reproduces both exact failures.

Required correction: make the affirmative introduction grammar exclude these prefix tokens from every possible name capture, or parse the bounded actor after proving an affirmative clause start. Retain direct helper negatives for `If`, `Perhaps`, their Russian counterparts, and longer prefix/name combinations. The full semantic verifier after repair remains necessary but does not make a falsely asserted deterministic source witness acceptable.

### High — a correction after the selected anaphoric sentence can escape the retraction veto

`packages/core/src/write/fictional-case-identity.ts:96-101`

The initial helper test `following retraction` returns `qx-100` for the invented source whose selected support sentence is followed by `Но это неверно.` in the same source item. The source is segmented before the tail check, and the current sentence-based lookup does not reliably expose this mixed-language following correction as a distinct matching sentence. That violates the helper's rejection-only authority boundary: an explicitly retracted same-case proposition can create a mandatory missing-identity repair obligation.

Required correction: reject a bounded unquoted target-item tail after the selected sentence (with exact source offsets), rather than relying only on the segmenter's next-sentence classification. Tests should cover English/Russian correction words after English/Russian targets, whitespace/newline variants, and an unrelated affirmative following sentence that remains allowed.

### Blocking test state — initial focused suite is red

`tmp/v77-focused-initial.log` records 968 passing and 32 failing tests. Most failures are test-only accesses to private `cleanCandidateBatchWithPositions` state through the public cleaner, but the conditional/uncertain-prefix and following-retraction failures above are production defects. The fixture expectations must be rewritten against public held/candidate results; a green rerun is required before this round can close.

## Other reviewed scope

- The actor/qualification diagnostic change preserves local `.max(160)` and emits provider `maxLength:80`; the endpoint/local Unicode boundary tests correctly describe this as a wire restriction rather than a new local check. I found no gate or ownership relaxation there.
- The new purchase-relative counterfactual arm is a separate complete two-sentence recognizer. It keeps the actual nonpurchase and inactive-coverage closure, gender-agreeing adjacent pronoun, quote masking, bounded spans, and unretracted ending; full source semantics remains mandatory. I found no concrete false admission in this arm in the reviewed diff.
- The identity obligation is generated-only and feeds the existing single full-candidate repair. It does not assign a page, mutate an admitted sibling, or make advisory source context authoritative. Those invariants are sound once the two witness-boundary defects are fixed.

## Initial disposition

**Hold round 1** on the two high-severity fictional-case witness defects and the red focused suite. The diagnostic-length and counterfactual changes are clean within their declared limits.
