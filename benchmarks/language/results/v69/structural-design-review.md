# V69 structural design review

Scope: read-only design review of the frozen V68 helper and repair paths, using only exposed V68 evidence. No provider call, implementation edit, or fresh held-out access.

## Recommendation

The three V68 losses support small structural changes in the existing helpers and repair diagnostics. They do not support a new semantic pass, a retry, broader source authority, or loose synonym matching. In every case the deterministic helper should remain a presence/scope floor and the existing full-original-source verifier should remain mandatory.

## 1. Personal report uncertainty with a bounded relay continuation

Both report candidates contain a readable personal negative pair:

```text
Ada Marlow ... has not read the agreement or independently checked Bo’s account
```

The original diagnosis that the relay suffix was the sole failure was incomplete. Frozen replay establishes three independent boundaries:

- Exact repaired row 4 returns false.
- Removing `, and only passes on ...` and terminating the text still returns false.
- In that clipped text, expanding `; Ada has` to `; Ada Marlow has` makes the helper return true.

The helper's name grammar currently requires a multiword proper name. It therefore misses the short outer reference `Ada` after the semicolon. The initial candidate also uses the short possessive inner reference `Bo’s account`, which the current report-object grammar cannot recognize. The relay suffix below is an additional terminal-shape failure:

```text
and only passes on that meaning without checking it herself
, and only passes on this meaning without checking it herself
```

Preserve the existing multiword-name grammar and add bounded source-backed short-name alternatives rather than treating any capitalized token as a person. The safest interface is to let the caller pass exact nongeneric person labels derived from the candidate's validated attribution and source frame, then derive unique first-token references only when that token occurs as a standalone name reference in the candidate and is unambiguous among the supplied people. Escape it and use Unicode name boundaries. Use the same supplied set for the outer subject and possessive inner report object. If changing the helper signature is disproportionate, a narrower lexical short-name grammar may be used only in the full clause-start subject and possessive report-object positions, with pronouns, sentence heads, labels, and ordinary capitalized nouns excluded; full source verification must still bind identity.

Separately, add one closed post-pair continuation alongside `possibleContinuation` and `clarification`, rather than another top-level regex:

- optional comma, then `and`;
- optional `only`;
- finite `passes on`, `conveys`, or `relays`;
- `this|that|the` plus `meaning|account|report`;
- optional `without (independently )?checking|verifying|confirming it` plus a reflexive;
- immediate sentence/clause/end boundary under the existing terminal policy.

This continuation should not itself prove uncertainty. It is accepted only after the same subject's already-recognized `has/have/had not read ... or ... checked/verified/confirmed REPORT` pair. Do not make `passes`, `words`, `checked`, or a short name independently sufficient. For a pronoun subject, bind the final reflexive grammatically (`she`/`herself`, `he`/`himself`, `I`/`myself`). For a proper-name subject, do not infer gender; permit the bounded reflexive alternatives and leave actual identity/meaning to full semantic verification.

Consolidating all allowed post-pair tails into a single `closedContinuation` avoids the current divergence among negative explanation, possible-term explanation, quoted-words clarification, and relay wording. Each arm should consume its entire licensed tail before the common terminal lookahead.

Minimum tests:

- Exact V68 initial and repaired candidates return true.
- The repaired candidate clipped before the relay tail remains true with short outer `Ada`; the same candidate with the short-name token absent from supplied source-backed labels fails if the helper accepts a source-name parameter.
- The initial candidate recognizes short possessive `Bo’s account`, with both straight and curly apostrophes. A short name borrowed from an unrelated source person, a common Titlecase word, and an ambiguous shared first token fail the deterministic source-backed path.
- Short invented names in the outer/inner roles remain supported; possessive straight and curly apostrophes remain distinct from a new actor.
- Missing `not`, positive `has read`, `but she later checked it`, `and then she confirmed it`, a new named subject before the relay, a device/account-object switch, and an independently quoted relay sentence return false where the negative pair is no longer intact.
- A question, denial, allegation, example, or quotation around the whole construction cannot activate it.
- Arbitrary suffix text and a comma-spliced retraction fail the common terminal boundary.
- An integration test proves helper-positive text can still be rejected by the mandatory verifier for a changed reporter, inner source, agreement/account object, or relay meaning.

## 2. One complete Russian counterfactual proposition unit

The four V68 Russian drafts are complete, source-faithful counterfactual units, but the current helper recognizes only two narrow relative-clause templates. It misses all observed grammatical variants:

- `в нереализованном варианте покупка ... покрыла бы ...`;
- `нереализованный вариант состоял в том, что при покупке ... был бы покрыт ...`;
- `в нереализованном варианте приобретение ... покрыло бы ...`;
- `в нереализованном варианте приобретённое ... покрывало бы ...`.

Adding each noun or participle to the existing `nounPhrase` would widen the weakest part of the regex and repeat the sampled-word pattern. Prefer a separate `hasCompleteRussianCounterfactualUnit` inside the shared counterfactual module. It should recognize the whole two-part proposition:

