# V58 personal report-uncertainty continuation design review

## Observed failure and exact reproduction

V57 generated this complete retained report candidate:

> Bo Winters told Ada Marlow that the Zephyr QX-100 terms permit sending the device to a service bench to measure the tension of its return spring, not to replace that spring; Ada Marlow has not read the service terms or independently confirmed this report, and she clarifies that these are Bo Winters's words in her retelling rather than a condition she verified.

The candidate preserves the original source's two personal limits and nested reporting scope. Running the exact candidate and exact structured source items from trace row 1 through `cleanCandidateBatch(..., { generated: true })` produces no candidate and one `discourse_uncertain` hold.

The failure is not caused by `independently`: the existing `confirmation` expression already permits that adverb. The base grammar recognizes `Ada Marlow has not read the service terms or independently confirmed this report`. It then fails because the only allowed suffixes are the closed negative explanation and possible-condition continuation; the actual `, and she clarifies ...` suffix prevents the terminal lookahead from succeeding.

## Recommended bounded grammar

Add one third optional continuation alongside `negativeExplanation` and `possibleContinuation`. It should consume the whole clarification and then demand real sentence/input termination. Its structural components should be closed:

1. literal comma plus `and`;
2. a personal pronoun or generic assistant subject, followed immediately by `clarifies`, `clarified`, `states`, or `notes`;
3. `that this/these/it/they is/are`;
4. a bounded proper-name possessive followed by `words`, `report`, `message`, `claim`, or `account`;
5. optionally `in PRONOUN retelling/account/report`;
6. `rather than a/the condition/term/requirement PRONOUN [has/had] verified/confirmed`;
7. lookahead for end, period, question mark, exclamation mark, semicolon, or newline.

The implementation should not try to prove pronoun coreference locally. This helper only permits a candidate to reach the mandatory semantic verifier; it does not accept it. Keeping the suffix closed prevents a generic `, and ...` exception from swallowing a positive confirmation or unrelated clause.

An even narrower first version can support only the observed `clarifies that these are NAME's words in her/his/their retelling rather than a condition PRONOUN verified` family. There is no evidence here for a broad reporting-synonym expansion.

## Required contrasts

Positive/admitted to semantic verification:

- the exact V57 candidate;
- `Ada Marlow has not read the terms or confirmed the report, and she clarifies that these are Bo Winters's words rather than a condition she verified.`;
- the same shape with `he` or generic `the assistant` where the preceding actor uses that form.

Must remain structurally held:

- `..., and she later confirmed the report.`;
- `..., and Bo Winters confirms that it is verified.`;
- `..., and she clarifies that these are Bo Winters's verified terms.`;
- `..., and she clarifies that these are Bo Winters's words rather than a condition she verified, but she later confirmed it.`;
- `..., and she clarifies the report.` without the closed words/report-versus-verified-condition scope;
- a quoted grammatical example containing the continuation but no live qualification;
- a clause with positive `has read ... or confirmed ...`;
- a new sentence whose subject supplies an unrelated clarification.

At least one operation-level test should return an all-true semantic verdict and admit the exact V57 shape, while a paired semantic-negative verdict still holds it. That proves the change only opens the path to verification.

## Limits and safety

The source continues to activate the requirement through exact validated support/frame spans. The new branch changes only whether generated readable prose visibly preserves that uncertainty. Original source authority, nested speaker pairing, proposition support, action arguments, qualification scope, frame selection, and placement remain unchanged.

Do not remove the suffix boundary, allow arbitrary text between the negative auxiliary and confirmation verb, or treat the generated clarification as source evidence. No extra model call or retry is needed. The V57 repair's proposition substitution is a separate repair-quality issue and should not be addressed by broadening this uncertainty grammar.
