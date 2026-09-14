# Clock-contract correction code review

**Scope:** read-only review of the uncommitted change in `source-clock.ts`, `source-clock.test.ts`, and `answer.test.ts`; frozen integration runtime `963bf68` and its scores remain unchanged.

**Disposition:** **clean**. The implementation is the bounded deterministic correction recommended in `clock-contract-correction-review.md`. I found no correctness blocker or adverse-scope admission introduced by this branch.

## Runtime review

The new branch is confined to `hasSourceRelativeAnchor()`. It reuses the existing supported Russian `clockLabel`, the existing quotation normalization that exposes only a bare quoted clock label, an affirmative clause-start boundary, horizontal whitespace, the literal predicate and attachment `отсчитывается от времени первоначальной записи без даты`, and `hasUnretractedClauseEnd()`. It does not broaden the generic modifier/source-noun alternatives or change `hasUnknownReferenceClock()`.

This closes the actual contract mismatch for `завтра` and the other supported day/week/month/year labels while retaining the existing three-part answer guard: deictic time, source-relative anchor, and unknown reference clock must all pass. The final answer still passes language checking and the mandatory source verifier. The lexical match therefore cannot establish the selected period, direction, actor, proposal status, or other source semantics by itself.

The branch does not accept a clock attached to processing, a meeting, an inspection, or a device recording. Text after `записи` cannot be spliced through the exact phrase, and questions, conditions, prefix negation, quotation of the whole assertion, immediate adversative/retraction, and line-broken phrase variants remain outside the match. A later independent unsupported assertion remains the semantic verifier's responsibility, consistent with the helper's existing existential scope.

## Test review

The helper positives cover 15 supported label/morphology forms with unquoted text and six quote styles. Each asserts all three clock predicates, so the test does not mistake source anchoring for complete clock validity.

The 26 helper negatives cover the material boundaries: denied/alleged/example/conditional/question scope; negated predicate; quoted negation and whole quoted assertion; processing/event/device-recording substitutions; malformed source attachment; missing date qualification; conditional, interrogative, adversative and retracted endings; and forbidden internal newline joining.

The three added public modes exercise the production joined structured record:

- a faithful `tomorrow` rendering passes local guards and reaches the existing semantic verifier;
- an independently source-inconsistent object reaches the verifier and is rejected there;
- a processing-clock substitution is rejected locally before semantic verification.

The public test also preserves exact source-name handling, language checking, complete-record scope, source bytes, and absence of the private `translated_record` shape from the result.

The preserved pre-fix log shows eight meaningful failures caused by the missing branch. The corrected focused run passes **967/967** across source-clock, rendering, and answer tests, and the reviewed diff passes `git diff --check`.

## Evidence boundary

This deterministic result establishes that the prescribed output is now accepted by its matching local contract while negative and semantic gates remain active. It does not alter or retroactively improve the frozen live evaluation, and it is not evidence of live-model behavior.
