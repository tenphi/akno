# V75 protocol failure review

## Preserved outcome

I independently reviewed `tmp/v75-protocol-results.json`, its declaration and the two-record answer-verifier fixture. I made no provider/corpus call and did not modify runtime or GitHub state.

The ten controls completed exactly once. Nine passed. `two-record-answer-verifier` completed one endpoint request with `ok:true`, `schemaValid:true`, 929 output tokens under the 2,222 effective cap, but `exact:false`. Its `source_meaning` was altered at the 320-unit boundary and its `candidate_meaning` lost eight repeated filler characters. The remaining fields were exact. This is an exact-copy protocol failure and must remain recorded as such; schema validity and ample observed token headroom do not convert it into a pass.

The three V74 transport failures now passing is direct evidence that V75 removed the incompatible wire regex constructs. This fourth failure is different: transport and strict parsing succeeded, while exact reproduction did not.

## Interpretation

The failed values are artificial stress strings made mostly from uninterrupted repeated `l` characters inside nominally distinct sentences. The response changed one long run and shortened another while preserving the enclosing JSON and all other fields. That pattern is consistent with a synthetic repetition-copy limitation, but one response cannot establish a general provider cause. It is not evidence of a runtime parser defect: the parser correctly accepted a schema-valid value, and the control correctly detected that it differed from the declared expected value.

The result also does not show a token-ceiling failure. The returned response was substantially below the configured cap, although token usage alone never guarantees exact character copying. It does not demonstrate semantic verifier competence because the control asks for an exact supplied object.

## Proposed amendment

A separately declared maximum-field control using distinct, complete natural invented sentences is justified. It would test the same production schema, maximum relevant field lengths, branch states, record count, caller/role caps and exact-copy requirement while removing the repeated-character confound. This is a new differential control, not a retry or replacement of the failed fixture.

The amended declaration should:

- preserve the original receipt and explicitly link its one exactness failure;
- use independently distinguishable natural clauses at the exact field limits, with no repeated-character or repeated-word padding;
- keep the production two-record verifier schema unchanged, including strict branches, anchors, nullable states and required fields;
- keep the same model/API and 2,222 caller/effective cap;
- require byte-for-byte/deep-structural equality, schema validity, one endpoint request and recorded usage/error fields;
- refuse an existing result path, bind the exact frozen SHA and clean tree, and run once;
- treat any nonexact, malformed, unavailable or request-failed result as failure rather than weakening expectations.

Natural text should be constructed and length-checked before declaration, then frozen in the declaration itself. The declaration review should verify every capped value's UTF-16 length, semantic distinctness, sentence completeness and ownership. Avoid mechanically truncating prose after generation; build exact-length clauses deliberately so the terminal punctuation and meaning remain intact.

If this new maximum-field fixture passes, it supports transport viability for natural bounded verifier output while the original repeated-fill failure remains disclosed. If it fails, V75 preflight remains blocked and the exact differing fields should be preserved for a narrower diagnosis. Either outcome is protocol evidence only.

## Disposition

The original ten-control suite is **not fully passing**, so corpus probes should not start. I approve preparing the separately named natural-sentence maximum-field declaration for independent review. I do not approve rerunning the unchanged failed fixture, changing its expected value, relaxing exactness, increasing caps, or treating a new pass as erasing the original failure.
