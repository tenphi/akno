# V71 report false-hold design review

## Scope and conclusion

This assessment uses only the exposed V71 report source/repaired candidate, the frozen cleaner replay, and
the current helper and tests:

- [language-v71-report-cleaning-replay.json](report-cleaning-replay.json);
- [packages/core/src/memory/report-uncertainty.ts](../../../../packages/core/src/memory/report-uncertainty.ts); and
- [packages/core/src/write/retain-report-uncertainty.test.ts](../../../../packages/core/src/write/retain-report-uncertainty.test.ts).

I made no runtime edits or provider calls and did not inspect fresh inputs. The completed probes and
source-only grading still decide whether this belongs in the next revision.

**A small grammar correction is defensible and preferable to further generation structuring:** add one
closed final-predicate form for the literal adverb “personally”, using the same verb and object inventory as
the existing reflexive personal-check form. Do not add “personally” to the broad REPORT_UNCERTAINTY regex, do
not accept arbitrary adverbs, and do not alter clause starts, shared negation, actor binding, quotation
masking, continuation or retraction boundaries.

## Why the exact V71 sentence is safe to recognize

The repaired candidate says:

> Ada Marlow is only passing on this meaning; she has not read the agreement, independently checked Bo
> Winters's account, or personally verified this meaning.

English coordination makes “has not” govern all three participles. The final phrase says the same
grammatical subject did not personally perform verification. It does not introduce another actor, reverse
negation or state that nobody verified the proposition.

The current closed grammar already recognizes the preceding structure:

- an affirmative clause/sentence boundary;
- a known full name, unambiguous source-bound short name, pronoun, or generic assistant as subject;
- has/have/had + not;
- reading/examining/reviewing terms, contract or agreement;
- a comma-bound check of a restricted report/account/claim object; and
- a final verification predicate over “it”, a reported meaning, or a contractual condition/term/requirement.

For subjects with a reflexive mapping, that final slot accepts “herself/himself/myself + personalCheck”.
The exposed sentence differs only by using the gender-neutral adverb “personally” before the same restricted
verb/object pair. Personal agency is still bound to the existing clause subject: “she personally verified”
cannot name a new verifier.

The source independently activates the floor through explicit nonreading, lack of independent account
checking, and Ada's Russian statement that she herself did not verify the relayed meaning. As the frozen
replay records, the repaired prose preserves all three limits. Recognition would send this faithful record
to the existing full-source semantic verifier; it would not establish source truth or accept the candidate
by itself.

## Smallest grammar change

Keep reportCheck, finalPredicate, personalCheck, the actor table, coordination, closedContinuation and end
unchanged. Add a narrowly named branch equivalent to:

    personally[ horizontal-space ]+
    (checked|confirmed|verified)
    [ horizontal-space ]+
    (it | existing bounded reported-meaning/contractual-condition object)

Then include that branch only in finalCheck, beside finalPredicate and the subject-compatible reflexive
personalCheck. It can apply to all existing subjects because “personally” has no gender/number agreement;
the already matched subject and shared negative auxiliary still provide actor and polarity.

This should cover the observed “personally verified this meaning” and parallel “personally checked this
reported meaning” or “personally confirmed it”. It should not introduce new report nouns, devices, actions,
verbs or free-form objects. In particular:

- do not change the optional modifier in reportCheck to an arbitrary adverb;
- do not make “personally” optional before every verb in the helper;
- do not accept “personally reviewed the device” as report uncertainty;
- do not allow another name or pronoun between “or” and “personally”;
- do not allow a newline to act as horizontal coordination; and
- do not move this phrase into the broad fast-path regex, which lacks the closed shared-list boundaries.

The modification is therefore an admission to mandatory semantics, not a semantic exemption. It adds no
schema, pass, model call, repair, retry, dictionary or source-language equivalence rule.

## Boundary preservation

The useful safety properties remain inherited from the complete enclosing pattern:

- **Negation:** the single negative auxiliary precedes the complete list. Positive “has read” and a repeated
  affirmative auxiliary remain rejected.
