# V38 code review

Reviewer: GPT-5.6 Sol, read-only code-review role. Compared the uncommitted V38 diff with `5701560`. No fresh v18 output was inspected.

## Finding

### Medium — the agency floor treats explicit plural pronouns as preserving a singular source agent

In `packages/core/src/ops/answer.ts`, `causeNonselectionAgencySupported` activates only from readable singular nonselection such as Ada Marlow's `has not chosen a cause` / `причину я не выбрала`. Its passive-agent exemption then accepts `us`, `them`, `нами`, and `ими` alongside singular personal pronouns:

```ts
/^(?:her|him|me|us|them|ею|им|мной|нами|ими).../
```

Consequently, `No cause has been chosen by them` and `Причина не выбрана ими` pass this deterministic floor for a source that names only Ada. Those forms reproduce the material broadening the change is intended to stop: they assign the nonselection to a plural group rather than the singular source agent. Full semantic verification is still required and should reject the mismatch, so this is not an acceptance bypass, but it leaves an obvious same-class hole in the new deterministic check and conflicts with the prompt's requirement for an unambiguous personal subject.

Remove the unambiguously plural pronouns (`us`, `them`, `нами`, `ими`) from this exemption and add paired negatives. Singular `her`, `him`, `me`, `ею`, `им`, and `мной` can continue to reach semantic verification, which remains responsible for resolving the actual identity. Singular use of English `them` is too ambiguous for this bounded lexical floor and can be handled by the verifier rather than accepted deterministically.

## Other reviewed boundaries

The direct and passive cause-choice patterns are clause-local enough for their stated narrow purpose. A second personal clause does not license a separate agentless clause, named passive agents must occur in readable support, and all accepted forms still pass the unchanged semantic verifier. Using the existing `attribution` rejection bucket is somewhat coarse but does not change acceptance semantics.

The two source-clock additions are bounded to `считая от` / `отсчитывая его от` followed by a source/record/note/conversation noun. The negative device/inspection anchors correctly remain outside the source-relative floor. The verifier guidance distinguishes grammatical narrative backshift from an actual changed temporal boundary without directing automatic acceptance.

Prompt versions and the V38 documentation describe the implemented scope accurately. I ran only the changed boundary suites: `source-clock.test.ts` and `answer.test.ts` passed 305 tests.

## Round 2 disposition

The reported finding is fixed. The passive exemption now permits only singular personal pronouns (`her`, `him`, `me`, `ею`, `им`, `мной`) or an exact source-backed proper name to proceed to semantic verification. Explicit plural agents are rejected, and the added suffix check prevents a permitted singular agent from hiding an additive `and`/`with`/`и`/`с` or comma-plus-name continuation. The English and Russian regressions cover direct plural pronouns, named coordination, pronoun-plus-name coordination, and comma-separated names.

I found no remaining actionable issue in the revised boundary. The suffix logic is intentionally a necessary-presence floor rather than a complete parser; uncommon coordination wording can still reach the full semantic verifier, which remains responsible for exact identity and action roles. The source-clock changes and trial plan are unchanged and remain consistent with the implementation.
