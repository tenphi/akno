# V51 built forensic review

## Scope

I independently read `bench-results/language-built-reliability-v51.json`, `bench-results/language-built-reliability-v51-trace.jsonl`, `tmp/language-built-output-packet-v51.json`, and the frozen V51 implementation only where needed to interpret a result. I did not inspect the independent V51 grade, contact its grader, edit code or tracked files, make live calls, or retry any runtime judgment.

## Outcome and causal counts

The V50 transport failure is resolved. All four retention-verifier calls returned complete semantic verdicts with token usage. Five of six proposed candidates were written:

| Case | Proposed | Written | Held | Nonnull answers | Primary loss |
| --- | ---: | ---: | ---: | ---: | --- |
| `v18-held-report` | 2 | 2 | 0 | 6/8 | one empty English draft; one English block safely rejected |
| `v18-held-question` | 1 | 0 | 1 | 0/8 | conservative semantic false hold |
| `v18-held-rejected` | 2 | 2 | 0 | 8/8 | none material |
| `v18-held-alternatives` | 1 | 1 | 0 | 8/8 | none material |

The aggregate has 22 nonnull answers from 32 query variants, including 22/24 variants whose case retained relevant knowledge. The other eight nulls all belong to the question that was withheld at retention. There are no model-operation or typed availability failures in the result; the losses are valid fail-closed semantic outcomes and generation choices, not transport failures.

Trace coordinates by case are:

- report: retention/extraction line 2, retention verifier line 3, placement lines 4–5, answer calls lines 6–27;
- question: retention line 29, verifier line 30, no placement or answer call;
- rejected offer: retention line 32, verifier line 33, placement lines 34–35, answer calls lines 37–59;
- alternatives: retention line 61, verifier line 62, placement line 63, answer calls lines 65–87.

Result case records begin at lines 169, 823, 1121 and 1779. Their retained counts are at lines 246, 865, 1198 and 1836. Packet cases begin at lines 6, 287, 379 and 660.

## Retention findings

### Multi-span bilingual report: accepted and source-faithful

The original source at packet lines 18 and 24 says that Bo Winters reported permission to send the device to a technician for **dial calibration**, followed by Ada Marlow's explicit Russian relay that the permitted action is regulator calibration rather than regulator replacement and that she neither saw the terms nor received confirmation.

The retained record at packet line 39 preserves the full structure:

> “Ada Marlow reports that Bo Winters said the Zephyr QX-100 service terms permit sending the device to a technician for calibration of its regulator, not replacement of the regulator; Ada Marlow has not seen the terms herself or received confirmation of this message.”

The verifier's F1 interpretation at trace line 3 records Bo as the reported speaker, the permitted sending, technician and dial calibration, and separately identifies Ada's no-collection-instruction statement as outside this candidate. F2 explicitly says that Ada relays only Bo's words, “clarifying dial calibration as calibration of the regulator and excluding regulator replacement,” then records her lack of access and confirmation. The aggregate `source_meaning`, action arguments and qualification scope repeat all of those facts and return three true dimensions.

The positive Russian clarification therefore did reach and affect retention verification. The prior dial/regulator conflict did not recur there. Both source-span IDs and original quote bytes are present, and the sibling statement was separately written at packet line 57:

> “Ada Marlow has given no instruction to collect the Zephyr QX-100.”

The two audit interpretations reach their 240-character allowance awkwardly—F1 ends with malformed trailing text and F2 ends mid-phrase after “confirmation of the”—but both cover the deciding content before the cut, and the aggregate comparison completes it. This is audit-prose quality loss rather than a retained semantic error; the audit remains a fallible note, not evidence.

### Open question: conservative false hold on grammatical attachment

The source at packet lines 299 and 305 is an unanswered question about whether the service agreement includes preventive filter cleaning. It separately says, “I still have no answer. This note establishes neither inclusion nor exclusion of that cleaning.” Extraction proposed:

> “Ada Marlow has an unresolved question about whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter, and she has no answer establishing either inclusion or exclusion.”

At trace line 30, F1 accurately identifies Ada's unresolved question. F2 accurately records both her lack of an answer and the note-level non-establishment of inclusion and exclusion. The verifier then rejects the candidate because its grammar attaches “establishing either” to the absent answer rather than explicitly repeating that the note establishes neither.

