# V58 code review, round 1

## Scope

I reviewed the current worktree against `b55a5bb`, including the closed report-uncertainty clarification, quoted booking-alias handling, generated subject/frame identifier floor, answer selection guidance, prompt versions, focused operation tests, changeset, and `benchmarks/language/v58-trial-plan.md`. I did not edit runtime code, call a provider, or claim the root's in-progress full-suite run as my own.

## Disposition

I found no actionable correctness defect in the reviewed diff. The new rules are bounded screening or prompt constraints and do not approve a retained candidate or answer. Generated candidates still undergo the existing one repair limit and mandatory full-source semantic verification; answers still undergo language review, deterministic guards, source-frame selection, and semantic verification. Caller-provided candidate cleaning remains outside the generated-only subject/frame rule.

## Boundary findings

### Closed personal-uncertainty clarification

The implementation matches the source-backed V57 failure rather than opening arbitrary comma-and prose. It first preserves the old closed negative-list branches. Its added branch requires the complete sequence:

- a recognized personal actor and negative read/examine plus confirm/verify list;
- comma plus `and`;
- a pronoun or generic assistant immediately performing `clarify`;
- `these are NAME's words`;
- optional bounded retelling phrase;
- `rather than a condition/term/requirement ... verified/confirmed`;
- actual sentence/input termination.

The exact V57 text is covered. Positive confirmation, a new named clarifier, arbitrary discussion, verified-terms substitution, trailing retraction, and quoted examples remain negative. The straight-single-quote masker now distinguishes an enclosing quotation from the internal possessive in `Bo Winters's`; the tests cover all supported quote forms.

The helper deliberately does not prove pronoun or inner-name identity. That is acceptable here because admission only reaches the unchanged verifier, which receives the complete original structured source. This finite grammar may miss other faithful paraphrases, but it does not create an acceptance bypass.

### Immediate quoted booking alias

The booking exception strips only a closed comma-delimited appositive immediately before the matched booking auxiliary, with an exact generic alias (`the device/item/unit/product`) and balanced supported quote delimiters. It then runs the existing negative-subject grammar on the remaining prefix. It therefore admits `No handover of Zephyr QX-100, referred to as “the device,” has been booked` while retaining the product identity for downstream semantics.

The paired tests keep an affirmative handover, a predicate inside the quote, an unclosed quote, and a separately scheduled inspection negative. The operation test confirms the original source and unchanged candidate reach mandatory semantic verification and that a negative verifier verdict still holds. I found no route by which the alias replacement itself can excuse a separate affirmative booking clause.

### Source identifier in readable prose and deciding frame

For generated candidates only, the new rule activates when an identifier claimed by structured `subject` occurs in the complete supplied source. It then requires that exact identifier in both readable candidate text and the admitted discourse frame. This closes the prior case where a generated fictional record borrowed `Zephyr QX-100` into metadata/page routing while omitting the antecedent span from its deciding frame.

The rule is rejection-only. A source-wide occurrence does not insert an identifier, select a page, or prove that the identifier belongs to the proposition. An unrelated occurrence can at most make the screen stricter; the candidate still needs the exact identifier in its frame and full semantic verification. A subject identifier absent from the complete source does not activate this floor, leaving unsupported subjects to the existing semantic verifier. The tests correctly cover readable/frame combinations, prefix-distinct identifiers, caller-provided behavior, repaired positions, exact full-source verifier payload, and positive/negative semantic outcomes.

This remains a finite identifier policy rather than general antecedent resolution. That limitation is accurately stated in the plan.

### Collective selection and complete-record scope

The answer prompt correctly separates collective support from indiscriminate selection: visible cited excerpts may jointly provide an offer and rejection, every citation must contribute, and private frame-only content cannot fill a missing selected detail. Focused answers may omit an independent no-plan neighbor, while `complete_retained_record` explicitly continues to select every retained clause. Coupled personal limits, conditional consequences, and qualifications remain mandatory.

The new fiction guidance addresses the V57 accepted selection error by requiring no block when a retained discussion proposal does not contain the requested fictional promise. It does not require disclosure of unrelated private-frame content or broaden renderer eligibility.

### Versions and validation plan

The answer generation/verifier version bumps and benchmark expectations align. Retention extraction changes while the verifier contract remains unchanged, reflected by the extraction-only version bump. The plan accurately states unchanged schemas, models, call count, retry policy, renderer cap, ownership policy, source-byte behavior, and quality gates. Its exposed-probe and fresh-held-out separation remains explicit.

## Finite limits

- The uncertainty and booking helpers recognize narrow EN surface forms, not general syntax. Unrecognized faithful wording can still be conservatively held.
- Pronoun coreference, identifier ownership, proposition pairing, and multi-record selection remain fallible model judgments in mandatory verification/placement.
- The subject/frame rule can reject a generated candidate that claims a source-wide identifier but selects an incomplete frame; that conservative result is its stated purpose and can invoke only the existing bounded repair.

Within those stated limits, the diff preserves source authority and fail-closed behavior. I found no reason to weaken the guards, add a semantic retry, or alter models, budgets, or gates.

## Post-review booking-alias boundary recheck

The frozen implementation now uses horizontal whitespace and an exact end assertion inside the alias suffix matcher. Missing-comma, unquoted-alias, predicate-bearing alias, unclosed quote, and prior/separate affirmative-booking controls remain negative. This resolves the raw matcher concern that a suffix could extend beyond the immediate appositive.

Candidate cleaning normalizes whitespace before `hasAffirmedBooking`, so a newline originally present inside the alias or immediately before the auxiliary becomes ordinary spacing and is intentionally admitted as the same normalized statement. This is a finite consequence of the existing cleaner, not evidence that the raw regular expression crosses lines or changes source bytes. The source spans and bytes remain exact for support and verification. The updated tests and comment state this accurately. I found no new blocker in the final alias delta.

## Frozen execution checkpoint

Root reports runtime dae04e21bfe8b5b3f394b634bd8a8efa4f43ddee frozen and pushed, 2,615 tests across 143 files, complete local gates, build/restart/socket deployment, compiled source/answer controls and actual-provider schema controls passed. CI 34313694237 and documentation CI 34313694236 passed. Both declared exposed probes are in progress; no live quality outcome is claimed by this code review.
