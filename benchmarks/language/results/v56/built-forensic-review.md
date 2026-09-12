# V56 built-package source-first forensic audit

Frozen runtime: `affce0d`. I read the original development inputs in `language-v19-blind-inputs.json` before the retained records and outputs in `language-built-output-packet-v56.json`, then used `bench-results/language-built-reliability-v56.json` and its trace to determine execution outcomes. I did not read an independent grading receipt. Raw generations, private `record_readings`, and verifier `source_context` are treated as fallible diagnostics rather than published claims.

## Result and disposition

The four writable cases retained a complete useful set, all four query families retrieved relevant qualified evidence, and the source trees stayed byte-identical. The 32 answer rows produced 30 published answers, one `verification_unavailable` null, and one `verification_rejected` null. The report's availability metric is therefore 1/4 cases and the answer-operation-failure metric is 1/32 rows. Both nulls are unjustified writable-case abstentions because their sources offer faithful answers. The rejected-offer null correctly withholds a bad draft; the question null arises from an invalid verdict whose intended semantic objection also crosses the selected-record boundary.

I find no definite source, qualification, promotion, or answer-language defect in the 30 published answers. The report case has a real bilingual-interpretation boundary described below. Under the stricter reading that its Russian sentence clarifies the English term, three accepted variants preserve the terms as alternatives or separate formulations rather than resolving them. Under the literal two-item reading used by the retained record, those variants remain faithful. This uncertainty is not hidden in the zero-definite-error assessment.

V56 exercised the complete-record pilot in 24 generations: 12 `copy` and 12 `translate`. The report's selected canonical record is 405 characters after removing only the list prefix, so all eight report generations correctly used the legacy schema at the 400-character bound. Of the 24 pilot generations, 12 copies and 10 translations were published; the two withheld rows were translations. The copy branch itself emits only `rendering_mode: "copy"` and E1, after which the server materializes the exact current canonical E1 bytes. The published English copy answers match those bytes, apart from the appended citation.

The answer ceiling recorded by the benchmark is 2,400 tokens for both answer roles. Every generation and verification call returned a transport-level result. No published block or valid semantic verdict was truncated for budget. The question verifier's structurally invalid verdict is a content/schema failure after a full 1,252-token response, not an output-ceiling failure.

## `v18-held-report`

### Source, retention, and selection

The source says that Ada Marlow relays Bo Winters's statement that the Zephyr QX-100 service terms permit sending the device to a technician for dial calibration. Its Russian item says she relays only Bo's words: regulator calibration is permitted, not regulator replacement. Ada has neither seen the terms nor received confirmation. Independently, Ada says she gave no instruction to collect the device. Permission is not an arranged shipment.

Trace rows 2–5 extracted, verified, and placed a complete two-record set:

1. E1, a `source_report`, preserves Ada as outer relayer, Bo as inner speaker, sending to a technician for calibration, dial/regulator wording, calibration rather than regulator replacement, and both of Ada's personal limits.
2. E2, a self-attested negated claim, preserves Ada's denial that she instructed collection of the Zephyr QX-100.

Every query retrieves only E1, which is the relevant record for the report question. E2 remains independently retained and is not incorrectly pulled into the answer. E1's current line is 407 characters with the list prefix and 405 canonical characters after removing it, so trace rows 7, 10, 13, 16, 19, 22, 25, and 28 all use legacy composition. That is the designed length fallback.

### Published answers and interpretation boundary

All eight published answers preserve the named attribution chain, permission rather than performance or booking, technician-directed sending, calibration rather than regulator replacement, and Ada's personal lack of viewing the terms and receiving confirmation. The RU-query rows may focus on regulator calibration, while the broader variants also carry dial calibration. None permits replacement or says the device was collected.

The source's two items support two readings. If `разрешена калибровка регулятора` is a bilingual clarification of `dial calibration`, E1's wording—`described as dial calibration in one statement and regulator calibration in another`—fails to resolve that equivalence. Published q2 (trace 10) says `либо ... либо`; q4 (trace 16) says `в одном варианте ... в другом`; q8 (trace 28) says `в одном изложении ... в другом`. Those formulations present alternatives or separate renderings. If the source is read conservatively as two independently recorded formulations, the retention and outputs accurately preserve both without guessing equivalence. This is the only material nonnull interpretive concern I found.

The words `якобы сообщил` in q2 and `предположительно, сообщил` in q8 can sound as though the occurrence of Bo's report is uncertain. In context they sit inside `По словам Ada Marlow` and correspond to E1's `reportedly said`; under the established scoped `source_report` convention I do not count them as global doubt or a false denial that Bo spoke.

Private `record_readings` are less reliable than the blocks: trace row 7 ends one with `받?`, row 13 with invisible trailing characters, row 16 with `сo`, and row 28 with a foreign final glyph; some clarification fields also stop mid-thought. None of those strings is published, used as citation authority, or copied into the corresponding answer. They show scratch-field corruption without an accepted answer defect.

## `v18-held-question`

### Source, retention, and pilot behavior

Ada records her unresolved question: whether the Zephyr QX-100 service agreement includes preventive filter cleaning. She still has no answer, and the note establishes neither inclusion nor exclusion.

Trace rows 31–34 retain the complete two-record set: E1 is the open unresolved question, and E2 preserves Ada's lack of an answer and the note's neutral inclusion/exclusion status. All eight queries retrieve focused E1. That selection is sufficient for a question asking which question Ada recorded: the visible labels `Open question` and `unresolved question` preserve non-resolution without asserting coverage, exclusion, or a booking. E2 remains retained for queries that ask about the absence of an answer.

