# V44 selected-probe forensic review

Scope: original-source audit of `language-selected-v44`, its trace, and `language-selected-output-packet-v44`. Runtime checks were treated as stage evidence, not semantic ground truth. This is not the independent grading receipt.

## Overview

- All four retained sets are materially complete. The rejected case now preserves the independent no-handover-booking denial as a separate record with no invented booking actor.
- Twenty-eight of 32 answer combinations are non-null. All four nulls follow rejection of genuinely defective drafts, but remain answer-coverage losses because adequate writable evidence was available.
- One accepted undated Russian answer adds an unsupported preliminary-period specification. I found no other material accepted source-meaning, action-role, qualification, language, or promotion error.
- The earlier specific `thermostat temperature` error does not recur. Generic `thermostat parameters` occurs without selecting a particular measured property.

## `v18-held-report`, run 1

Retention is complete. The main record preserves Bo Winters as the inner source of the service-term permission, Ada Marlow as the outer relay, sending Zephyr QX-100 to a technician for dial/regulator calibration, calibration rather than regulator replacement, and Ada's lack of access to the terms and confirmation. A separate record preserves Ada's no-collection-instruction statement.

Six answers are non-null and preserve the nested reporting roles, permission, calibration-versus-replacement contrast, and verification limits. The focused report answers need not repeat the separate collection statement. `Якобы` is somewhat skeptical in tone but, in these sentences, continues to mark Bo's statement as reported/unverified rather than asserting falsity. `Калибровка шкалы` is a plausible rendering of dial calibration and is followed by the source's explicit regulator-calibration clarification; I do not treat it as a material changed object on this evidence.

Two Russian explicit-view drafts are null:

- EN query to RU: `Ada Marlow зафиксировала непроверенный отчёт ...` passed the language check and was rejected by the deterministic attribution guard before semantic verification.
- RU query to RU: `Ada Marlow записала неподтверждённое сообщение ...` passed guards but was rejected by the semantic verifier for assigning Ada a recording action when the source establishes reporting/transmission only.

Both drafts add a recording action from the question's wording rather than the cited evidence. Their rejection is correct and consistent; the first trace exposes only `attribution`, while the second verifier explicitly identifies the changed action. The resulting nulls are nevertheless coverage misses: a faithful answer could describe the relayed report without adopting the question's unsupported recording premise.

## `v18-held-rejected`, run 1

Retention is complete. One rejected-plan record preserves Ada as the person who declined the service-centre thermostat-measurement offer, the rejected/not-accepted disposition, and her no-plan statement. A separate negated claim preserves that no handover of Zephyr QX-100 has been booked. Its text attributes the statement to Ada but leaves the booking agent unspecified, matching the source.

All eight focused offer answers are non-null and identify Ada, the device, destination, thermostat measurement, and rejected offer. Fuller answers retain the no-plan and rejected/not-accepted details; short answers permissibly omit those incidental details when identifying the declined offer. None invents shipment, handover, or booking.

Russian answers use `измерение термостата` or the generic `измерение параметров термостата`. The latter does not select temperature or another particular property, method, or result. The unsupported V42 temperature specialization is absent, though one sample cannot establish that V43/V44 caused or generalized this outcome.

## `v18-held-undated`, run 1

Retention is complete and source-faithful. It preserves Ada as proposer, review of the Zephyr QX-100 warranty exceptions, proposed/unaccepted status, no arranged meeting, tentative timing, and `next week` relative to the undated original record rather than processing time. No calendar week is invented.

Six answers are non-null. Five are faithful: they name Ada as proposer, preserve the action and every clock/acceptance qualification, and any narrative backshift remains within the same undated record.

One accepted RU-query/RU-answer inferred row says:

> По словам Ada Marlow, она предложила на предварительный срок проверить исключения ...

The pronoun correctly keeps Ada as proposer, but `на предварительный срок` describes a preliminary period/term for the review. The source instead provides tentative timing for an unaccepted proposal and an unknown source-relative week. This is the same unsupported scope added by the EN-query/RU-answer draft that the verifier rejected. Here the verifier paraphrased it as `tentatively reviewing` and missed the introduced period. I classify this accepted row as source-entailment and qualification-scope error.

Two rows are null:

- EN query to RU inferred generated `Ada Marlow предложила на предварительный срок провести ...`; the semantic verifier correctly rejected the unsupported preliminary-period qualification.
- RU query to EN inferred generated `According to Ada Marlow, the tentative proposal was to review ...`; the new proposer-agency floor correctly rejected outer attribution that omitted Ada as embedded proposer before semantic verification.

Both are correct draft rejections but unjustified source-level abstentions over adequate writable evidence. V44 blocks the observed reporter-for-proposer form, but this run also shows that semantic handling of `на предварительный срок` is inconsistent across two nearly identical drafts.

## `v18-held-alternatives`, run 1

Retention is complete. The record preserves both competing explanations, their tentative/unproven status and lack of evidence, Ada as the person considering them, and Ada as the personal nonselector of either cause.

All eight answers are non-null and explicitly bind Ada to nonselection, including the passive Russian form `ни одна ... не была ею выбрана`. None broadens the statement into an unassigned group decision. English/Russian `and`/`or` variants list the two competing hypotheses without asserting that both jointly caused the failure. Same-record narrative backshift is acceptable. I found no accepted error.

## Residual classification

V44's selected probe removes the prior accepted outer-attribution/proposer omission and the separate no-booking retention loss on these generations. It leaves:

- two report-answer coverage losses from unsupported `recorded` actions supplied by generation;
- one proposal-answer coverage loss from an unsupported preliminary period;
- one proposal-answer coverage loss correctly caught by the new proposer floor;
- one accepted proposal answer with the same unsupported preliminary-period phrase that semantic verification inconsistently accepted.

These observations do not support weakening attribution, proposer, clock, specificity, or semantic checks, nor adding retries. They show a remaining generation tendency to follow an unsupported recording premise in a question and inconsistent verifier treatment of a concrete Russian temporal-scope phrase. Successful outputs do not isolate causal effect from V44.
