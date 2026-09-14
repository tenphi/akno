# V50 built forensic review

## Scope and method

I read only:

- `bench-results/language-built-reliability-v50.json`
- `bench-results/language-built-reliability-v50-trace.jsonl`
- `tmp/language-built-output-packet-v50.json`
- the frozen compiled V50 retention implementation in `tmp/core-v50/write/retain.js` and the unchanged model-client schema serializer

I did not read the independent V50 output-grading receipt, contact a grader, edit code or tracked files, or make a provider call. I used an offline `ModelClient` fetch stub to capture the actual emitted response schema; it contained invented source data only.

## Result

V50's built diagnostic did not obtain a semantic retention verdict in any of the four cases. All four logical verifier calls failed at the transport/schema boundary with `ok:false`, `value:null`, 185–199 ms latency, and null token usage. The retention operation then correctly failed closed, holding all six proposed candidates and reporting `retain_verification_failed`. Nothing reached placement, no managed record existed for retrieval, and all 32 query variants returned `no_eligible_evidence` without calling answer generation or answer verification.

This is one common availability failure, propagated across the pipeline. It is not evidence of four semantic model rejections, four placement failures, a retrieval-ranking failure, or an answer-language failure.

| Case | Proposed candidates after cleaning/repair | Verifier evidence | Persisted | Answer variants |
| --- | ---: | --- | ---: | ---: |
| `v18-held-report` | 2 | `ok:false`, 196 ms, null usage | 0 | 8 null |
| `v18-held-question` | 1 | `ok:false`, 199 ms, null usage | 0 | 8 null |
| `v18-held-rejected` | 2 | `ok:false`, 199 ms, null usage | 0 | 8 null |
| `v18-held-alternatives` | 1 | `ok:false`, 185 ms, null usage | 0 | 8 null |

Coordinates: verifier request/results are trace lines 3, 6, 11 and 14. Case records start at result lines 166, 472, 772 and 1085; their zero retained counts are at lines 216, 516, 829 and 1129. The 32 downstream reasons occupy lines 248–458, 548–758, 861–1071 and 1161–1371. Packet cases start at lines 6, 98, 190 and 282; every answer is null and every `reviewKnowledge` array is empty.

## Common verifier failure mechanism

The frozen V50 code builds each verdict variant with a literal candidate ID and then uses `z.discriminatedUnion` as the array item schema (`tmp/core-v50/write/retain.js:613-624`). Offline serialization through the actual V50 `ModelClient` path produced this structural shape:

```json
{
  "type": "json_object",
  "schema": {
    "properties": {
      "verdicts": {
        "type": "array",
        "items": {
          "oneOf": [
            {
              "properties": {
                "candidate_id": { "type": "string", "const": "cand_..." }
              }
            }
          ]
        }
      }
    }
  }
}
```

For an audited branch the same alternative also requires `span_audit`; for two candidates there are two alternatives. Crucially, `oneOf` is emitted even for a one-candidate, single-span verifier call. The previous verifier used one ordinary verdict object with `candidate_id` as an enum. The new discriminator schema is therefore the only new schema boundary common to all four failures:

- one and two candidates both failed;
- candidates with and without `frame_spans` both failed;
- extraction and repair requests using their established schemas succeeded against the same model immediately beforehand;
- verifier failures returned far faster than successful generation and carried no usage.

The most specific inference supported by the artifacts is that the endpoint rejected the new `oneOf`/literal-discriminator grammar before inference. `oneOf` is the universal new keyword and is the leading incompatibility. The trace omits the raw or typed provider error, so these files alone cannot distinguish rejection of `oneOf` specifically from rejection of its nested `const` or the combination. This uncertainty should be preserved rather than relabeling the failures as model verdicts.

The existing schema-safety helper checks only that object properties are required and `additionalProperties` is false (`packages/core/src/models/client.ts:1087-1117`). It does not validate the provider's supported JSON-Schema keyword subset. The focused V50 transport test checked that `span_audit`, `F1`, `F2`, and the token cap were emitted, but its stub accepted the schema rather than compiling it. Thus local green tests established serialization and caller handling, not endpoint grammar compatibility.

The smallest structural correction is to avoid `oneOf` at this private verifier boundary while retaining runtime candidate-keyed exact validation: use one strict verdict object schema with a candidate-ID enum and a required nullable/generic bounded `span_audit`, then validate each returned audit against the selected candidate's exact local audit schema after ID lookup. An endpoint-supported ordinary union can also preserve literal branches if it is proven in both schema dialects, with the singleton case emitted directly rather than wrapped in a union. Either approach must retain exact candidate membership, exact frame-ID/count/uniqueness checks, strict complete JSON parsing, and one semantic attempt. There is no evidence here for changing semantic thresholds or retrying a rejected verdict.

## Source-span accounting and bilingual report

The source-span bridge reached the request payload correctly for both multi-span cases:

- At trace line 3, report candidate `cand_061b1997e1a18b91ebca5909` carries `F1` bound to `turn-1111` and `F2` bound to `turn-2222`, with exact original quote bytes. The sibling no-instruction candidate has one span and correctly has no `frame_spans` audit requirement.
- At trace line 6, question candidate `cand_81bcc2182507730bd4b146a8` likewise carries exact `F1`/`turn-1111` and `F2`/`turn-2222` bindings.
- The rejected-plan and alternatives verifier calls at lines 11 and 14 contain only single-span candidates, so omission of `frame_spans` is the intended V50 behavior.

No response contains `span_audit`, `comparison`, or semantic booleans because all verifier values are null. The accounting reached the provider request but did not reach a model judgment. Its semantic behavior is therefore untested by this run.