- **Actor:** the subject is matched before the list; “or Bo Winters personally verified …” does not match.
  Source-provided attribution names retain their existing full/unique-short-name restrictions.
- **Object:** only the current report/meaning/contractual objects are accepted. A device, service action or
  unrelated condition does not become an epistemic object.
- **Quotation:** all existing quote families are replaced by a sentinel before matching, so a quoted example
  cannot supply the list.
- **Clause origin:** conditional, question, denial-of-saying, “Example”, “It is false that”, and arbitrary
  prefix forms remain outside the clause-head grammar.
- **Closure/retraction:** comma continuations and the existing immediate semicolon retraction forms remain
  rejected. Arbitrary trailing material cannot follow the final object.

A later sentence retracting an earlier complete sentence remains a finite-grammar limitation already present
for the reflexive and independently-qualified variants. This change should not claim to solve that broader
case; the mandatory complete-source verifier remains responsible for semantic contradiction outside the
closed local window.

## Meaningful controls

The helper matrix should add small variants around the existing personalList tests rather than create a
separate semantic parser.

Positive cleaning controls:

1. The exact V71 repaired sentence with “or personally verified this meaning”.
2. The same closed list under “She”, “I”, “We” and “They”, demonstrating that no gender inference is needed.
3. “or personally confirmed it” and “or personally checked this reported meaning”, using only current verbs
   and objects.
4. A source-bound full name and unique short-name form, preserving current attribution-name behavior.

Negative boundary controls:

1. Remove “not”, repeat an affirmative auxiliary, or change the first examination into a positive reading.
2. Insert another actor: “or Bo Winters personally verified this meaning”.
3. Use an unrelated object (“the device”) or verb (“personally replaced/described this meaning”).
4. Substitute an arbitrary adverb such as “reportedly”, “allegedly” or “publicly”.
5. Put the sentence under If/Example/asked whether/denied/false prefixes.
6. Wrap it in each supported quote form.
7. Add “, but she later confirmed it”, “; but she later confirmed it”, “; and this is false”, or an
   affirmative same-clause continuation.
8. Split the coordinated predicate with a newline or omit its required object.

One integration test should run the candidate through the normal generated cleaning and existing retention
verifier. A positive semantic verdict may admit it; an invented personal limit, changed reporter, changed
verification object or other semantic-negative verdict must still hold at verification. A repair-path case
should confirm there is still only one structural repair and no retry after a semantic rejection.

Tests should also retain the source/candidate asymmetry control: recognition in candidate prose is not proof
that the original source supplies a personal limit. If a generic unverified report is rewritten as a
specific person's nonverification, local syntax may pass but the existing full-source verifier must reject
the invented experiencer.

## Comparison with further generation structuring

Another prompt could demand “herself verified” or a separate short sentence using the global
“not independently verified” form. That is brittle: the existing repair prompt already asked for an explicit
personal subject and short complete wording, and Luna returned a faithful natural variant outside the finite
grammar. Forcing a reflexive also requires gender selection that the helper deliberately avoids deriving
from names.

A new structured uncertainty field in extraction/repair would cost more schema and output budget, would need
materialization rules, and still could contain an unsupported actor or object. It would not remove the need
for the same semantic verifier. The V71 evidence identifies one closed lexical gap rather than a missing
dataflow boundary, so that structure is not justified.

## Genuine risk and disposition

The added phrase can admit a candidate saying a named person did not personally verify something when the
source establishes only generic report uncertainty. This risk already exists for recognized reflexive and
independently-qualified forms and is why the helper is a rejection floor rather than authority. Keeping the
same-subject syntax and restricted object list limits the expansion; the existing original-source verifier
must remain mandatory and negative verdicts must remain final.

Subject to the completed V71 evidence supporting this scope, the closed “personally + personalCheck” branch
is the smallest coherent correction. It directly resolves the reproduced false hold while preserving every
current structural boundary and downstream semantic gate. Further generation structuring is broader than
the demonstrated failure.