1. An affirmative clause head or bounded source attribution, followed by `нереализованный вариант|нереализованная альтернатива`.
2. In the same closed clause, an acquisition antecedent expressed as `покупка|приобретение` of a bounded object, `при покупке` of that object, or an agreeing acquired-object phrase.
3. Conditional morphology on the coverage consequence (`покрыл/покрыла/покрыло/покрывало бы` or an agreeing passive `был/была/было бы покрыт/покрыта/покрыто`). Keep the covered repair/object and any year/duration inside the bounded consequence.
4. A following closed actual-world clause that expressly says the extension/purchase did not occur.
5. A following or coordinated closed qualification that it is not active/current coverage.

The floor need not prove that the antecedent object, covered repair, year, nonpurchase subject, and active-coverage owner are identical. That remains the semantic verifier's job. Requiring all three semantic pieces in the same bounded unit sharply limits false admission while supporting ordinary Russian word order. Mask quotations before matching, reject clause-boundary borrowing, and cap each noun/consequence span by tokens as the current helper does. Do not add a general rule that `нереализованный`, `приобретение`, or conditional `бы` is enough.

Minimum tests:

- The exact four V68 drafts pass.
- Removing `нереализованный`, `бы`, the explicit nonpurchase, or the no-active-coverage qualification fails.
- Indicative actual purchase/coverage, a realized option, a source stating purchase did occur, or active coverage remains fails locally or is mandatorily rejected semantically.
- Questions, denials, allegations, examples, full quotations, comma/semicolon/newline splits, and a later retraction do not activate the unit.
- A different actor's nonpurchase, a different extension, a changed repair, changed ordinal year, or overbroad `no coverage at all` may pass the presence floor only if grammatically complete, but must fail the paired full-source semantic test. This documents the boundary without turning the helper into a parser.

Generation and verification instructions should share one short proposition-unit rule: preserve unrealized acquisition, conditional covered repair, explicit nonpurchase, and no-active-coverage scope together. This replaces duplicated hints about isolated modal words; it does not prescribe one surface template.

## 3. English `initial recording` source anchor and precise diagnostics

Frozen replay gives both V68 retention candidates `hasSourceRelativeAnchor=false` and `hasUnknownReferenceClock=true`. The failure is exactly the relative anchor, not unknown-calendar preservation. The source says `запись`; English `initial recording` is a plausible translation in context, but the current generic English fallback recognizes `recording` only after `original|undated`, not `initial`.

Do not add `initial` as a free modifier to every broad source-clock alternative. Use either of these bounded approaches, in preference order:

1. **Generation-first canonicalization:** tell extraction and repair to render this source relation as `next month after/from the undated original source entry (not processing)`. `source entry` or `original record` is clearer than the polysemous `recording` and already expresses the actual authority. This is the smallest change and avoids teaching the floor another ambiguous noun sense.
2. **Closed helper compatibility:** if ordinary faithful `initial recording` must be admitted, add a separate English branch requiring the complete local relation: a day/week/month/year direction (`after|before`) or `next/last ... relative to`, exact `the initial recording`, and the immediate processing contrast (`not after processing` or `not processing`) before a real clause/end boundary. It should return only the relative-anchor result; unknownness must still independently pass `hasUnknownReferenceClock`.

The closed branch should reject quoted examples, conditions, questions, allegations, negated/retracted anchors, `initial device recording`, `recording of processing`, reversed direction, changed period, and an independent processing sentence. Pair it with semantic negatives for a different source event or invented causal relationship.

The repair reason should be computed from the two booleans instead of always claiming a generic bare-deictic problem:

- relative false / unknown true: `the unknown date is explicit, but the deictic interval is not explicitly anchored to the original source entry rather than processing`;
- relative true / unknown false: `the source-relative interval is explicit, but the source entry's calendar date remains insufficiently marked as unknown`;
- both false: the existing combined explanation, rewritten without the irrelevant `bare tomorrow` example when the actual unit is a month/year.

Pass these dimensions as candidate-specific advisory repair obligations. Ask repair to change only the failed clock expression and preserve the original actor, proposal, object, negative plan/meeting clauses, and discourse metadata. In particular, repair must not invent a causal `because` relation between “proposal only” and no plan/no meeting. Whether V68 candidate 170's `because this is only her proposal` is acceptable is under separate source adjudication; the structural fix should neither rely on it nor reproduce it.

Tests should assert the exact reason text and original candidate index for all three boolean combinations, plus an integration in which repair fixes only the relative phrase. The repaired candidate must still undergo all local checks and full original-source semantic verification; admitted siblings remain immutable and no second repair is added.

## Files and finite limits

Likely implementation sites:

- `packages/core/src/memory/report-uncertainty.ts` and `packages/core/src/write/retain-report-uncertainty.test.ts`;
- `packages/core/src/memory/counterfactual-wording.ts`, its unit test, and paired `ops/answer` semantic tests;
- `packages/core/src/timeline/source-clock.ts`, its tests, and `packages/core/src/write/retain.ts` for dimension-specific repair diagnostics and concise generation guidance.

These remain finite English/Russian grammatical floors. They will not cover arbitrary paraphrases, resolve word sense without context, or prove source entailment. Output schemas, caps, models, pass counts, retry policy, ownership, and all semantic/language acceptance gates should remain unchanged.
