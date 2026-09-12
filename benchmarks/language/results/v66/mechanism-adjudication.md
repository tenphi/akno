# V66 connector-continuity mechanism adjudication

## Conclusion

The initial grade was too permissive for selected `v20-held-assistant` coordinates q1 (`en` query, Russian answer, inferred view) and q5 (`ru` query, Russian answer, inferred view). Their phrase `проверка целостности разъёма` is a general connector-integrity check. It does not identify the source's electrical continuity test, which in Russian requires a continuity/circuit sense such as `проверка непрерывности ...` or the q7 wording `проверка целостности цепи разъёма`.

I therefore mark q1 and q5 not usefully responsive. I retain `sourceEntailed: true`: a connector continuity test is within the broader category of checking connector integrity, so the answers generalize rather than assert a contradictory or unsupported specific test. I also retain `qualificationPreserved: true`, because tentative modality, assistant attribution, personal non-reading/nonverification, and possible-contractual-term scope all remain intact. The failure is loss of the material requested mechanism, not factual promotion or discourse-qualification loss.

Q7 is materially different. `целостность цепи разъёма` explicitly names the connector circuit; in this technical frame, checking circuit integrity naturally conveys electrical continuity. It remains useful and source-faithful. The English rows are exact, and q3 is null, so no other coordinates change.

The preserved initial receipt remains at `tmp/language-selected-output-review-v66-initial.json`. The corrected final total is 36/64 useful answers; retention remains 6/8 and retrieval remains 48/64.
