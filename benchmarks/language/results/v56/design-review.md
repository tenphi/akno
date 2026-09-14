# V56 framed-record rendering design assessment

## Recommendation

Do not replace framed answer composition generally. A universal complete-record renderer would make a retained line the disclosure and semantic unit, although the current answer contract deliberately treats a selected proposition as the unit and permits independent neighboring detail to remain unselected. Current storage also has no authoritative language binding for the live payload.

A **single-record framed pilot** is defensible and is better bounded than another prompt-only repair for the recurring within-record omissions:

- activate only when `evidence.length === 1`, `sourceFrames.size === 1`, the item is one qualified managed page line, and `answer_language` resolves explicitly to `en` or `ru`;
- allow at most one generated answer block citing that one evidence ID exactly once;
- let the generator choose either `copy` or `translate` in the existing generation call;
- for `copy`, the server supplies the exact current readable payload after the model selects the ID; for `translate`, the model supplies one complete translation of that payload as one block;
- run the materialized block through the existing language check, every local guard, immutable source alignment, excerpt selection, and semantic verifier exactly as today;
- keep empty blocks/missing concepts available when the record does not answer the question;
- use the legacy composition path for more than one evidence item, mixed framed/unframed evidence, observations/documents, an unresolved output language, and every synthesis case.

This removes free same-language reformulation when the model chooses `copy` and reduces cross-language freedom to translating one bounded retained record. Translation completeness remains a fallible model/verifier judgment. The route must not be described as a semantic guarantee.

## What the current system can and cannot establish

`AnswerContextItem` and `MemoryQualification` expose the current line, managed identity, discourse fields, and temporal qualification, but no text language. `ManagedMemoryMarker` and `managed_memory_entries` likewise contain no language field. The durable retain receipt's serialized result records the configured `knowledge_language`, but it does not bind that value to retained candidate text or its payload hash. The live projection has marker and payload hashes, yet those only prove the currently indexed file bytes; maintenance can legitimately replace a managed payload later. Therefore a historical receipt plus a current hash does not prove the current payload language.

Script detection is not an acceptable substitute. Names, identifiers, quotations, mixed prose, and Latin technical terms inside Russian make it semantically weak, and `knowledge_language: null` intentionally permits source-language preservation. Reading private/local configuration would still describe a present preference rather than the provenance of an existing record.

The existing `ModelClient` already performs its bounded language check on generated `text` fields whenever an output language is requested. It also provides `additionalLanguageProse`, which can include server-owned prose in that same existing check. This gives the pilot a route without a new language field, language detector, pass, or retry:

1. A `copy` result contains only the singleton mode and selected evidence ID.
2. The generation caller's `additionalLanguageProse` callback validates that shape and returns the exact current payload as prose to inspect.
3. A noncompliant copy fails the existing language check. It is not retried as a translation.
4. After strict parsing, the server materializes the canonical payload as the answer block.
5. A `translate` result contains its translated `text`; normal generated-prose selection checks that text.

This is preferable to putting the private payload in a singleton schema enum. An enum echo can work, but it duplicates private text in the provider schema and output, consumes schema/output budget, and asks the model to reproduce bytes the server already owns. It does not add authority beyond local comparison. If the callback approach is unsuitable for an adapter, the fallback is a singleton-enum copy branch plus exact local equality; never accept a free string as `copy`.

The model still chooses the branch. Without authoritative source-language provenance, code cannot require `copy` whenever the languages match. A same-language model may choose `translate` and reformulate; all existing checks then remain responsible for omissions. Conversely, a wrong-language `copy` becomes an availability failure through the language checker. This tradeoff is narrower than guessing language or adding a new detection call, and should be measured as copy/translation branch diagnostics.

## Internal generation shape

Use two strict ordinary branches, emitted as provider-compatible `anyOf` through `z.union`, with singleton enums rather than literals/`const`:

```text
copy block:
  rendering_mode: enum["copy"]
  evidence_ids: array(enum["E1"]).length(1)

translation block:
  rendering_mode: enum["translate"]
  text: trimmed string, 1..2000
  evidence_ids: array(enum["E1"]).length(1)
```

