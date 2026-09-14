# V77 independent Sol code review — round 2 final

Read-only review of the current working diff against `1d63519`. The original findings and the
insufficient first correction are preserved in `tmp/language-v77-round2-review-initial.md`. I
inspected the final shared actor bound, both call sites, retention integration, schema changes and
tests. I ran deterministic helper reproductions and `git diff --check`; I made no runtime edit,
provider call, or held-out-data access.

## Resolution of round-2 findings

### Resolved — counterfactual actor-prefix capture

The new `AFFIRMATIVE_NAMED_ACTOR` now permits exactly two proper-name parts. A leading capitalized
uncertainty/report/condition word can no longer be absorbed before the two-part actor in the V76
purchase-relative form. The finite scope-word exclusions apply at both name positions as an
additional boundary.

I reran the exact faithful unit with all originally reproduced prefixes and the later
`Probably/Presumably/Likely/Conceivably/Purportedly/Supposedly` set. All now return false, while the
direct Ada Marlow and Bo Winters forms remain true. The existing affirmative unit still requires:

- literal unrealized `при котором при покупке` scope;
- bounded acquisition and repair wording ending `покрывался бы`;
- an adjacent gender-agreeing actor pronoun and explicit nonpurchase;
- the bounded no-current-coverage closure; and
- an unretracted clause end outside quotations.

This intentionally defers three-part names for this new arm. That is a conservative false-hold limit,
not a false admission. Existing explicit `если бы`, counterfactual labels and older verified nominal
forms remain available.

### Resolved — fictional-introduction actor-prefix capture

The identity helper uses the same two-part actor grammar. For structured sources it now also extracts
the apparent introduction actor and requires exact normalized equality with that source item's
supplied `speaker`. A third-party actor, a three-part apparent actor, or a discourse prefix plus the
real speaker therefore yields no deterministic attachment witness.

Direct tests cover the original and extended uncertainty/subordination/report prefixes, a different
structured actor and a three-part actor. My exact reproductions now return no identifier, while the
English, Russian and first-person Ada Marlow introductions still yield the unique `qx-100` witness.
The fix does not change candidate bytes, metadata or destination selection.

For unstructured source text there is no speaker coordinate. A capitalized discourse token plus a
single-name actor can remain syntactically indistinguishable from the deliberately supported two-part
name. Likewise, genuine three-part actors defer. This is an explicit finite-grammar limitation; the
witness only requests the existing repair and never authorizes retention or placement. Full-source
semantic verification remains mandatory.

## Final scope assessment

### Private answer-audit length

Actor and qualification `detail` use local `trim().min(1).max(160)` with provider metadata
`maxLength:80`. Eighty Unicode code points always fit the local 160 UTF-16-unit bound, including an
all-astral value. Tests cover 80/81/160/161 local boundaries, blank values, negative relations, and
every provider-visible strict branch. Source context, operation/property specifics, comparisons and
public prose retain their previous independent limits. No semantic boolean, relation, null shape or
anchor-ownership check is relaxed.

### Fictional-case identity attachment

The generated-only helper requires one exact affirmative case introduction, one later same-case
anaphor in this candidate's own support, both sentences in this candidate's validated frame, source
order, and one alphanumeric identifier. Quotations are masked without changing source coordinates;
duplicate source item IDs, competing case mentions, nonunique exact spans, reversed order, questions,
different-case anaphors and bounded retractions defer.

When the witnessed identifier is absent from candidate prose or subject, it is merged into the
existing original-index `missingIdentifiers` obligation. The existing one full repair receives only
bounded exact source occurrences as advisory context. It cannot synthesize a page, bypass the
400-UTF-16-unit record cap, mutate admitted siblings, change relation indices, or avoid recleaning and
the mandatory original-source verifier. Provided candidates remain outside this generated-only path.

The tests exercise null subjects, prose-only/subject-only/both presence, structured and unstructured
source ordering, ambiguous and quoted cases, source-speaker mismatch, one successful repair, and a
semantic-negative repair. Broader transaction tests continue to cover malformed/duplicate indices,
mixed repair shapes, immutable siblings and postrepair caps. I found no bypass of those inherited
guards.

### Counterfactual answer integration

The exact V76 purchase-relative draft now passes the local discourse floor. A changed-year variant
also passes that presence floor but remains held when the unchanged full-source verifier returns a
negative verdict, demonstrating the intended separation between grammatical admission and semantic
authority. No extra semantic attempt or repair is introduced.

### Versions and runtime invariants

The answer versions move to generation 68 / verifier 48 and retention to extraction 56 / verifier 40;
benchmark expectations are updated. Models, public schemas, output ceilings, model-call count, retry
behavior, source selection, language checks and ownership routing remain unchanged. `git diff --check`
is clean.

Validation observed:

- parent-reported initial focused suite: 1,000/1,000 passing across five files;
- final actor-bound focused run: 400/400 passing across two files;
- parent-reported typecheck and lint: passing before the final bounded actor fix; the final focused run
  compiles both changed helpers. A final whole-tree gate remains the release workflow's responsibility.

## Disposition

**Round 2 clean after fixes.** The two introduced actor-prefix defects are resolved by a structural
two-part bound plus structured speaker equality, rather than an ever-growing token blacklist. I found
no remaining concrete blocker in the V77 runtime diff. Provider transport behavior and model
competence remain subject to the separately declared frozen controls.
