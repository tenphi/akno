# V46 code review — round 1

Reviewed the working diff against `4b77c57`: answer generation and verification prompts, shared semantic comparison contract, retention prompt, deterministic tentative-language floor, static public missing-detail notes, benchmark version expectations, tests, changeset and V46 trial plan. This was a read-only review; I did not run live calls or modify production code.

## Disposition

No actionable correctness or safety blocker found.

The public-note correction closes the identified boundary cleanly. `missing_concepts` and uncovered recall labels still affect only the `partial`/`not_answered` control decision, while both rendered and empty-answer paths now return fixed, evidence-scoped notes. The answer, citations, related sources, typed outcome and existing precedence for guard/verifier/degradation notes remain unchanged. The operation test checks both paths, public schema parsing, citations/related pages, call count, and absence of fabricated model text from the serialized output. Although it does not separately manufacture a recall-coverage label, both sources are merged into the same `missing` array and neither is interpolated after this change, so that omission does not leave a distinct bypass.

The new Russian floor is bounded to an epistemic head adjacent to the unconfirmed/unproven phrase. The positive forms cover compact and spaced `не доказанные`, post-nominal `пока не доказаны`, and English `unproven`/`not yet proven`; negatives cover confirmed hypotheses, `не только`, and uncertainty attached to another predicate. Passing this lexical floor still always proceeds to the unchanged semantic verifier, and the added false-verdict regression demonstrates that unsupported hypothesis content is withheld rather than accepted. A finite lexical caveat remains: phrases such as “hypotheses are not proven wrong” / `гипотезы не доказаны ложными` can share the accepted prefix while qualifying refutation rather than evidential support. The mandatory semantic verifier remains responsible for that distinction. This is an acceptable limit for a necessary-presence screen, not a reason to broaden the regex into a parser.

The shared comparison text correctly separates two directions that earlier prompts conflated. A generic grammatical complement such as `параметры` is not automatically a selected property, while a concrete property, method or result remains unsupported unless sourced. Conversely, dropping a material degree/manner/mechanism can fail `action_arguments_preserved` even when the broader statement is logically entailed; the contract explicitly says not to misclassify that as unsupported added content. The answer and retention prompts carry the same preservation requirement, and unrelated adjacent details may still be omitted.

Question wording is correctly described as selection intent rather than evidence. The generation instruction directs neutral/source-supported report phrasing instead of personal recording claims; it does not weaken the existing action-agent guards or semantic checks.

Prompt/version changes are internally consistent in the reviewed diff: answer generation `v43`, answer verifier `v27`, retention extraction `v36`, retention verifier `v23`, with the benchmark expectation updated. There is no schema, provider/model, call-count, retry, semantic-verdict dimension or language-gate change.

The V46 plan accurately preserves V45 evidence, the grader/forensic materiality disagreement, unchanged thresholds and fingerprint, and the rule that substantial exposed losses defer the fresh V19 run. Its statement that the prior accepted insertion wording is incomplete rather than necessarily unsupported is consistent with the revised forensic assessment.

## Finite scope

The deterministic uncertainty matcher remains a bounded English/Russian lexical floor and the semantic model remains authoritative for attachment and meaning after that floor. Prompt instructions improve the probability of preserving material modifiers but cannot deterministically prove completeness. The existing zero-error independent source review and usefulness thresholds remain necessary for the exposed probes and any later full trial.
