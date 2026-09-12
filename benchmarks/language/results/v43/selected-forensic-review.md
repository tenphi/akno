# V43 selected-probe forensic review

Scope: original-source audit of the V43 selected report, trace, and output packet. Internal acceptance is not treated as semantic ground truth. This is not the independent grading receipt.

## Overview

- All four cases retained at least one useful record. Three retained sets are materially complete. The rejected-offer case again lost the independent no-handover-booking fact, this time during structural repair and semantic obligation checking rather than destination ownership.
- Thirty-one of 32 answer combinations are non-null. The sole null follows a justified rejection of a bad draft, but it remains an answer-coverage loss because the writable evidence could support a faithful answer.
- Two accepted undated EN-to-EN answers lose Ada Marlow as the embedded proposer by replacing `Ada Marlow proposed` with outer attribution, `According to Ada Marlow, the proposal was ...`. I found no other accepted source-meaning, qualification, language, or promotion error. In particular, the earlier unsupported temperature specialization is absent. Two Russian answers use generic thermostat `parameters`, which selects no particular measured property and remains within the V43 stated contract.

## `v18-held-report`, run 1

Retention is complete. The main record preserves Ada Marlow as outer relay, Bo Winters as the inner source of the reported permission, sending Zephyr QX-100 to a technician, calibration of the dial/regulator rather than replacement, and Ada's lack of access to the terms and independent confirmation. A second record preserves Ada's separate statement that she gave no collection instruction.

All eight focused report answers are non-null and source-faithful. Each keeps Bo as the source of the permission and Ada as its outer relay, retains calibration versus replacement, and states that the report is unverified because Ada did not see the terms or receive confirmation. The focused answers need not repeat the separate collection-instruction fact, and most do not. I found no accepted error.

## `v18-held-rejected`, run 1

The persisted rejected-plan record is faithful: Ada declined the offer to send Zephyr QX-100 to the service centre for thermostat measurement and said she had no plan to send it under that offer. It does not assert shipment, booking, or acceptance.

The independent no-handover-booking fact was available in the complete source but did not persist. The exact path differs from V42:

1. Initial extraction did generate a separate negated claim, resolved `the device` to Zephyr QX-100, and stated that no handover had been booked. It also attached the adjacent rejected-shipment statement to that candidate.
2. Structural cleaning held that candidate as discourse-uncertain.
3. The single repair replaced its original position with a duplicate of the declined-offer/no-plan record instead of preserving the no-booking proposition.
4. The semantic verifier used the repair obligation and correctly rejected the replacement for changing the required proposition. Only the independently admitted original rejected-plan candidate persisted.

This is a generation/structural-repair completeness loss, not an ownership uncertainty on reduced routing input and not a false semantic rejection. The repair guard worked as designed by preventing the sibling proposition from laundering the lost denial.

All eight focused offer answers are non-null and correctly identify Ada, the declined offer, Zephyr QX-100, the service-centre destination, and thermostat measurement. The longer explicit-view answers also preserve Ada's no-plan statement; the shorter answers permissibly omit that incidental detail for the question asking which offer she declined.

The earlier unsupported `измерение температуры термостата` does not recur. Four Russian answers say either `измерение термостата` or `измерение параметров термостата`. The latter is generic and does not select temperature or another particular property, method, or result. On these observed inputs it does not add the specificity that V43 is meant to reject. This successful sample does not by itself prove that the prompt change caused the improvement or generalizes.

## `v18-held-undated`, run 1

Retention is complete and source-faithful. The record keeps Ada as proposer, review of the Zephyr QX-100 warranty exceptions, proposed/unaccepted status, no arranged meeting, tentative timing, and `next week` relative to an undated source record rather than processing time. It does not invent a calendar week.

Five of the seven non-null answers are source-faithful and preserve the proposer, action, acceptance state, meeting status, source clock, and unknown calendar time. Same-record narrative backshift in `remained`, `had been arranged`, and Russian past forms is permissible and adds no external date. One English answer cautiously says the evidence establishes that Ada proposed the review but does not separately establish that she recorded it; this does not deny the proposal or alter its actor.

Two accepted EN-to-EN answers, for the English query in inferred and explicit planning views, instead say `According to Ada Marlow, the tentative proposal was to review ...`. This construction establishes Ada as the source of the report but leaves the proposal's actor unspecified. The original establishes that Ada herself put forward the proposal. Outer attribution cannot substitute for that embedded action role, consistently with the earlier Russian `По словам Ada, было предложено` failure class. Both answers preserve the action, object, clock, nonacceptance, and lack of meeting, but they are not fully source-entailing or useful because proposer agency is lost.

The semantic verifier accepted both. In the inferred row it described the action as merely `attributed to Ada Marlow`; in the explicit row it said no unsupported actor was added, without checking that the required actor survived. Those comparison notes expose the missed distinction: the verifier treated source attribution as equivalent to action agency despite the existing action-argument requirement.

The sole null is EN query to RU answer with explicit planning view. Its draft begins `Ada Marlow предложила предварительно провести проверку...`. In that grammar, `предварительно` modifies conducting the review, making the review itself preliminary, while the source makes the proposal/timing tentative. The answer verifier correctly rejected the draft across all three semantic dimensions for this scope shift. The resulting abstention is still unjustified at the source/question level: adequate writable evidence was available, so this bad generation consumes useful-answer coverage rather than making silence appropriate.

## `v18-held-alternatives`, run 1

Retention is complete. It preserves both competing explanations, their lack of evidence, Ada as the person considering them, and Ada as the personal nonselector of either cause.

All eight answers are non-null and explicitly bind Ada to both consideration and nonselection. None collapses her personal statement into an unassigned passive. English/Russian alternation between `and` and `or` lists the two competing hypotheses without asserting that both causes jointly hold. Past-tense narrative renderings remain tied to the same undated record and do not add an event date. I found no accepted error.

## Residual classification

The probe leaves four visible output losses:

- one independent no-booking record lost because structural repair changed the original proposition and the repair-obligation verifier correctly blocked it;
- two accepted answers that replace Ada's embedded proposer role with outer source attribution and passed because the semantic verifier conflated attribution with action agency;
- one answer withheld after its draft attached tentative scope to the review action rather than the proposal/timing.

Neither supports weakening the verifier, retrying semantic rejections, or relaxing attribution, personal-agent, clock, or specificity checks. The retained no-booking loss is upstream generation/repair behavior with the complete source available. It should not be described as the V42 ownership model's defensible uncertainty over a reduced candidate input.
