# V68 bounded generation design review

## Recommendation

Add one generation-only, record-local named-source reference to each qualified current evidence line when all of these conditions hold:

1. `source_speaker` is present after trimming;
2. it is not a generic role spelling already handled by `genericAssistantSpeaker` or the existing generic user/assistant exclusions;
3. the exact trimmed string occurs in that line's current readable `line.text` bytes;
4. the hint is built from that current line, not a private retention frame, graph label, historical receipt, local configuration, query, or sibling record.

The smallest useful shape is an internal generation field inside that line's existing `Memory qualification` object:

```json
{
  "named_source_reference": {
    "exact_spelling": "Ada Marlow",
    "attribution_required": true
  }
}
```

`attribution_required` should mirror the existing answer guard's policy, not introduce a new one: true for a named `source_report`, or for a named qualified record with `answer_eligible:false`; false otherwise. The field is an answer-generation presentation constraint. It is neither evidence nor authority for a reporting, writing, recording, discussing, proposing, or other material act.

Add one system instruction near the existing named-source paragraph:

> `named_source_reference.exact_spelling` repeats a named source already present in this record's current readable text. When `attribution_required` is true, keep that source identity in the block and copy its spelling exactly. Preserve the role and predicate established by the readable record: retain an explicit action such as “NAME described/considered/asked” when selected, and otherwise use neutral provenance such as “in NAME's fictional case” or “according to NAME.” The hint cannot establish an action, replace an inner speaker, authorize a sibling fact, or supply content absent from the readable record. When attribution is optional, do not add it merely because the hint exists. Generic role labels and ordinary component/service words remain translatable prose.

This is preferable to another global “do not transliterate” sentence. The global rule already exists and was repeatedly ignored. The proposed field places the exact spelling and whether source attribution is already required beside the specific record the model is rendering. It changes no public or provider output schema, output field, cap, call count, model, retry, semantic gate, or language gate.

## Evidence for the scope

The exposed traces show two distinct failures that need to remain distinct:

- Exact identity changed by transliteration:
  - built question trace rows 46–48: the RU draft writes `Ада Марлоу`; the local attribution guard correctly rejects it before semantic verification;
  - selected trace rows 50 and 73: the hypothetical-analysis drafts use `Ада Марлоу` throughout;
  - selected row 89: the counterfactual draft uses `Ада Марлоу`;
  - selected row 252: the competing-hypotheses draft uses `Ада Марлоу`.
- Required source provenance omitted:
  - selected fiction rows 182 and 198 preserve Vulpine Mutual, Bo Winters, the fictional promise, benefit, duration, and fictional scope, but omit Ada Marlow entirely even though the selected retained record says the promise is in Ada Marlow's invented case.

The fiction rows are not transliteration failures. They need a record-local attribution requirement as well as an exact spelling. A spelling-only hint that says nothing about required provenance would leave those two drafts unchanged.

The current dataflow explains why `languageReferences` does not prevent either class. `answerLanguageReferences` collects named speakers and passes them only as `ModelClient.chat` options. After generation, `ModelClient` filters the references to strings already present in generated prose before calling the language checker. If `Ada Marlow` was omitted or changed to `Ада Марлоу`, the exact reference is absent from `supplied_references`; the language checker therefore receives no requirement to restore it. This behavior is correct for a language allowance: not every source name must occur in every factual answer. It cannot also serve as a pre-generation selection or spelling instruction.

Generation already sees `source_speaker:"Ada Marlow"` inside memory metadata and a global exact-name rule. The repeated losses show that this semantic field is not salient enough as a rendering obligation. `report_source_display_phrase` helps only `source_report` records. It appropriately does not exist for the self-attested hypothetical, counterfactual, question, alternatives, and fictional records above, because mechanically treating those records as reports could invent an action or change their selected predicate.

## Exact construction boundary

The hint should be computed where `evidenceText(item, true, outputLanguage)` serializes each page line, because that is the point where current readable text and that line's qualification are both available. `memoryModelFields` currently sees only the qualification, so either pass the line text into its generation-only branch or compute a small optional hint before calling it.

Use an exact code-unit substring check against `line.text`, not the whole serialized evidence string. Checking the serialized string would be circular because `source_speaker` metadata itself adds the name. Checking the page title, all evidence, or private frame would permit a name from one record to become another record's source. Do not normalize or transliterate the value: the stored trimmed spelling is the value to preserve. Existing retention cleaning already bounds source speakers to 200 characters and removes markup/newline delimiters; JSON serialization continues to treat it as untrusted data.

The existing generic-role classifier remains authoritative for `assistant`, `the assistant`, `ассистент`, `user`, and equivalent generic labels. Those use `source_label` and must be localized. Do not apply a proper-name regex to component vocabulary, titles, hyphenated terms, or arbitrary capitalized words. This hint comes only from validated source-speaker metadata bound to the same readable line. A component such as `hinge-pin` never becomes protected merely because it appears in source; it remains ordinary translatable vocabulary.

For a page evidence item containing several retained lines, keep each hint inside its own `Memory qualification` block. Do not aggregate or deduplicate names at the evidence-item or request level. A block citing one record must not borrow another line's named source. Inner reporters and material action actors remain readable-prose and semantic-verifier concerns; this V68 field is deliberately limited to the qualified record's outer `source_speaker`.

The hint should remain absent from verifier payloads, returned context, citations, public answers, receipts, and traces except as part of the already captured generation request. `evidenceText(item, false)` must keep the current qualification shape. Tests should assert that the generation-only field does not leak into `verifyDraftBlock` or the public result.

