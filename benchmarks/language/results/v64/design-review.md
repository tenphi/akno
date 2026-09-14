# V64 bounded design review

The proposed scope is coherent and keeps the existing safety authority intact if both additions remain generation guidance and the deterministic checks stay unchanged.

## Retention text bound

The current cleaner normalizes candidate text with `trim().replace(/\s+/g, ' ')`, then rejects fewer than four whitespace-delimited words, normalized `text.length > 400`, or text that does not read as a statement under one generic reason. JavaScript `text.length` is UTF-16 code units, so the prompt and diagnostic should describe the rule exactly as “at most 400 UTF-16 code units after trimming and whitespace folding.” Calling it characters would be inaccurate for astral symbols.

Exposing that existing limit in the initial extraction prompt is safe. It changes no admission rule, does not increase the cap, and gives the model a fair chance to preserve the complete proposition inside the already-enforced boundary. The deterministic hold should distinguish at least:

- fewer than four words after normalization;
- normalized text exceeding 400 UTF-16 code units, ideally reporting the observed length and maximum;
- failure to form a self-contained statement.

The same precise issue must flow into only that original position's repair target. The repair instruction should continue to require the original proposition, every source-supported qualification, exact support/frame, and original `candidate_index`. Existing admitted positions must remain immutable and read-only during repair. A length repair is permission to compress wording, not to remove a separate proposition, actor, polarity, modality, temporal restriction, contrast, or epistemic predicate.

The confirmation distinction deserves an explicit shortening rule. “Ada has not received confirmation of Bo's report” records absence of an incoming confirmation. “Ada has not confirmed the report” makes Ada the agent of a confirmation act. They are not interchangeable. A repair may shorten the former to “Ada received no confirmation,” but must not turn it into “Ada did not confirm,” “the report is unconfirmed” alone, or a universal claim that nobody confirmed it. The same applies independently to “has not read/seen the terms.”

Minimal tests should cover normalized lengths 399, 400, and 401; folded internal whitespace; and astral code points to bind UTF-16 behavior. A mocked 403-unit qualified report should enter repair with the exact over-limit diagnostic and original position, return at most 400 units, and retain outer/inner attribution, object/contrast, unread-terms predicate, and **received**-confirmation predicate. Negative repairs should be held when they fit only by dropping one of those meanings or changing receipt into performed confirmation. A two-candidate test should show that repairing the long position cannot replace, duplicate, or modify its admitted sibling.

## Localized report-source presentation hint

The generation payload already treats `display_labels` and generic-assistant `source_label` as generation-only presentation aids. A similarly generation-only field for a neutral outer-source phrase is a safer intervention than broadening `hasBoundReporter` to accept ambiguous `Сообщено/Сообщила Ada Marlow` headings. For a qualified `basis=source_report` record, it may derive only from trusted attribution metadata and requested output language:

- named source: `According to Ada Marlow` / `По словам Ada Marlow`;
- generic assistant source: `According to the assistant` / `По словам ассистента` (or the established localized role form).

The field name should make its status obvious, such as `report_source_display_phrase`. The prompt should say it is fallible presentation guidance for expressing the already-supported outer source, not text to prepend mechanically and not authority to translate or infer an inner reporter. It should be omitted for self-attested/factual records, absent or unresolved attribution, and any case where the record is not a supported report. Proper names remain byte-preserved; generic roles remain localized.

The inner reporter must still appear as the explicit grammatical reporting subject when the selected proposition contains one: for example, `По словам Ada Marlow, Bo Winters сообщил, что ...`. The neutral outer phrase cannot replace Bo, make Ada the embedded claimant, or license content from an adjacent source frame. Likewise, neither the hint nor the source frame may expand a selected no-booking record into the missing service report. All language, reporter-role, source-selection, semantic-verdict, and alignment gates remain mandatory.

This design should not mechanically prepend the hint after generation. Mechanical insertion could create duplicate or contradictory attribution, attach the source to the wrong block, or make unsupported prose appear qualified. The existing deterministic reporter guard should remain strict. A generated `По словам Ada Marlow, Bo Winters ...` form already falls within its bounded grammar; a model that ignores the hint or returns `Сообщено Ada Marlow` should still be held rather than admitted through a broader regex.

Minimal tests should inspect the generation request and prove that the hint appears only for qualified source reports, uses Russian/English requested-language forms, preserves named spelling, localizes generic assistant, and is absent from verifier payloads and public evidence/context. Mocked positive outputs should bind outer Ada and inner Bo explicitly in both languages. Negative outputs should cover ambiguous passive labels, reversed `According to Bo, Ada relayed`, outer-only attribution with a missing inner reporter, and a hint copied into a non-report block; existing guards should continue to reject them. A focused source-selection test should confirm that a valid hint does not authorize neighboring propositions.

## Assessment

Both changes are appropriately bounded. The retention change improves model observability of an existing hard limit and repair precision without relaxing acceptance. The attribution change supplies semantically meaningful localized wording from already-authoritative metadata while leaving actual source meaning and admission to the existing gates. The material risks are imprecise unit naming, treating presentation guidance as semantic authority, mechanically injecting it, or allowing compression to collapse personal epistemic predicates. The constraints and tests above keep those risks outside the proposed scope.

## Copy eligibility when the requested language differs

The V63 explicit-Russian exclusion null exposes a separate, small schema-eligibility issue: generation selected `copy` for English retained prose, and the actual language check correctly held it. When both configured `knowledge_language` and requested `output_language` are present and differ, removing `copy` from the generation schema is a sound conservative restriction. It does not claim that every stored byte actually follows the configured policy; it only declines to offer an exact-copy shortcut whose declared language contract conflicts with the requested prose language. `translate` must still preserve names, quotations, code and supported meaning exactly where applicable.

This should not replace or weaken the actual output-language check, full source semantics, selection, or qualification checks. Keep `copy` available when the two policy languages match or either is unset. Do not add a source-language detector, infer language from stored bytes, or make another model call. Tests should assert the exact rendering-mode enum offered for same, different and unset language pairs; verify that mismatched policy still accepts a faithful translation; and retain a negative test showing mixed/foreign generated prose rejected after generation regardless of the offered mode.

I recommend including this restriction in V64 if the rendering schema is already assembled per requested language and knowledge-language policy, because it is a narrow removal of an invalid shortcut directly exercised by V63. It is independent of the 400-unit and attribution-hint changes and should be described and tested separately. If adding it would require refactoring shared rendering authority, defer it rather than broadening V64: the existing language check already fails safely, so this is a coverage improvement rather than a safety prerequisite.
