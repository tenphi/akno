# V43 code review — round 1

Reviewed the working diff against `6e3ec83`, limited to the shared semantic comparison contract, answer generation, retention generation, changeset, and V43 trial plan.

## Disposition

No actionable correctness finding in this bounded diff.

The generation instructions ask the model to omit properties, methods, results, causes, attributes, and means that the supplied evidence does not establish. The shared verifier contract independently requires the audit to preserve an added specification in `candidate_meaning`, compare the component separately from property/method/result, and reject a concrete unsupported restriction through the existing `proposition_supported` and `action_arguments_preserved` dimensions. Both paths keep the original source or cited evidence as authority. The text explicitly exempts grammatical expansion that adds no semantic restriction, so the contract does not require literal translation or reject every natural elaboration.

The change does not alter schemas, verdict booleans, mismatch limits, comparison-field limits, batching, model calls, retry behavior, or gate policy. The prompt version increments consistently cover every changed prompt surface:

- answer generation `v39` to `v40`
- answer verifier `v23` to `v24`
- retention extraction `v32` to `v33`
- retention verifier `v19` to `v20`

The changeset and trial plan describe the implemented scope accurately. The plan preserves the corrected V42 evidence, identifies the accepted measured-property specialization, explicitly carries the ownership and verifier coverage losses, pins the unchanged v19 fingerprint/models/gates, and requires freezing before exposed probes or a full trial.

## Finite limits

This remains a model-enforced semantic distinction rather than a deterministic lexical guard. “Parameters” is intentionally treated as generic only when it selects no particular property; the full comparison still has to judge whether a concrete use adds meaning in context. The prompt additions do not prove arbitrary technical-domain or cross-language reliability. Those limits are consistent with the staged exposed-probe plan and are not blockers to freezing this revision after the repository's own checks pass.
