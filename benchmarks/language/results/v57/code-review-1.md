# V57 code review, round 1

## Scope

I reviewed the current worktree against `6e0f5bd`, focusing on the new `reportingRolesSupported` floor and its answer integration, the repair-as-coverer extension, the 600-character complete-record renderer, source-clock addition, prompt/version changes, and their focused tests. The tree was still being tightened during this pass; I did not run providers or claim the root's in-progress full checks as my own.

## Actionable finding

### Medium — the new bare Russian passive reporter form can invert reporter and recipient

`packages/core/src/ops/answer.ts`, in `hasBoundReporter`, adds:

```ts
(?:сообщено|изложено)\s+${source}
```

For a named indeclinable source such as `Ada Marlow`, `Сообщено Ada Marlow: ...` naturally permits the reading “reported/told **to** Ada Marlow,” rather than “reported **by** Ada Marlow.” The new positive test treats this form as proof that Ada is the reporter. That is unsafe for the exact outer/inner role boundary this revision is intended to protect, and the full verifier has already shown that it can accept ambiguous reporting direction.

Keep the passive form where Russian morphology actually binds the source as instrumental, such as `Сообщено ассистентом`. For an indeclinable proper name, require an explicit by-source construction that is not recipient-like, or keep canonical active generation (`По словам Ada Marlow, Bo Winters сообщил ...`). At minimum add contrasts for:

- `Сообщено Ada Marlow: Bo Winters ...` as recipient-ambiguous and therefore insufficient locally;
- `Сообщено ассистентом: ...` as a valid passive source binding;
- `По словам Ada Marlow, Bo Winters сообщил ...` as the preferred named-source form.

This is a presence-floor correction. It does not require relaxing or replacing semantic verification.

## Other reviewed boundaries

### Current retained prose as a preservation constraint

Using selected current retained prose to discover an explicit outer/inner chain is sound as a conservative rejection floor, provided it remains exactly what the implementation currently does: it may reject a novel explicit reversal, but it cannot approve a block. The retained line is already qualified and source-verified, while the final verifier still receives the original frame and independently decides proposition, action arguments, qualification scope, excerpt selection, and source alignment.

Requiring the original frame to repeat the same surface grammar would disable the intended case because first-person and bilingual original frames often encode the roles differently. A narrower useful alternative is not same-phrase corroboration, but metadata corroboration: activate only when the current retained prose yields an inner named reporter distinct from the qualified outer `source_speaker`, as this helper attempts. The mandatory original-frame verifier remains the authority for whether those roles are truly entailed.

The helper is appropriately fail-open when it cannot extract a chain, strips quoted/code examples, and rejects only the explicit `According to INNER, OUTER reported ...` reversal absent from the retained line. Its known greedy-name issue must be fixed before freeze: modifier words such as `reportedly` must not be swallowed into the candidate name and cause the source chain to disappear. The separate proper-name validation is useful but does not by itself prevent greedy capture.

### Coverage-role floor

The new unresolved Russian pattern catches the observed inversion where `ремонтом` becomes the covering instrument and a component becomes the covered object. It is gated by source prose that already says repair is the covered object and remains only a rejection floor before mandatory semantics. Clause splitting and quote removal prevent the tested sentence/semicolon/colon/coordination borrowing cases.

Its finite limitation should remain explicit: the negative predicate and inversion are linked by a bounded lexical window, not a parser. Unlisted connective forms can evade or overactivate the screen, while the full verifier remains responsible for general action-role equivalence. I did not find a concrete high-frequency false hold beyond that documented finite boundary.

### 600-character complete-record rendering

Raising the eligibility cap from 400 to 600 preserves the pilot's key safety properties:

- exactly one page evidence item and one bound source frame;
- one qualified current line;
- resolved EN/RU output language;
- citation/HTML-like payload exclusion;
- exact server materialization for copy mode or a complete translation;
- mandatory language check, all deterministic guards, source-frame verification, excerpt selection, and semantic dimensions.

The test counts the visible status label inside the cap and checks 600/601 boundaries. The larger bound increases the intentionally disclosed complete retained-record surface, as documented; it does not expose neighboring private frame content. Existing generation and verifier ceilings remain finite. I found no new bypass from the cap increase itself.

### Source-clock and verifier guidance

Adding `understood from` to the existing source-record anchor grammar is bounded by the same record/source noun and optional moment/time/date structure. The new negatives preserve processing-time and unrelated-device anchors as failures. The verifier clarification correctly distinguishes the complete retained record from unrelated propositions in the private frame while retaining the selected question owner.

## Round-1 disposition

The current-record reporting-role floor is a defensible conservative layer when paired with the unchanged full-source verifier; exact original-frame surface corroboration would be counterproductive. The bare `Сообщено NAME` reporter form is an actionable ambiguity and should be narrowed before freeze. The known greedy name capture also needs the root's stated fix and a regression. Apart from those in-progress reporter-boundary issues, I found no semantic-verifier bypass, new retry, source-authority inversion, or renderer-boundary defect in this diff.

## Recheck after round-1 fixes

The actionable passive-attribution finding is resolved in the current worktree. `hasBoundReporter` now admits the new passive form only when the cited record has a generic assistant source and the answer uses the morphology-bound instrumental `ассистентом`; bare `Сообщено Ada Marlow` and `Сообщено для Ada Marlow` are rejected. The construction must start at a record/clause or visible label boundary, end at `:` or `·`, and is screened after quoted spans are removed. The new tests cover negation, quotation, a separate device-transfer action, malformed word order, a positive semantic verdict, and a negative semantic verdict. The latter confirms the local form only passes the attribution floor and cannot bypass mandatory verification.

The foreign generic-role check now calls the same helper with the requested foreign-role expression and generic-role flag. For Russian output, English `assistant` cannot activate the Russian `ассистентом` passive exception; for English output, Russian `ассистентом` remains detectable as a foreign bound reporter. This closes the transitional language-policy regression without creating an exemption for named speakers.

The inner-name repetition is now lazy. In `Bo Winters reportedly said`, it expands only through `Bo Winters`, allowing `reportedly` to be consumed by the modifier grammar; the separate case-sensitive proper-name check still rejects lower-case nominal phrases. The focused source-chain cases cover the observed modifier form and explicit reversals.

**Final round-1 status:** the two reporter-boundary findings from the initial pass are fixed. I found no remaining actionable defect in the revised reporting-role helper or its integration. Its finite limitation remains intentional: unrecognized reporting syntax falls through to the full semantic verifier, while this floor catches only a bounded explicit reversal found from the qualified current record.


Frozen runtime 12ba420 passed the final local gate (2,571 tests / 141 files, build/typecheck, lint, knip, format, documentation, smoke, installed-package smoke and repository safety). Build/restart/socket deployment, compiled boundary and source-audit controls, actual-provider strict-schema controls and both CI workflows passed. The declared exposed probes have not yet been graded.