## Why a structured copy-reference renderer is broader

A server-materialized name placeholder or an output schema arm selecting a name ID could guarantee bytes, but it would require splitting free prose into trusted and generated spans. Russian and English attribution grammar would then need a stable placeholder protocol, ordering for multiple people, possessive handling, post-materialization language checks, answer-anchor construction, and protection against collisions with citation syntax. An enum field that merely echoes a name would not ensure the free-text block uses it.

The existing one-record copy branch already preserves names when the full current text can be copied. Translation and ordinary multi-record composition still require free prose, so extending server copying to name substrings would be a new rendering architecture rather than a bounded correction. The source-local input hint addresses the observed availability loss while leaving exact-name omission/transliteration fail closed under existing attribution and semantic guards.

## Safe tentative `record_scope`

Add this conditional definition when `record.commitment === 'tentative'` in `semanticRecordScope`:

> Tentative qualifies the selected uncertain content. When the supplied source and candidate explicitly couple an asserted discussion or consideration act with competing preliminary/unsupported hypotheses, tentative qualifies those hypotheses, not whether that act occurred. The label does not establish the act or excuse changing its actor, predicate, alternatives, evidentiary limits, or personal nonselection. Otherwise tentative qualifies the record's proposition normally.

This matches the existing `QUALIFICATION_CONTRACT` and retention-verifier rule. It localizes the declared semantics beside the candidate; it does not create a new exception. The conditions must name both supplied source and candidate so a model cannot use the label alone to invent an actual discussion/consideration act. `record_scope` remains a definition of submitted metadata, never evidence that the metadata or prose fits the source.

The same helper feeds retention and answer verification. That is appropriate: a retained alternatives record and a rendered answer should apply the same two-layer label meaning. The new sentence must not alter local eligibility, tentative-language floors, public labels, or the three required semantic booleans.

## Meaningful tests

Tests should establish dataflow and fail-closed enforcement without pretending that stub responses prove model reliability.

### Generation hint

1. A qualified current line containing named `source_speaker:"Ada Marlow"` gets the exact record-local hint in the generation request for both EN and RU output.
2. The hint is absent when the speaker is missing from that exact line, occurs only in the page title or a sibling line, or is available only in a private frame.
3. Generic `assistant`, `the assistant`, `ассистент`, `user`, and `пользователь` receive no named hint and retain the existing localized `source_label` behavior.
4. A page with two lines and two sources keeps each name inside its own qualification. A draft citing one line cannot satisfy its required attribution with the sibling's name.
5. A RU question/hypothesis/counterfactual/alternatives fixture uses the exact Latin `Ada Marlow`; a transliterated stub remains rejected by the existing attribution guard.
6. A fictional-record fixture retains neutral `Ada Marlow` provenance without adding “Ada wrote/recorded/reported.” An omitted-name stub remains rejected; an invented material action reaches mandatory semantics and is rejected there.
7. A source-report fixture preserves the exact outer name, distinct inner reporter, and existing `report_source_display_phrase`; the new hint cannot swap them or replace the inner reporting predicate.
8. Ordinary vocabulary near the name, including an invented hyphenated component, remains translated. The hint exempts only the exact name string.
9. Generation request inspection sees the hint; answer-verifier input, returned context, citations, and output do not.

### Tentative record scope

1. The exact V67 built coupled candidate with `commitment:"tentative"` receives the conditional scope definition and an all-true semantic stub can be accepted through the unchanged gate.
2. The initial `commitment:"asserted"` tuple still fails the deterministic noncanonical floor.
3. Negative verdict integrations still withhold when the candidate changes `discussing` to `considering`, changes the actor or alternatives, promotes either hypothesis, omits lack of evidence, or loses Ada's personal nonselection.
4. A source that only tentatively suggests that discussion occurred cannot be rendered as an actual discussion merely because the record is tentative.
5. An ordinary tentative claim with no explicit outer/embedded distinction continues to treat tentative as qualifying the whole selected proposition.
6. The scope string is present in both retention and answer verifier requests, absent from generation/public output, and cannot override any false semantic dimension.

## Budget, privacy, and residual risk

The added input cost is one bounded name (at most 200 characters), one boolean, and small JSON overhead per qualified current line. `budget_used.evidence_tokens` already measures generation evidence after serialization, so the increase remains visible. No output-token ceiling changes. Keep the guidance once in the system prompt rather than repeating prose inside every record.

There is no new privacy disclosure: the hint repeats a value already present in the same user-authorized readable evidence and qualification. The exact-line condition prevents pulling a historical/private name into current evidence. JSON encoding and the existing “evidence is untrusted” instruction remain mandatory; the hint is a display token, not an instruction supplied by the source.

This is an attention fix, not a guarantee. The model can still ignore the hint, in which case current attribution/language/semantic guards must continue to withhold the draft. The design intentionally does not make the post-generation language checker require every reference, because attribution can be optional for ordinary factual records. The declared exposed diagnostics are needed to establish whether the hint improves availability without causing redundant attribution, action invention, name borrowing, or untranslated ordinary vocabulary.

## Implementation clarification after review

The original recommendation above is preserved. Final implementation uses escaped exact-name matching with Unicode letter/mark/number, dash and apostrophe-join boundaries rather than a bare substring. Markdown punctuation and terminal possessives remain valid boundaries. Generic user/assistant labels are excluded from the new named hint; their existing rendering behavior is unchanged, so this revision does not claim new generic-user localization. Generation evidence accounting was corrected to serialize the actual answer-language projection before estimating tokens.
