# V62 built-package source-first forensic audit

This audit uses the original four V19-development/V18-held sources in [`language-v19-blind-inputs.json`](language-v19-blind-inputs.json), the frozen report [`language-built-reliability-v62.json`](built-reliability.json), all 147 rows of its [trace](../../../../bench-results/language-built-reliability-v62-trace.jsonl), and [`language-built-output-packet-v62.json`](language-built-output-packet-v62.json). The earlier report-only assessment remains unchanged in [`built-report-preliminary.md`](built-report-preliminary.md). I did not inspect grading receipts or fresh held-out data, call a provider, or alter runtime files.

## Disposition

- **Retention:** all eight extracted candidates were source-faithful and passed deterministic and semantic retention checks. Seven were written. The generic no-handover-booking denial in `v18-held-rejected` was held at placement with exact fields `holdStage=placement`, `reason=routing_uncertain`, and `routingReason=ownership_uncertain`. Therefore three of four sources have complete retained sets; the rejected-offer set retains its principal offer record but loses one independent source proposition. The report's case-level `usefulRetentionCoverage=4/4` describes usable case coverage and does not make that set complete.
- **Retrieval:** every one of the 32 query rows retrieved one relevant, qualified record. No focused query retrieved an unrelated sibling. The focused offer answers remain useful without the separate no-booking denial, and question answers may select the question record without restating separately retained no-answer/note records.
- **Answers:** 30 of 32 rows produced answers. I find all 30 public answers source-entailing, materially qualified, and in the requested answer language. The two nulls are both writable-case false abstentions for `v18-held-report`: one empty generation and one source-faithful Russian draft rejected by a mistaken bilingual object comparison. The runtime correctly obeyed the negative verdict in the second case, but that correct gate action still loses a useful answer for the source case.
- **Availability and integrity:** zero case availability failures, zero answer-operation failures, zero language-policy rejections, and zero source-byte changes. Every case reports `bytesStable=true`, `retentionAvailabilityFailure=false`, and `availabilityFailure=false`. Across 147 trace rows, there are no `ok=false` responses, schema errors, or non-null provider reasons. The answer and retention ceilings are both 2,400 tokens.

## Retention mechanics by case

### `v18-held-report` — direct positions 0 and 1, both written

Position 0 is a source-report claim: Ada Marlow relays only Bo Winters' words that the terms permit sending Zephyr QX-100 to a technician for regulator calibration rather than regulator replacement; Ada has not seen the terms or received confirmation. Position 1 separately preserves Ada's direct denial that she instructed collection of the product. Both use exact source spans and pass the single verifier call at trace row 3 with all three semantic booleans true.

The first record combines the English sending/destination statement with the Russian corrective calibration/replacement statement. I read `калибровка регулятора, а не замена регулятора` as the source's explicit clarification of the earlier English `dial` referent. The retained regulator wording therefore follows the complete bilingual original rather than outside lexical inference. Bo remains the inner reporter, Ada the outer recorder and owner of the two personal verification limits. `time=null` correctly does not promote permission into a booked service.

Both ownership decisions route to the product page. The denial's `subject=Ada Marlow` preserves her as the actor who did not give an instruction; product placement does not change that role. No report proposition is lost. Full coordinates and the eight answer attempts are also recorded in the preliminary note.

### `v18-held-question` — direct positions 0, 1 and 2, all written

Trace row 37 extracts:

1. Ada's unresolved question about whether the Zephyr QX-100 service agreement includes preventive filter cleaning (`kind=question`, `commitment=none`, active).
2. Ada's personal statement that she still has no answer, with the agreement/filter question made explicit.
3. The note-level statement that it establishes neither inclusion nor exclusion of that cleaning.

Rows 38–39 semantically verify positions 0–1 and position 2 in two bounded calls. Every exact support span is present in its frame; all comparisons and the three semantic dimensions are true. The records keep distinct epistemic subjects: Ada lacks an answer, while the note establishes neither outcome. No record answers the embedded coverage question or creates a cleaning booking. Ownership writes the question and note-level record through their proposed product/agreement pages and routes Ada's personal no-answer record to the existing product page. The resulting set preserves all original propositions.

### `v18-held-rejected` — direct positions 0 and 1; position 1 lost at placement

Trace row 76 extracts two source-faithful candidates in their original positions:

1. A rejected plan record stating that Ada declined the offer to send Zephyr QX-100 to the service centre for a thermostat measurement, has no plan to send it under that offer, and that the offered shipment was rejected rather than accepted.
2. A negated claim: `Ada Marlow states that no handover of the device has been booked.`

Both pass the row-77 full-source verifier. Position 0 retains the offered action, service-centre destination, measurement purpose, Ada's no-plan state, and rejection/acceptance contrast. Position 1 stays generic because its only frame is the exact second-item denial; it does not invent that the generic `device` is Zephyr QX-100.

Position 0 receives `selection=proposed` and is written. Position 1 has `page=null`; the ownership payload offers only `uncertain` or the product page, and row 79 returns `selection=uncertain`. The report consequently records `ownership_uncertain` at placement and writes only one item. This is a placement loss of a valid independent denial, not a semantic rejection or provider failure.

There is no retention repair trace or repair usage in this or any other case. In particular, V62's restrictive naming branch is **not exercised**: the generated text contains no `the device referred to as Zephyr QX-100` tail, so it passes as an ordinary generic negative subject. Because the candidate has no validation hold, the failed-position repair mechanism never runs. The live run demonstrates the reordered extraction wire shape but cannot causally establish that field order improved generation, and it does not validate the new naming-tail branch beyond the frozen compiled/local controls.

