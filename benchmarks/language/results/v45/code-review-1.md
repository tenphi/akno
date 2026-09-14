# V45 code review — round 1

Reviewed the bounded working diff against `6c78a3b`: retention generation/shared qualification contract, answer generation, shared semantic comparison, prompt-version assertions, changeset, and V45 trial plan. I did not edit runtime, make live calls, or inspect fresh outputs.

## Disposition

No actionable finding.

The new contract keeps authority with explicit clarification in the complete supplied source or cited evidence. It does not authorize a dictionary, similarity, or domain-knowledge alias. When no supplied clarification resolves an ambiguous term, generation is told to preserve the ambiguity rather than select a convenient sense. This avoids turning the V44 dial/regulator finding into a fixed vocabulary mapping.

The verifier instruction is clause-sensitive: `candidate_meaning` must retain each added specification, each generated clause is compared with the clarified referent, and a later correct clause cannot retract an earlier incompatible component. Concrete conflicts continue through the existing `proposition_supported` and `action_arguments_preserved` dimensions. The surrounding qualification contract remains authoritative for speaker, uncertainty, fiction, polarity, and time, so a qualified or hypothetical source clause does not become unqualified evidence merely because it contains a lexical clarification.

The instructions do not require word-for-word translation. They constrain referent identity only when the supplied source explicitly resolves it, and otherwise allow ordinary grammatical expression without outside semantic additions. Exact original-language support/frame spans remain byte-preserved evidence; generated prose alone cannot establish equivalence.

All four version increments match changed prompt surfaces:

- answer generation `v41` to `v42`
- answer verifier `v25` to `v26`
- retention extraction `v34` to `v35`
- retention verifier `v21` to `v22`

The benchmark expectation is updated consistently. No schema, output/audit bound, model, call count, verdict dimension, retry path, or gate changed. The changeset and V45 plan accurately record the reassessed V44 result (4/4 retention, 32/32 retrieval, 27/32 useful answers; four nulls plus one accepted error), preserve the unexecuted v19 fingerprint and unchanged gates, and distinguish the earlier CI-only helper preparation from runtime semantics.

## Finite limit

This is model-enforced cross-clause and cross-language coreference, not a deterministic alias resolver. Whether source language truly clarifies an earlier term, rather than merely mentioning a related component under different speaker or modality scope, remains a semantic-verifier judgment over the complete context. Exposed original-source probes are still needed, and their success cannot prove general terminology coverage. This stated limit is not a blocker to the bounded revision.
