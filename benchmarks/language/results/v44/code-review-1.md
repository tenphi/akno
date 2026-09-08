# V44 code review — round 1

Reviewed the working diff against `6668675`, limited to proposer-agency detection, generated retention and answer integration, regression tests, prompt versions, changeset, and V44 trial plan. I did not edit runtime code, inspect fresh outputs, or treat the helper as a complete parser.

## Disposition

No actionable correctness finding in the bounded implementation.

`proposalAgencySupported` activates only from readable support text containing a recognized proposer construction. It does not inspect `source_speaker` or other provenance metadata, so a reporting source alone cannot create the action-agent obligation. Once activated, it targets a narrow set of agentless proposal descriptions and admits explicit active, passive-by-agent, and possessive proposer forms to the still-mandatory semantic verifier. It does not certify actor identity or source entailment.

The independently anonymous-source exemption is bounded to a source clause that itself has the recognized unassigned proposal form and lacks a recognized proposer in that clause. This can defer ambiguous multi-proposal pairing to semantic verification, but it does not make the candidate pass verification. Conversely, a source passive such as `The review was proposed by Ada Marlow` activates the floor, and removing `by Ada Marlow` from the candidate is held; preserving an explicit passive agent is admitted. The supplied tests exercise those principal distinctions in English and Russian.

Integration is correctly generated-only for retention: exact provided candidates retain their model-free contract. Answers apply the floor before semantic verification and retain a semantic-negative regression showing that passing this lexical presence check does not bypass the verifier. Both paths derive activation from readable source/frame evidence rather than typed attribution metadata.

Prompt versions consistently advance all changed surfaces: answer generation/verifier to `v41`/`v25` and retention extraction/verifier to `v34`/`v21`. The benchmark version expectation, changeset, and V44 plan match those versions and accurately preserve V43's corrected 29/32 selected-answer result, two writable nulls, and separate repair loss. No model, schema, call, retry, verdict, or gate change is claimed or present in this scope.

## Finite limits

The recognized grammar is intentionally incomplete. Unrecognized proposer verbs, pronouns, inflection, organizations, and multi-proposal coreference defer to the full verifier. The anonymous-clause exemption can also leave cross-clause pairing to that verifier. Russian `предложение NAME` can be morphologically ambiguous for indeclinable names, so its presence is not identity proof; the semantic verifier remains responsible for resolving proposer versus recipient. These are documented limits rather than unsafe acceptance paths because the helper is a necessary presence floor, never sufficient authorization.
