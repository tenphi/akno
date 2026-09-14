# V40 code review, round 1

Reviewed the uncommitted runtime diff from `b39693a` in `write/retain.ts`, `ops/answer.ts`, `models/semantic-verdict.ts`, `timeline/source-clock.ts`, and `ops/remember.ts`, together with the focused regression changes. I did not review or grade the fresh corpus.

## Finding

### Medium: the negative-booking exemption can absorb a following subordinate clause

`write/retain.ts` lets the optional `of|for|with` tail consume up to ten generic word tokens before the booking auxiliary. Its stop words cover coordination and several relative pronouns, but not subordinate boundaries such as `although`, `while`, `whereas`, or `because`. For example, `No appointment with Ada Marlow remains although the handover is booked.` can make the prefix before `is booked` match `negativeSubject`, incorrectly exempting the separately affirmed handover from the required temporal envelope. A similar construction with a lexical predicate in the tail can cross into an embedded clause.

Bound the exemption to the negative noun phrase rather than allowing arbitrary words through a new clause. At minimum, reject subordinate conjunctions in the tail and add a regression pairing a negative appointment with an affirmed handover through `although`/`while`. A safer structural boundary also rejects an intervening finite lexical predicate before the matched booking auxiliary. The semantic verifier remains required, but it should not be the only protection for a schedule that this deterministic invariant mistakenly classifies as negated.

## Other reviewed boundaries

- The contractual-condition guidance addresses the observed condition/state sense change in both generation and the unchanged three-dimension semantic comparison. It does not treat the guidance or submitted metadata as source evidence.
- `semanticRecordScope` correctly defines plan, hypothetical/counterfactual, and active labels as metadata semantics. The verifier still has to establish those labels and all three semantic dimensions from the source. The plan definition permits an offered action without implying intent, acceptance, booking, or performance; the proposed disposition and tentative temporal status remain separate.
- `hasAffirmedBooking` scans every booking predicate, and the existing punctuation/coordination and quantitative/idiomatic regressions protect important boundaries. The subordinate-clause hole above remains actionable.
- The added Russian source-relative syntax requires a time unit plus `after/before` and a source/record/note/conversation head. The device/inspection contrasts prevent a nearby ordinary event from becoming the reference source. Unknown-clock preservation remains a separate required condition in its callers.
- The ownership response is now one constrained selection drawn from `uncertain`, an admitted proposed destination, and tokens for the supplied writable profiles. An unknown token, an unoffered proposal, or the former cross-field shape fails closed. Read-only filtering and temporal-boundary filtering happen before the choices are constructed, and the selected token is mapped back to the same supplied profile rather than accepted as a slug.

The ownership model still makes the semantic choice among supplied options. Its constrained response does not create an acceptance bypass because routing retains its existing read-only and ownership checks.

The root agent reported the full local checks green (2,074 tests plus build, lint, knip, format, documentation, smoke, installed-package smoke, and repository safety). I inspected the changed boundary but did not independently rerun that full matrix.