All eight generation calls activate complete-record rendering. The four English rows choose `copy`; their published prose is byte-for-byte canonical E1 plus citation. The four Russian rows choose `translate` and preserve the complete selected record. Seven answers publish and remain faithful.

### q6 null: invalid verdict and wrong selected-scope objection

For q6 (RU query, inferred view, RU answer), trace row 51 produces the faithful translation:

> Открытый вопрос: нерешённый вопрос Ada Marlow заключается в том, включает ли сервисное соглашение Zephyr QX-100 профилактическую чистку фильтра.

The draft contains the whole selected E1 and does not answer the question as fact. Trace row 52 returns a verifier judgment whose intended objection is that the answer omits the original frame's wording that Ada recorded the question herself. That objection is outside complete-record selection: E1 identifies the question as Ada's but does not retain the recording act, and the private original frame constrains E1 rather than expanding what complete-record rendering must state. The seven accepted copy/translation siblings make the inconsistency concrete.

The response is also structurally invalid. It sets `actor.relation` to `omitted` while supplying non-null answer anchor `B1_233be29af1c1_1`; the live schema requires a null answer anchor for an omitted relation. The local parser therefore cannot use the otherwise complete response, producing `verified_blocks: null`, `answer_verification_failed`, and report reason `verification_unavailable`. This is a genuine one-row availability failure and an unjustified writable-case abstention. It is not a published source error, because the faithful draft is withheld.

The smallest supported correction is to state in the existing verifier contract that an original-frame recording act is not a mandatory selected proposition when the retained complete record identifies the question but does not retain that act. The local omitted/anchor invariant should remain strict; weakening it would accept internally contradictory audits.

## `v18-held-rejected`

### Source, retention, and selection

Ada declined an offer to send the Zephyr QX-100 to the service centre for a thermostat measurement and says she has no plan to send it under that offer. Separately, no handover was booked, and the offered shipment was rejected rather than accepted.

Trace rows 60–63 retain both required records: E1 contains the declined offer plus its coupled no-plan statement; E2 contains Ada's no-booking statement. This is the complete retained set and introduces no accepted plan, measurement, or handover. All queries retrieve E1 because they ask which offer was declined. E2 is a separate useful retained denial but need not be appended to that focused answer.

All eight calls activate the pilot. Four English copies materialize exact E1. Four Russian branches translate all of E1, including the no-plan qualification. Seven publish. Their `измерения термостата` wording stays generic; q8's `измерения параметров термостата` follows the Russian query and still names generic parameters rather than inventing a particular measured property.

### q2 null: correct rejection of a bad translation, lost case coverage

Trace row 68 translates `a thermostat measurement` as:

> ...для измерения температуры термостата...

That introduces temperature as the particular measured property. Trace row 69 correctly marks `object_and_mechanism` changed, both proposition and action-argument support false, and excerpt selection false. The runtime publishes nothing and reports `verification_rejected`, with one `semantic_support` rejection. This is correct handling of that draft and demonstrates that complete-record rendering does not bypass the mandatory semantic verifier.

The case still offered an easy faithful answer, as the three other Russian translations demonstrate. Accordingly q2 remains an unjustified writable-case abstention for answer coverage, while the runtime's rejection decision itself is sound. The smallest supported improvement belongs in the existing translation instruction: translate an unspecified measurement without choosing a measured property. A dictionary, automatic retry, or verifier relaxation is not supported by this evidence.

## `v18-held-alternatives`

The Russian source says Ada is considering two competing explanations for Zephyr QX-100 failures: a loosely inserted internal connector or a faulty temperature probe. Both remain hypotheses, there is no evidence for either, and Ada has selected neither cause.

Trace rows 89–91 retain one complete qualified E1 containing both alternatives and every shared qualifier. Every query retrieves E1. All eight generations activate the pilot: four English answers copy canonical E1 exactly, and four Russian answers translate the entire record. All eight publish.

The Russian translations preserve Ada as the considering/nonselecting actor, the insertion mechanism (`неплотно вставленный`), the faulty probe, the fact that both are hypotheses, the absence of evidence for either, and the absence of a selected cause. Some negative-evidence clauses are stylistically compressed (`доказательств ни одного объяснения нет`, `доказательств ни в пользу одного из объяснений нет`), but in the full sentence they do not establish either cause or change the common qualifier. I find no accepted defect here.

## Control and boundary conclusions

- Retention, placement, retrieval, and source-byte preservation are complete in all four cases: 7 relevant records were retained in total (2 + 2 + 2 + 1), and every one of the 32 rows retrieved a relevant qualified E1.
- The 400-character gate operates on current canonical visible text, not the generated body or historical receipt. The 405-character report record falls back; the 142-character question, 177-character rejection, and 282-character alternatives records use the pilot. No script, private configuration, or historical language receipt chooses copy versus translation.
- Copy mode demonstrates exact-current-record preservation for 12 English generations. Translate mode preserves complete selected scope in 10 published answers and produces the only two nulls. The verifier catches one semantic narrowing and mishandles one frame-only recording act.
- Original frames remain private constraint evidence. The question q6 failure shows why a verifier must not turn a frame-only act into a required clause of a complete selected record. Conversely, the rejected q2 hold shows that the frame remains useful for detecting a translation that narrows the mechanism.
- The existing language check remains mandatory after branch materialization. These four cases contain no wrong-language branch choice, so this corpus establishes successful copy/translation behavior for the chosen rows, not general correctness of the model's branch choice.
- The bounded next scope supported by this run is limited to the question verifier's selected-record/frame guidance and the translation instruction against choosing an unstated measured property. The report record's 405-character fallback is evidence for evaluating the length boundary separately, but it is not itself a correctness or availability failure.