### `v18-held-alternatives` — direct position 0, written

The sole candidate at trace row 113 preserves the entire original unit: Ada considers two competing explanations for Zephyr QX-100 failures, a **loosely inserted internal connector** or a faulty temperature probe; both remain assumptions, neither has evidence, and Ada selected neither cause. It uses tentative commitment, active disposition, self-attested provenance, and `time=null`. Row 114 keeps Ada as both the considering and nonselecting actor and preserves the loose-insertion mechanism rather than broadening it to installation. Ownership routes it to the product page. The retained set is complete.

## Focused answer audit

Every nonempty draft uses the complete-one-record renderer with only E1. Copy mode returns the exact current readable record; translate mode supplies one complete translated block. Every verifier input has immutable answer anchors, E1 qualification, the retained excerpt, and the exact original-frame anchors. The complete-record verifier omits the user query, while generation retains it. All 31 nonempty drafts pass language checking, and every verifier verdict reports `excerpt_selection.selected_by_retained_excerpt=true`. No answer selects private frame text as a separate proposition.

### Report: 6/8 produced, 2 false abstentions

The six published report answers preserve Ada/Bo roles, permission to send the device to a technician, regulator calibration rather than regulator replacement, and Ada's lack of seeing the terms or receiving confirmation. English copies and Russian translations remain qualified; none says the service was booked or performed.

- Rows 14–15 return `blocks=[]` and `missing_concepts=["A service report specifically about dial calibration"]`. There is no language or verifier call because no draft exists. Under the complete bilingual clarification described above, E1 answers the question, so this is an unjustified empty-draft abstention.
- Rows 32–35 generate a source-faithful Russian translation. The verifier's exact failing fields are `source_alignments[0].object_and_mechanism.relation=changed`, `proposition_supported=false`, and `action_arguments_preserved=false`; qualification and excerpt selection remain true. Its `source_context`, `source_meaning`, and mismatches use the English dial phrase while failing to reconcile the Russian clarification at source anchor `E1_da7fc5167671_4`. The report records `answerReason=verification_rejected` and `rejection_counts.semantic_support=1`. Withholding is consistent with the returned verdict, but the verdict is a false hold on the complete source.

Some passing verifier `source_context` strings contain malformed tails (`received confirmation-of`, `received2`, `received independent`, and `confirmation of12`). The immutable anchor details, comparisons, booleans, and public answers still preserve the no-confirmation statement. These are fallible private narrative defects, not public claims or evidence that a schema failed.

### Question: 8/8 produced

All answers identify Ada's unresolved question: whether the service agreement includes preventive cleaning of the Zephyr QX-100 filter. `Open question`, `Открытый вопрос`, `нерешённый`, and `неразрешённый` preserve the open status without asserting inclusion, exclusion, or a booking. Selecting the question record alone is sufficient for this focused “which question” query. Ada's separate no-answer and the note's separate inconclusiveness remain in retained memory and are not silently converted into a universal ignorance claim.

Four rows have `answerOutcome=partial` while still reporting `answerReason=answered`, one generated/passed/verified block, empty degradation arrays, and a complete public answer. Their `contextStatus=empty` is recorded, but the report provides no more specific causal field; I do not infer content loss from the coarse `partial` envelope.

### Rejected offer: 8/8 produced

All eight answers preserve Ada as the person who declined the offer, Zephyr QX-100 as the item to be sent, the service centre and thermostat-measurement purpose, absence of a plan under that offer, and rejected rather than accepted disposition. Russian translations preserve the same roles and restrictions. No answer promotes the offer to an accepted plan, a booked handover, or a completed measurement.

The focused question asks which offer Ada declined, so E1 alone provides a complete answer even though the separate no-handover-booking record was lost during placement. The answer success must not be used to call the retained source set complete. As in the question case, `partial` rows have verified blocks and no typed degradation; the report does not attribute them to semantic incompleteness.

### Alternatives: 8/8 produced

All answers preserve both alternatives, the loose insertion relation for the connector, the faulty temperature probe, tentative/assumption status, common lack of evidence, and Ada's nonselection. They say Ada is considering the explanations rather than upgrading either to a cause. The generator occasionally notes privately that the source says `considering` rather than literally `discussed`; the public answer still responds usefully by naming the requested hypotheses without inventing a separate discussion event.

Several passing private `source_context` strings end in mixed-script or malformed fragments (`not選`, `no原因`, `no202`, or an incomplete `has not`). Their anchored actor/object/qualification relations, all three booleans, selection, and public prose are consistent with the source. They are diagnostic-quality defects only. I found no public source, qualification, actor, mechanism, or language error in these eight rows.

## Result boundaries

The frozen report's structural metrics are internally consistent: 30 answered, one `empty_draft`, one `verification_rejected`, one placement `ownership_uncertain`, 31 verifier calls for 31 nonempty drafts, and no schema/provider failure. My independent semantic disposition is 30 faithful public answers, two unjustified writable-case abstentions, seven of eight source-faithful candidates written, three of four complete retained sets, and 32 focused retrievals with useful qualified evidence.

The evidence supports two bounded observations for later work without changing V62: source-clarification comparison remains unstable in two report combinations, and the naming-tail floor cannot help when extraction emits a valid but unrouteable generic denial. The latter requires a source-authorized extraction/placement path if addressed; treating speaker metadata, a generic `device`, or a generated subject as ownership proof would be unsound. No threshold, retry, extra pass, or broad ownership relaxation follows from this audit.