On direct source comparison, this is a conservative false hold. If Ada has no answer at all, the narrower statement that she has no answer establishing inclusion or exclusion is entailed. The candidate remains an unresolved `question` with commitment `none`, names Ada, and asserts neither coverage nor exclusion. It does omit the source's explicit note-as-epistemic-subject wording, but it preserves the practical scope guard and introduces no contrary proposition. The case expectation explicitly allows a faithful description of the recorded open question.

This single semantic model verdict causes all eight question nulls: no record reaches placement, every query has zero retained evidence, and answer generation is never called (packet lines 318–374; result lines 865–1107). It is a genuine usefulness failure without a degraded operation or unsafe acceptance. A narrow correction would keep the two source clauses explicit in generated composition—“she still has no answer, and her note establishes neither inclusion nor exclusion”—rather than weakening the verifier's general source-subject rule.

### Rejected offer and separate booking denial: both preserved without repair

The source at packet lines 391 and 397 records three compatible facts: Ada declined the offer to send the device for thermostat measurement, has no plan to send it under that offer, and no handover is booked; the offered shipment was rejected rather than accepted.

Unlike V50, the V51 extraction at trace line 32 directly produced two clean candidates:

1. a rejected plan combining the declined offer, no plan under it, and rejection rather than acceptance;
2. a separate negated claim that no handover of Zephyr QX-100 has been booked.

No repair call occurred, and `repair_obligations` is empty at trace line 33. That is correct: there was no repaired position to constrain. Both candidates have two-span frames, and their audits distinguish the rejected offer from the no-booking proposition while using the first item only to resolve “the device” as Zephyr QX-100 for candidate 2. Both received all-positive semantic verdicts and were placed on the existing Zephyr page. The persisted lines at packet 412 and 430 retain the full set and correct typed disposition/polarity.

The earlier changed-proposition repair failure therefore does not recur. This run does not exercise the repair-obligation mechanism itself; it shows the model avoided needing it.

### Personal competing alternatives: retained with actor and common limits

The Russian source at packet line 672 names Ada as the person considering two competing explanations: a loosely inserted internal connector or a faulty temperature probe. It says both remain hypotheses, neither has evidence, and Ada selected neither cause.

The retained line at packet 687 preserves all of this in one record, with tentative commitment and Ada as `source_speaker`:

> “Ada Marlow is considering two competing tentative explanations for Zephyr QX-100 failures—an internal connector being loosely inserted or a faulty temperature probe; both remain unsupported by evidence, and she has selected neither cause.”

Trace line 62 explicitly compares both alternatives, the shared absence of evidence, and Ada's personal nonselection. No actor is generalized to an unassigned state and neither hypothesis is promoted to a cause. The single original item intentionally receives no multi-span audit.

## Placement and retrieval

All five accepted candidates receive `selection: "page_1"` from the ownership model (trace lines 4–5, 34–35 and 63), the already existing Zephyr QX-100 page. No proposed page or uncertain routing is selected. The report, rejected plan, booking denial and alternatives appear under `memory/equipment`; placement is coherent with their shared product subject. The question has no placement call because it was held first.

Retrieval selects the relevant discourse record in every written case:

- report queries retrieve the qualified nested report and leave the unrelated no-collection instruction out;
- rejected-offer queries retrieve the rejected plan and need not repeat the independently stored booking denial to answer which offer Ada declined;
- alternatives queries retrieve the one tentative competing-hypotheses record;
- question queries retrieve nothing because the only candidate was withheld.

Every query reports `recallStatus: "ok"` with no recall degradation. The `contextStatus: "empty"` field is not evidence that answer retrieval failed: the query records simultaneously show one retained evidence item, and the answer trace shows that item supplied to generation. It describes the separate context activation result. The ordinary note in each workspace concerns another fact and is not a substitute for the missing managed question.

All 24 answer-generation calls and all 23 answer-verifier calls carry the archived `retention_source_frame`; the report's two-language source is therefore available at both stages. The source-frame bridge is not missing or stale in this run.

## Answer findings

### Report: source clarification survives six answers, but generation invents conflict twice

Six report answers are faithful. They name Ada as recorder and Bo as inner reporter; preserve sending the device to a technician for regulator calibration rather than regulator replacement; and preserve Ada's lack of seeing the terms or receiving confirmation. They do not turn permission into a booking or service event. Russian answers either call the report unverified or state the concrete absence of confirmation; both preserve the source qualification.

