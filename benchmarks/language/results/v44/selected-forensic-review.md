# V44 selected-probe forensic review

Scope: original-source audit of `language-selected-v44`, its trace, and `language-selected-output-packet-v44`. Runtime checks were treated as stage evidence, not semantic ground truth. This is not the independent grading receipt.

## Overview

- All four retained sets are materially complete. The rejected case now preserves the independent no-handover-booking denial as a separate record with no invented booking actor.
- Twenty-eight of 32 answer combinations are non-null. All four nulls follow rejection of genuinely defective drafts, but remain answer-coverage losses because adequate writable evidence was available.
- One accepted report answer changes the source's dial/regulator component into a scale. I found no other material accepted source-meaning, action-role, qualification, language, or promotion error. The disputed `на предварительный срок` wording is awkward but can express the source-supported provisional timing without specifying a duration.
- The earlier specific `thermostat temperature` error does not recur. Generic `thermostat parameters` occurs without selecting a particular measured property.

## `v18-held-report`, run 1

Retention is complete. The main record preserves Bo Winters as the inner source of the service-term permission, Ada Marlow as the outer relay, sending Zephyr QX-100 to a technician for dial/regulator calibration, calibration rather than regulator replacement, and Ada's lack of access to the terms and confirmation. A separate record preserves Ada's no-collection-instruction statement.

Six answers are non-null and preserve the nested reporting roles, permission, calibration-versus-replacement contrast, and verification limits. The focused report answers need not repeat the separate collection statement. `Якобы` is somewhat skeptical in tone but, in these sentences, continues to mark Bo's statement as reported/unverified rather than asserting falsity.

The EN-query/RU-answer inferred row says the device may be sent for `калибровка шкалы`, then separately repeats the regulator-calibration clarification. Although English `dial` can be translated in several ways in isolation, this bilingual source expressly clarifies its intended component as `регулятор`. `Шкала` names a scale, a distinct component not supported by that clarification. The later regulator sentence does not erase the added scale-calibration claim. I therefore classify this accepted answer as a source-entailment/action-object error while its attribution, uncertainty, permission, and calibration-versus-replacement polarity remain intact.

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

The pronoun correctly keeps Ada as proposer. `На предварительный срок` is awkward and can be read as “for a preliminary term/period,” but in the complete sentence it can also denote provisional timing: it is immediately tied to `на следующей неделе`, an undated source-relative week, and no duration or length is supplied. The source explicitly supports tentative timing. Because the wording does not unambiguously select a new duration, I do not classify this accepted row as a source error. Its grammatical awkwardness is not a language-identity failure.

Two rows are null:

- EN query to RU inferred generated `Ada Marlow предложила на предварительный срок провести ...`; the semantic verifier rejected it as an unsupported preliminary period. On source-only reassessment, the phrase is ambiguous but can express the supported provisional timing in its next-week context, without specifying duration. I therefore classify this as a semantic false hold rather than a clearly justified rejection.
- RU query to EN inferred generated `According to Ada Marlow, the tentative proposal was to review ...`; the new proposer-agency floor correctly rejected outer attribution that omitted Ada as embedded proposer before semantic verification.

The outer-attribution draft is correctly rejected; the preliminary-timing draft is a false semantic hold. Both resulting abstentions remain source-level coverage losses over adequate writable evidence. V44 blocks the observed reporter-for-proposer form, while semantic handling of `на предварительный срок` is inconsistent across two nearly identical drafts.

## `v18-held-alternatives`, run 1

Retention is complete. The record preserves both competing explanations, their tentative/unproven status and lack of evidence, Ada as the person considering them, and Ada as the personal nonselector of either cause.

All eight answers are non-null and explicitly bind Ada to nonselection, including the passive Russian form `ни одна ... не была ею выбрана`. None broadens the statement into an unassigned group decision. English/Russian `and`/`or` variants list the two competing hypotheses without asserting that both jointly caused the failure. Same-record narrative backshift is acceptable. I found no accepted error.

## Residual classification

V44's selected probe removes the prior accepted outer-attribution/proposer omission and the separate no-booking retention loss on these generations. It leaves:

- two report-answer coverage losses from unsupported `recorded` actions supplied by generation;
- one proposal-answer coverage loss from a false semantic rejection of ambiguous but defensibly source-supported provisional-timing wording;
- one proposal-answer coverage loss correctly caught by the new proposer floor;
- one accepted report answer that changes the clarified dial/regulator component into an unsupported scale.

These observations do not support weakening attribution, proposer, clock, specificity, or semantic checks, nor adding retries. They show a remaining generation tendency to follow an unsupported recording premise in a question, an accepted component specialization despite bilingual clarification, and inconsistent verifier treatment of an ambiguous Russian temporal phrase. Successful outputs do not isolate causal effect from V44.
