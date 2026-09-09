# V73 bounded unknown-source-clock design review

## Observed failure

The V72 source says the date of the initial record is unknown, “next month” means the month after that record rather than after processing, and the calendar month cannot be established.

Both generated candidates preserve that meaning:

- Initial: `“Next month” means the month after the original record, whose calendar month cannot be established, not the processing date.`
- Repair: `“Next month” means the month after the original record rather than after processing. The original record's date and calendar month cannot be established.`

Frozen `tmp/core-v72` replay returns `hasSourceRelativeAnchor=true` and `hasUnknownReferenceClock=false` for each complete candidate. `cleanCandidateBatch` consequently holds each with the precise `time_unresolved` diagnosis that the relative anchor is recognized but the unknown reference date is not. No semantic verifier runs.

The broad fallback in `hasUnknownReferenceClock` recognizes such forms as `record has no date`, `undated record`, or a free `calendar month ... unknown/cannot be determined`. It does not recognize the repaired possessive source-clock subject plus coordinated object and `cannot be established`. The source meaning is present; this is a lexical/grammatical false hold.

## Smallest safe addition

Add one private helper used only by `hasUnknownReferenceClock`, for a **standalone affirmative English source-clock clause** shaped as:

> `The original record's date and calendar month cannot be established.`

The branch should require all of the following in one clause:

1. A true clause start: beginning of input or immediately after `.`, `;`, or `!`, followed only by horizontal whitespace and optional `The`.
2. A possessive source noun, narrowly `original record's` / `original record’s`. If slightly reusable forms are desired, allow only an explicit bounded adjective (`original`, `source`, or `undated`) plus `record`, `recording`, `note`, or `source entry`; do not accept a bare device `record`, log field, component, meeting, processing event, or arbitrary possessive noun.
3. The coordinated clock object in the observed order: `date and calendar` plus exactly `day|week|month|year`. Requiring both `date` and the calendar unit is safer than admitting any unknown property of a record. A later revision can add reverse order only with its own evidence.
4. Closed negative epistemic predicate: `cannot`/`can't` (optionally `could not`/`couldn't` if a sourced past rendering is needed) + `be` + `established|determined|resolved|recovered`. Do not accept positive `is established`, `may not`, questions, reported uncertainty, or an arbitrary word gap.
5. A real sentence/clause end checked with `hasUnretractedClauseEnd`, so immediate comma/semicolon adversatives and later correction cannot validate the clause.

Before matching, use the existing source-clock quotation masker so a quoted example cannot become evidence. The branch should not use the query, `time` metadata, or the already-passing relative anchor as authority. `hasSourceRelativeAnchor` and `hasUnknownReferenceClock` remain independent requirements in the retention cleaner.

A representative bounded expression is conceptually:

```text
(?:^|[.;!])[ \t]*(?:The[ \t]+)?original[ \t]+record['’]s[ \t]+
date[ \t]+and[ \t]+calendar[ \t]+(?:day|week|month|year)[ \t]+
(?:cannot|can't)[ \t]+be[ \t]+(?:established|determined|resolved|recovered)
```

followed by `hasUnretractedClauseEnd` at the exact match end. This is a grammar description, not a recommendation to append it to the existing broad fallback alternation.

## Why the relative-clause form should remain outside this revision

The initial `original record, whose calendar month cannot be established` is source-faithful, but accepting it requires resolving `whose` to the correct source record across a larger relative clause. A generic `whose calendar month` branch can borrow a device, proposal, processing job, or quoted antecedent. Root's preferred repair already converts it into an independently explicit source-clock sentence. Admit that repaired form first and improve the repair instruction to request it when the typed diagnosis says only unknown-clock recognition is missing.

This means the initial candidate may still take the existing single repair. That is acceptable only if the repair remains tied to the same original index and proposition, immutable admitted siblings remain unchanged, and the reconstructed candidate still passes the 400-unit/local/vector/full-source semantic pipeline. It does not justify a retry after another failure.

## Positive controls

1. Exact V72 repaired candidate: relative anchor true, unknown clock true, full cleaner reaches semantic verification.
2. Standalone variants ending in each real sentence boundary: `The original record’s date and calendar month cannot be determined.` and the exact `cannot be established.`
3. The source-clock sentence following the complete proposal/nonacceptance sentence, proving it remains independent of personal-action grammar.
4. Quoted `“Next month”` remains allowed only as the deictic label in the separate relative-anchor clause; the explicit unknown sentence itself is unquoted.
5. Matching `calendar day/week/year` forms paired with corresponding independently valid relative anchors, if those period nouns are included.

## Negative controls

The new helper must return false for:

- `The original record's date and calendar month can be established.`
- `The original record's date and calendar month may not be established.`
- `Can the original record's date and calendar month be established?`
- `If the original record's date and calendar month cannot be established.`
- `Ada said that the original record's date and calendar month cannot be established.`
- `It is false that the original record's date and calendar month cannot be established.`
- `The device record's date and calendar month cannot be established.`
- `The processing record's date and calendar month cannot be established.`
- `The original record's status and calendar month cannot be established.`
- `The original record's date and latch gap cannot be established.`
- the entire positive sentence inside each supported quote style;
- the positive sentence followed by `, but it was established`, `; however it was established`, uppercase/newline adversatives, or `?`;
- a source noun in one sentence and `date and calendar month cannot be established` in another;
- the relative-clause form `the original record, whose calendar month cannot be established` in this revision, documenting the intentional limit.

Pair at least one accepted local candidate with a mandatory semantic-negative verifier result: local grammar recognition is only a presence floor and cannot establish that the claimed clock matches the original source.

## Relationship to the inherited Russian clock support

Keep the V71/V68 Russian explicit meaning-statement clock support unchanged in this revision. `hasDirectUnknownRussianCalendar` and the bounded Russian source-entry branches already encode different morphology, actor/denial continuations, and adversative boundaries. Sharing a helper or broadening their grammar with this English possessive form would enlarge two independently delicate surfaces without evidence.

The same test file can assert that the existing Russian positives and negatives remain unchanged, but the production change should be a separate English helper called by `hasUnknownReferenceClock`. A later consolidation is warranted only if it can share clause-ending and quotation utilities without merging language-specific acceptance grammar.

## Recommendation

Implement only the standalone possessive source-clock clause and update the existing repair guidance to emit that explicit sentence when the relative half already passes and unknownness is missing. Preserve independent clock floors, quotation masking, unretracted endings, the single repair, current caps, and mandatory full-source semantics. Defer relative-clause anaphora.
