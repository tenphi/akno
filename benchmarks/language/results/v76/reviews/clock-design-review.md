# V76 generated-clock readability design review

## Decision

The proposed change is sound if it is implemented as a source-activated readability obligation on generated candidates, with a closed candidate-side relation check bound to the same clock identified by the immutable source witness.

This is a consistency correction, not a finding that V75 retained false temporal meaning. The V75 retained sentence says that next month means the month after the source record and that the calendar month is unknown. That usefully preserves the source-relative clock. It does not repeat the original's explicit “not after processing” contrast. V75's structured answer renderer then restored that exact original qualification, and the verifier rejected two of four equivalent Russian renderings as absent from the visible selected excerpt. Requiring the contrast to be readable before write removes that authority mismatch without making private frame text answer evidence.

The scope in `tmp/language-v76-plan.md` is appropriately narrow:

- generated candidates only;
- an explicitly unknown source clock already represented in typed time metadata;
- one complete, exact, candidate-owned `sourceClockRepairWitness` with `with_exclusion: true`;
- the existing one presemantic structural repair;
- unchanged 400-character aggregate and 195/90/60/52 segment caps;
- unchanged provided-candidate path, public schemas, language check, source cleaner, semantic verifier, pass count, and no-retry policy.

## Source authority and activation

The existing witness is a strong activation boundary. `sourceClockRepairWitness` accepts a definition only when all clock dimensions occur in one exact `discourse_frame` span: unknown original date, deictic period and direction relative to that record, optional processing exclusion, and unresolved calendar period. The match starts at byte zero, consumes the complete span apart from bounded terminal punctuation/space, rejects an immediate retraction, and returns exact indexed excerpts. It does not assemble dimensions across items. Multiple distinct definitions return `null`.

That witness is built after support/frame spans have been checked against the original source item bytes. A generated candidate, sibling candidate, model interpretation, processing timestamp, or repair response therefore cannot activate the new obligation.

The V75 undated source satisfies this exact boundary in its own second item and produces `with_exclusion: true`. The V75 generated retained sentence lacks the explicit processing contrast, so it would become eligible for the existing clock text repair. The V75 repair branch itself was not exercised in the probe because the current cleaner requires only a readable source-relative anchor and unknown reference date.

Keep the activation tied to all of these conditions rather than to a global occurrence of `processing` or a generic relative-time regex. In particular:

1. `options.generated` must be true. Exact and automatic provided candidates retain their existing attestation contract and behavior.
2. Cleaned time must remain explicitly unknown and nonactionable under the existing rules.
3. The source evidence must trigger the existing relative-time path.
4. The candidate's own validated frame must yield exactly one complete witness.
5. That witness must have `with_exclusion: true`.

An exact witness without an exclusion must not create the new requirement or expose an `excluded_reference_clocks` repair field.

## Candidate-side obligation

The new floor should verify an explicit reference relation, not merely the tokens `not`, `after`, and `processing`. A sentence such as “Next month is not after processing” can describe chronology rather than which clock defines the phrase. The accepted shapes should state one of these meanings:

- the expected deictic period means/refers to/is counted from the period relative to the original record, **not** processing time; or
- processing time is explicitly not the reference/origin from which that same expected deictic period is counted.

The check should be parameterized by the source witness's deictic label, period, and direction. Otherwise a candidate containing two relative periods could satisfy the obligation for `next month` with a sentence about `last year`. The cleanest internal representation is to add closed server-derived values such as `deictic`, `period`, and `direction` to the private witness while constructing it from the existing regex loop. These values are evidence indexes, not model assertions. Deriving the same values again from the witness's exact `anchor` excerpt is also viable, but accepting an arbitrary deictic phrase is not.

The matcher should accept bounded English and Russian renderings because retained knowledge language may differ from source language. It should:

- require the expected clock label, allowing quotation marks only around that isolated label;
- mask every other complete quotation with a nonsplicing sentinel;
- require an affirmative clause start at start-of-text or after `.`, `;`, or `!`, not a soft line break;
- require a closed reference predicate such as `means`, `refers to`, `is counted from`, `отсчитывается от`, or a closed “processing time is not the reference” form;
- require the negative processing-clock relation in the same bounded clause or a separately closed sentence naming the expected clock again;
- reject `?` endings, conditional/example/report prefixes, double-negation wrappers, and incomplete fragments;
- pass the end offset through `hasUnretractedClauseEnd`, so an immediate `but/however/но/однако/это неверно` correction cannot be ignored.

Do not admit a bare “The clock is not processing time” unless the sentence binds `the clock` to the expected deictic period inside the same closed unit. The current test delta's `The clock is not the time of processing.` relies on record-level anaphora and is weaker than the stated design. A bounded replacement such as `Processing time is not the reference for next month.` fits the 60-character field and states the required relation directly.