The two failures occur only for the English query with English output:

- Trace line 6 receives the full source frame but returns no block and claims that dial versus regulator remains unresolved. This is a false `empty_draft`: the Russian source explicitly supplies the clarification, and retention verification already interpreted it correctly.
- Trace line 11 again reports the invented conflict and generates “calibration rather than replacement,” omitting the regulator as the object of both actions. The answer verifier at trace line 12 correctly rejects it: the generic wording can attach calibration/replacement to the whole device, so `action_arguments_preserved` and excerpt selection are false. This is a safe answer rejection, not an accepted source error.

An English-query/Russian-output draft at trace line 14 also lists the dial/regulator identity as missing while producing a correct regulator-specific block. The block is accepted, so the public answer is useful but marked partial. This shows the conflict survives in generator control prose even when the generated answer itself uses the clarification.

The failure is thus inside answer generation's source interpretation, not missing source context, retention loss, retrieval, or the verifier. No dictionary or alias fact is needed: the original second span expressly restates the reported content and names regulator calibration.

### Rejected offer: eight supported focused answers

All eight outputs identify the declined offer, sending the device to the service centre, and thermostat measurement. Each keeps the offer/shipment rejected or declined; several additionally preserve no plan under the offer. The shorter answers omit the separate no-booked-handover fact, which is a supported focused subset for a query asking which offer was declined and does not imply that a booking exists. No answer promotes the offer into an accepted plan, shipment or completed measurement.

Four results are labeled `partial`, but their model drafts contain no missing concepts and the visible answer text resolves the requested offer. That status comes from broader query-coverage accounting, not a source contradiction in these answers.

### Alternatives: eight supported answers; tense and source-description framing are not new facts

All eight outputs preserve Ada as the person considering the alternatives, both component hypotheses, tentative/unconfirmed status, no evidence for either, and Ada's nonselection of either cause. None establishes either fault as true.

The answer at packet line 808 uses Russian past imperfective `рассматривала` where the undated source says present `рассматриваю`. It does not claim a later endpoint, resolution, or that consideration ended; in the past-tense question's narrative frame, this is ordinary backshift rather than a changed temporal fact. It is not counted as an accepted semantic error.

The answer at packet line 834 adds: “The record describes her considering these alternatives, rather than explicitly establishing that she discussed them.” This is awkward meta-level framing prompted by the query's “discussed” versus the source's “considering.” It does not add a product event, personal action, selected cause or epistemic conclusion. The verifier at trace line 78 treats it as a source-description distinction. I classify it as narrative framing and possible concision loss, not a new domain fact.

The four `partial` labels for Russian-query variants similarly reflect the query wording around “discussed”; the actual answers preserve the complete source-supported hypothesis set.

## Accepted-error audit

- **Accepted retained source errors:** none found. The five written records are each entailed by their original source in content and scope.
- **Accepted retained qualification errors:** none found. Nested report attribution and lack of confirmation, rejected disposition, booking negation, tentative alternatives, shared lack of evidence and personal nonselection all survive.
- **Accepted answer source or qualification errors:** none found among 22 nonnull answers. The only source-ambiguous generated report block is rejected before publication.
- **Accepted language errors:** none found. Requested English and Russian prose is respected while names and the product identifier remain unchanged.
- **Unsafe factual promotion:** none found. No report becomes verified fact, no open question is answered, no rejected offer becomes a plan or event, and neither tentative hypothesis becomes a selected cause.

The open-question hold remains my independent forensic disagreement with the retention verifier: it is a false negative caused by attachment wording, not evidence that the candidate resolved coverage. The report generator's dial/regulator abstentions are also false negatives because they ignore an explicit source clarification already available in the call. Both reduce usefulness without admitting unsafe content.

No case contains a source-clock claim, and all retained candidates have `time:null`; source-clock behavior is outside this diagnostic.

## Evidence limits

This run is a selected development diagnostic, not the complete release gate. Span interpretations and semantic verdicts remain model judgments. The evidence establishes that V51's transport schema works on these four calls and that source frames reach answer generation/verification; it does not establish general provider compatibility or semantic reliability on unexposed inputs.