The prior bilingual conflict cannot be said to have recurred. The report source says, in English, that the terms permit sending the device to a technician for **dial calibration**, then explicitly relays in Russian: “разрешена калибровка регулятора, а не замена регулятора,” followed by Ada's lack of seeing the terms or obtaining confirmation. The extracted candidate is source-faithful on that record:

> “Bo Winters says that the Zephyr QX-100 service terms permit sending the device to a technician for regulator calibration, not regulator replacement; Ada Marlow conveys only Bo Winters's words and says she has not seen the terms themselves or received confirmation of this message.”

It preserves the sending action, technician destination/purpose, regulator-calibration clarification, replacement contrast, outer recorder, inner reporter, and lack of inspection/confirmation. Because there is no verifier `source_meaning`, the run neither repeats nor resolves the earlier dial/regulator mismatch. Treating the transport null as a renewed bilingual disagreement would be incorrect narrative framing.

## Case-level retention findings

### `v18-held-report`

Both extracted candidates are supportable proposed memories. Alongside the qualified nested report quoted above, the model separately retained the source statement:

> “Ada Marlow states that she has given no instruction to collect the Zephyr QX-100 device.”

This preserves the personal negative instruction and does not infer a shipment. Both were held only because their shared verifier call returned no value. There is no accepted source or qualification error.

### `v18-held-question`

The single proposed question preserves all material source limits:

> “Ada Marlow's unresolved question is whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter; she still has no answer, and her note establishes neither inclusion nor exclusion of that cleaning.”

It remains an unresolved `question` with commitment `none`, names Ada, and does not promote coverage or exclusion. Its two spans were correctly bound. It was held by transport failure, not by the coverage-role floor or a semantic negative verdict.

### `v18-held-rejected`

This case contains a separate model repair defect before the common verifier failure. Initial extraction proposed:

1. a rejected offer to send the device for thermostat measurement, plus no plan to send it under the offer; and
2. a negated claim that no handover was booked, coupled with the fact that the offered shipment was rejected.

The deterministic cleaner rejected candidate 2 because its asserted/active record combined a no-booking claim with rejection language. The repair request at trace line 10 correctly identified original position 1. The repair model then returned a near-duplicate of candidate 1:

> “Ada Marlow declined the offer to send Zephyr QX-100 to the service centre for a thermostat measurement and has no plan to send it under that offer.”

As a result, the candidate set sent to verification at trace line 11 contains two declined-offer plans and no current no-booked-handover candidate. This is a genuine safe retention omission and a changed repair proposition, not harmless narrative compression.

V50's repaired-position mechanism did preserve the exact original no-handover candidate under `repair_obligations` for `cand_9bc8db5cb5b2310377db9b9a`. Had semantic verification run, that obligation was positioned to reject the substitution. It did not repair the missing proposition itself, and transport failed before its containment could be observed. The batch-wide fail-closed result prevented the duplicate from being persisted, so this is not an accepted source error.

### `v18-held-alternatives`

The single proposed memory faithfully carries both competing possibilities, their tentative status, the common absence of evidence, Ada's role, and the lack of a selected cause:

> “Ada Marlow is considering two competing tentative explanations for Zephyr QX-100 failures—an internal connector that is seated loosely or a faulty temperature probe—but has no evidence for either explanation and has selected neither cause.”

Its source is one item, so the lack of a span audit is by design even though the item contains several clauses. The proposal-agency and nominal-assistant changes are irrelevant to this case. The candidate was held solely by the common verifier transport failure.

## Placement, retrieval and answers

Placement has an empty usage array for every case because no candidate survived retention verification. This rules out placement selection or folder routing as the cause of zero persisted items.

Every query has `recallStatus: "ok"`, no recall degradation, zero retained evidence, `contextStatus: "empty"`, and context activation `selected: 0`. Each benchmark workspace still had one ordinary candidate, and ordinary inspection reports `status: "ok", results: 1`; those ordinary notes concern different facts and do not answer the case query. Retrieval therefore had nothing relevant to select from managed memory. This is downstream evidence starvation, not a ranker miss on a persisted record.

All 32 answer variants—two query languages × two requested answer languages × inferred/explicit view × four cases—end as `not_answered/no_eligible_evidence`. Generation and verification usage are null throughout. The benchmark records zero answer-operation failures because abstaining on empty context is a valid operation result, while separately marking all four cases as availability failures. Both facts are compatible: the operation stayed available, but the intended knowledge was unavailable because retention failed.

No answer draft existed, so none of V50's answer-time coverage-role, attribution, proposal-agency, source-frame-selection, language, or semantic-verifier checks ran. The run provides no evidence for or against those answer behaviors.

No case has a source time claim or reference clock; extracted `time` is null throughout. Source-clock activation is therefore outside this diagnostic rather than a success or failure.

## Accepted errors and evidentiary limits

- **Accepted retained source errors:** 0. No candidate was persisted.
- **Accepted retained qualification errors:** 0. No candidate was persisted.
- **Accepted answer source/qualification/language errors:** 0. No answer was produced.
- **Unsafe proposed content stopped before persistence:** the rejected-plan repair changed the obligated proposition into a duplicate plan; batch failure prevented acceptance.
- **False semantic holds:** not measurable from this run. The public hold stage says `verification`, but the trace proves the verifier never returned a semantic verdict. These are availability holds caused by a failed call.
- **Candidate semantic quality:** three cases have source-faithful proposed content on direct comparison. That observation does not convert unverified proposals into accepted records or establish a benchmark score.

The principal diagnostic gap is the absent sanitized/typed provider error in the trace. Timing, usage, universal failure shape, and offline schema serialization localize the fault to the new schema boundary, but the artifact cannot preserve the endpoint's exact rejected keyword. Future diagnostics should retain a safe typed failure reason or redacted error category so transport incompatibility does not have to be inferred from latency and null usage.