The final full-source semantic verifier must still decide whether actor, proposal, period, direction, exclusions, and qualifications agree. The local floor only proves that a closed readable processing-clock contrast exists.

## Integration and repair behavior

Compute the source witness once alongside the existing `relative` and `unknown` readability checks. Extend the internal unreadable-clock diagnostic with a missing-excluded-clock dimension. A candidate with a complete `with_exclusion` witness but no qualifying readable contrast should remain held as `time_unresolved` and become a `clock_text_only_with_exclusion` target only when it is otherwise eligible under the existing sole-issue rules.

The current repair transaction already provides the right isolation:

- only failed original indices are targets;
- the server selects the strict three- or four-field branch from the owned witness;
- metadata, source spans, original position, relations, and siblings are cloned rather than generated;
- malformed, duplicate, cross-branch, over-cap, punctuation-only, truncated, and trailing transactions fail atomically;
- the composed repair is cleaned again and then sent through the one mandatory semantic verifier with its original repair obligation.

The same new candidate-side floor must run on the composed repair. Otherwise the model could fill `excluded_reference_clocks` with an unrelated processing sentence and pass based on field presence. It is also reasonable to invoke the same deterministic check from `additionalLanguageProse` after the strict normalized transaction parse, using the target's server-owned witness, so an irrelevant exclusion sentence fails before the language transport. Final cleaner enforcement remains mandatory even if that early check is added.

Mixed failures should keep the existing behavior. A clock issue plus report readability or another structural defect must use full repair or remain held; it must not gain the text-only privilege from one repaired dimension. A repair that fixes only the explicit exclusion but loses the proposal, source anchor, unknown date, unresolved calendar period, no-plan limit, or no-meeting limit must remain held.

## Required controls

Meaningful deterministic and integration controls should cover:

### Positive activation and repair

- The exact V75 Russian source definition activates `with_exclusion: true`; the V75 generated retained text without the contrast is held and offered exactly one `clock_text_only_with_exclusion` repair target at its original index.
- Equivalent complete English source definition behaves the same.
- A generated candidate whose readable text already says that the expected period is counted from the original undated record and not processing passes the new floor without repair.
- A valid four-field repair composes to at most 400 UTF-16 units, preserves every cloned field/span/index, passes language checking, and reaches mandatory source verification.
- The semantic-negative version reaches the same verifier and remains held without retry.

### Source-witness negatives

- Whole quoted definitions, examples, questions, conditional definitions, double negations, known source dates, wrong directions, wrong excluded clocks, incomplete definitions, trailing retractions, and definitions split across source items produce no witness.
- A complete witness in a sibling candidate's frame does not activate the current candidate.
- Two distinct source clock definitions remain ambiguous and produce no specialized text repair.
- A source definition without the processing exclusion leaves existing behavior unchanged and uses only the three-field clock repair if another clock dimension is unreadable.

### Candidate readability negatives

With a valid source witness, each of these must remain held:

- an unrelated processing action (`Ada processed the record after the review`);
- a bare mention (`Processing is noted.`);
- a chronological but unbound statement (`Next month is not after processing.`);
- a statement about the wrong deictic period;
- a whole quoted example of the correct sentence;
- `If ...`, `Suppose ...`, `It is not false that ...`, or a question;
- a correct-looking clause followed immediately by a retraction;
- a negation before a soft line break followed by an otherwise matching sentence;
- a repair field containing the right words but whose composed record lacks the existing source-relative anchor or unknown-calendar qualification.

### Compatibility and atomicity

- Generated records with no exact owned witness remain on the ordinary/full-repair path.
- Provided exact and automatic candidates are unchanged and do not acquire a model call.
- Noncontiguous mixed report/clock/full targets retain exact original indices and immutable admitted siblings.
- Missing, duplicate, malformed, over-cap, punctuation-only, or semantically irrelevant exclusion fields yield no partially repaired candidate, no verifier acceptance, and no retry.

## Risks and limits

The change intentionally holds a semantically adequate generated record that omits a source's explicit contrast. That can reduce retention availability when the four-field repair cannot fit the complete proposition in 195 characters. This is the cost of making every answer-visible qualification come from readable retained evidence. The repair instruction must continue to permit omission when the bounds cannot preserve the complete record; no truncation or sibling substitution is acceptable.

The finite candidate grammar will not recognize every natural way to exclude a processing clock. Unrecognized faithful prose will use the existing one repair and may still remain held. That is preferable to accepting ambiguous anaphora or a loose processing-word match. Provider controls and stubbed semantic negatives demonstrate schema transport and enforcement paths, not model competence or likely corpus recovery.

## Recommendation

Proceed with the V76 clock change only with a witness-bound candidate checker as described above. The exact source witness is sufficient authority to require explicit readable processing-clock exclusion; field presence or a generic negation regex is not. Preserve the V75 source-only conclusion that the old retained meaning was useful and complete, and describe V76 as aligning retained readability with excerpt-selection authority.
