# V41 code review, round 1

Reviewed the uncommitted runtime diff from `a7e8074` in the shared action-agency helper, retention, answer generation/verification, semantic comparison contract, and meaningful focused regressions. I did not inspect or grade fresh corpus inputs and did not authorize execution.

## Finding

### Medium: the shared agency floor can borrow activation across distinct choice predicates

`packages/core/src/memory/action-agency.ts` activates when *any* supported text contains its personal-choice pattern, then rejects *every* unassigned nonselection pattern anywhere in the candidate. It does not bind the source actor and selected object/predicate to the candidate clause being screened.

For example, a source/frame can truthfully say: `Ada Marlow has not chosen a cause. Neither proposal has been selected for publication.` A candidate that faithfully retains only `Neither proposal has been selected for publication` is rejected because the unrelated first sentence activates the floor and the second sentence is passive. The same issue applies when one generated candidate has a complete deciding frame that contains two independently supported choice statements. This becomes more consequential in V41 because the helper now runs before retention; the downstream semantic verifier never gets to distinguish the propositions.

The English activation also does not constrain the source subject despite its “singular nonselector” comment: `The committee has not chosen a cause` activates, while the faithful `No cause has been chosen by the committee` cannot pass the helper's singular-pronoun/proper-name passive-agent allowance. That is another instance of source/candidate actor scope not being paired.

Bind the floor to the same choice object/predicate and its deciding clause, or narrow activation to the personal singular grammar the helper can faithfully validate. Add contrastive tests with (1) Ada's personal cause nonselection beside a separately supported passive proposal/publication state, and (2) an explicitly named collective nonselector. Full semantic verification should decide those faithful cases; the deterministic floor should continue rejecting the observed collapse from `Ada ... selected neither explanation` to an unassigned passive about those same explanations.

## Other reviewed boundaries

- Moving the existing floor into a shared module and invoking it only for generated retention preserves caller-provided/model-free candidates. Generated candidates that pass still require the unchanged three semantic dimensions; the helper supplies no source authority and creates no acceptance bypass.
- The new generation and verifier wording correctly separates the consideration actor from the nonselection actor. Attribution metadata or a person's name in another clause cannot satisfy the material action role.
- The no-booking extraction/repair guidance asks for an independent proposition with its own deciding frame while explicitly preserving enclosing hypothesis, quotation, speaker, and other qualifying context. Repair remains one structural transaction, uses the complete original source in semantic verification, and receives no semantic retry or override.
- The focused repair regression verifies full-original-source delivery and a negative semantic verdict holding the candidate. Its mocked positive verdict cannot prove model behavior, but it correctly exercises the authority and fail-closed wiring.

The root reported 459 focused tests passing. I inspected the changed boundary and did not independently rerun that suite.