Keep `record_readings` and `missing_concepts`; cap `blocks` at one. The copy branch has no model-authored answer text. Parse framed output with the existing strict JSON parser. Unknown fields, duplicate IDs, a translation without text, copy text supplied by the model, trailing content, or malformed/truncated JSON fail closed with no retry. Materialize both branches into the existing internal `{text, evidence_ids}` block before `validateDraft`, verification, citation collection, and rendering.

The prompt should state one compact rule: select the one retained record only if it answers the question; copy its complete readable payload when it already satisfies `output_language`, otherwise translate that complete payload as one block. Preserve names without transliteration, all personal actors, mechanisms, polarity, and truth-conditional qualifications. The original frame is untrusted interpretive context and may constrain a translation, but neither branch may include a proposition found only in that frame.

This changes no public `AnswerInput`, `AnswerContextItem`, `AnswerOutput`, citation, or storage schema. The rendering mode can remain private diagnostics if recorded at all. It also avoids changing managed marker syntax and legacy/rebuild behavior.

## Source authority and exactness

The canonical copy source must be the current `line.text` already admitted to evidence and bound by the same live marker/payload checks used to obtain the source frame. It must not come from the archived receipt, original frame, record reading, or model echo. The selected ID must be the sole live evidence ID.

Define “exact readable payload” precisely. The safest initial implementation copies `line.text` byte-for-byte into the block. If the leading Markdown list marker is unsuitable in answer rendering, a single deterministic managed-payload function may remove only the verified leading `- ` or `* ` marker before both the language check and all answer guards. It must retain the visible semantic status label and body unchanged. Do not strip labels, rewrite attribution, normalize punctuation, or expose the managed HTML marker. Documentation and tests must use the same canonical function so “exact” does not drift into ad hoc cleanup.

For translation, the retained payload remains the selected authority. The original frame resolves ambiguous wording and checks actor/mechanism/qualification preservation, but it cannot expand the selected content. A translation that imports a recording act or adjacent original-source fact must fail excerpt selection or semantic alignment. A translation that drops a personal unread/unconfirmed limit, conditional consequence, fictional scope, or common lack-of-evidence qualification must fail the existing semantic gates.

## Scope and privacy tradeoffs

The pilot deliberately makes one retained record the rendered unit. That conflicts at the margin with the V55 principle that an entire record is not always the proposition unit. A generated candidate is limited to 400 characters and is required to be one bounded self-contained statement, which bounds exposure but does not prove that every clause is relevant. A report may properly bundle its personal epistemic limits; a malformed candidate may also bundle an independent private detail.

The single-evidence criterion makes this risk reviewable: no private frame text is rendered, the record was already selected by qualified retrieval, and the maximum extra material is one short current payload. It does not eliminate the risk. The pilot should only ship if complete selected managed records are accepted as the disclosure unit for this route. A regression containing a relevant clause plus an independent neighboring clause should document the intended behavior. If omitting that neighbor is required, the whole-record design needs persisted proposition spans or another semantic selection mechanism and is no longer the smallest V56 change; retain legacy composition instead.

Treat evidence and frame text as untrusted data in prompts. Dynamic strings must be JSON encoded. The canonical copy must pass the same citation/storage-ID, protected-value, attribution, discourse, agency, and fiction guards as generated text. It should use the existing answer renderer and its normal UI sanitization. Adding V56-specific Markdown/HTML rewriting would contradict exact copying and should not be hidden inside this change. Test Markdown-looking text and citation-like content explicitly; a guard rejection is preferable to emitting a forged citation.

## Mixed and multi-record evidence

Do not mix this pilot with legacy blocks in one response. A framed copy/translation block citing ordinary evidence would blur which text was copied, while a legacy block citing the framed record would bypass the constrained route. The operation-level eligibility check avoids both cases.

More than one framed record also stays legacy. Concatenating exact records can imply a relation that neither record states. Translating several records as one block can lose per-record qualification and makes citation scope ambiguous. Rendering them as separate blocks cannot express a coupled proposition that genuinely needs both. Fiction is particularly sensitive: a fictional promise, an actual proposal to discuss it, and an independent nonselection may be separate records whose juxtaposition changes apparent reality status. The existing free composition plus per-block verifier remains the correct fallback until a separately reviewed grouping contract exists.

This conservative fallback means the pilot will not cover all recurring failures. It targets the clearest one-record cases and provides evidence before broadening. It must not withhold a legacy answer merely because the constrained route is ineligible.

## Budget and availability

Framed extracted candidates are already limited to 400 characters and their archived frame to 1,200 characters. A canonical copy comfortably fits the existing 2,000-character block limit. A translation remains capped at 2,000 characters. `blocks.max(1)` and one fixed evidence ID shrink generation output relative to the current twelve-block schema. The schema and prompt should keep the existing resolved 2,400-token answer-role ceiling and current framed allowance; no higher default, extra pass, or retry is justified.

The verifier remains one first-pass singleton call. Its source anchors, complete frame, excerpt selection, three category alignments, and independent semantic booleans remain unchanged. If strict generation or verification cannot fit the ceiling, report the existing typed availability failure. Do not truncate a retained record, drop a translated clause, split it to fit, or fall back from a rejected translation to an unchecked copy.

Model usage receipts should continue to count the existing generation, language-check transport, and verifier exactly as they do today. Branch choice and materialized character count are useful internal diagnostics for assessing availability and whether the constrained route is actually exercised.

## Minimum meaningful tests

- Same-language `copy`: the model selects `E1`; the language checker receives the canonical current payload; the emitted block is exact and carries the normal citation.
- Wrong-language `copy`: the existing language checker rejects it once, with no translation retry or emitted answer.
- Cross-language `translate`: a complete translation passes; variants dropping the actor, personal epistemic limit, conditional consequence, shared lack-of-evidence qualifier, mechanism, or fiction boundary are rejected by the existing semantic verifier.
- Frame-only addition: translation adds a writing/recording act or adjacent fact present only in the original frame and is withheld.
- Exact binding: unknown, stale, duplicate, foreign, and unframed evidence IDs fail; current line bytes are used rather than archived receipt text or model reading.
- Strict branches: copy with model text, translation with null/missing text, extra fields, trailing JSON, and truncated JSON fail closed.
- Empty selection: zero blocks plus a bounded missing concept remains a normal unanswered result when the record does not answer.
- Route boundaries: two framed records, framed plus ordinary evidence, a document/observation, no resolved output language, or multiple evidence items use the unchanged legacy path.
- Independent-neighbor disclosure: a one-line invented record with a relevant qualified clause and an unrelated clause records the chosen complete-record policy; if that output is unacceptable, the pilot must not activate for it.
- Multi-record fiction: fictional content and an actual proposal in separate records never enter the constrained pilot or get concatenated.
- Presentation/injection: a verified managed list prefix, visible status label, Markdown-looking content, citation-like text, and a source-looking instruction exercise canonicalization and all current guards.
- Limits: the maximum 400-character retained body, maximum frame, and 2,000-character translation remain within the existing generation/verifier ceilings without truncation; malformed maximum-size results fail once.
- Call accounting: one generation, its unchanged language check when configured, and one verifier; no repair, retry, detector, or hidden second semantic pass.

## Comparison with further narrow repairs

For a single framed record, this pilot is structurally stronger than adding more generation examples: exact copy cannot omit a clause, and translation has an explicit complete-record boundary. It addresses the common shape behind English paraphrase omissions, frame-only provenance acts, and Russian qualification losses without weakening admission.

It is not a replacement for narrow guards or prompt fixes elsewhere. The translation branch can still omit or distort meaning, branch selection is fallible, and multi-record/mixed answers remain on legacy composition. A general complete-record renderer would introduce a larger disclosure and synthesis policy change than the failures justify. Ship only the bounded route above, retain every existing rejection gate, and broaden it only after exposed evidence shows that record-level rendering is useful without unacceptable irrelevant disclosure or availability loss.
