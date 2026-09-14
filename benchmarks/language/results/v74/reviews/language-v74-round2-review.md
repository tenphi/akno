# V74 independent Sol code review — round 2

## Scope and validation

I reviewed the complete staged V74 diff against `048a743`, including the runtime helpers and caller
integration, tests, changeset, `benchmarks/language/v74-trial-plan.md`, repository scanner exception,
the round-one review, and its fix receipt. I made no implementation edits, provider calls, GitHub
changes, or held-out-input reads.

My direct checks were:

- `git diff --cached --check` — clean;
- 346 focused tests across `language-audit.test.ts`, `language.test.ts`,
  `retention-negative-evidence.test.ts`, `retain-clock-repair.test.ts`, and
  `counterfactual-wording.test.ts` — passed;
- deterministic helper/schema reproductions described below.

The preserved repository log `tmp/v74-full-suite-final.log` reports 3,652 tests in 151 files passed.
The first `tmp/v74-lint-final.log` retains the now-fixed shadow-name failure; the later
`tmp/v74-lint-after-test-name.log` is clean. Final root-owned gate completion was still in progress
when this review finding was recorded.

## Finding

### Medium — newly required semantic witness/segment strings accept punctuation-only values

Locations:

- `packages/core/src/write/retain-clock-repair.ts:5-18`
- `packages/core/src/write/retention-negative-evidence.ts:5,33-42,88-104`

The clock `completeSentence` pattern permits any non-CR/LF/NUL content ending in `.` or `!`, while
the Zod field adds only `min(1)`. Therefore `.` and `!` are valid values for every required clock
repair field. I reproduced both strict clock schemas accepting these values, and
`clockRepairLanguageProse` materializes them normally. An entirely punctuation-only joined record
will fail the later four-word floor, but one punctuation-only field among otherwise substantive
fields does not. In particular, a valid proposition and source-clock-anchor sentence can carry
`excluded_reference_clocks: "."` or `unresolved_calendar_period: "!"`; the joined candidate can pass
the local statement/anchor checks while omitting the very dimension the specialized shape was
created to require. The fallible full-source verifier remains mandatory and may reject it, but the
server-owned structural obligation itself has been bypassed.

The new retention evidence anchor has the same vacuity. `exactText` requires one character and the
consistency check requires non-whitespace plus exact containment, so `exact_excerpt: "."` is a valid
source or candidate witness whenever that punctuation occurs. It can also be the sole source anchor
for a `source_selected_polarity` disagreement, despite the contract requiring the governing source
predicate. This cannot admit a candidate because disagreement and negative dimensions still hold;
it can validate an otherwise unsupported rejection and defeats the forensic purpose of replacing
self-authored comparison prose with immutable evidence.

Require at least one Unicode letter or number in each clock sentence and each exact source/current
text witness, while retaining the present individual caps and exact-containment checks. This keeps
ordinary numeric and code-bearing evidence possible and changes no output field, enum, call, or
aggregate allowance. Add punctuation-only controls for every clock segment, source/current mismatch
witnesses, and polarity evidence; invalid evidence must continue to invalidate the entire verifier
batch without retry.

`detail` can remain fallible explanatory prose; the material issue is that the source/current anchor
and required clock segment cannot be semantically empty punctuation.

## Prior findings rechecked

### Round-one null dereference — resolved

`ModelClient.chat` now rejects `!audit` or null/oversized serialized input before reading either
`checkInput.length` or `audit.schema`. Over-24,000 excerpts, 65 references, serialized occurrence
growth, expired time, and the exact 24,000/24,001 boundary have typed controls. Each rejected case
returns `language_check_failed`, reports the invalid response, and makes no checker transport call.

### Mixed clock/report diagnostic loss — resolved

The cleaner now records report uncertainty before handling the deferred clock issue. A candidate
with both issues enters neither text-only map, receives one ordinary full repair target containing
both typed validation issues, and a repair fixing only the clock remains locally held before semantic
verification. A one-defect candidate still uses its specialized arm.

### Clock residual-source activation — resolved

`sourceClockRepairWitness` now requires the matched clock definition to occupy the complete exact
frame span apart from horizontal whitespace and one terminal mark. The earlier reproductions with a
sentence-scoping `Suppose.`, a later withdrawn definition, and a second delivery-clock exclusion all
return null and use ordinary full repair. Quoted whole assertions, prefix framing, split items,
conflicting definitions, questions, immediate retractions, and changed direction/knownness retain
negative controls.

### Four-branch transaction coverage — resolved

The noncontiguous integration control now constructs report text-only, clock with exclusion, clock
without exclusion, and full-candidate repairs in one transaction. It checks all target positions,
cross-shape index rejection, strict endpoint conversion, a single combined language selection,
original repair obligations, surviving sibling source support, malformed JSON, duplicate entries,
and one repair call. Production branch sets are disjoint numeric enums; strict objects plus the
post-parse duplicate check preserve ownership. Materialization dispatches only after the exact
candidate index selects its branch.

## Remaining mechanism assessment

### Grouped language audit

The audit groups at most 32 distinct attention surfaces while retaining all occurrences and all
generated excerpts. Every hint ID must appear exactly once. A supplied/quote/code/path role is valid
only when all occurrences have the compatible server-computed range; a coherent negative requires a
negative hint or an in-bounds unprotected UTF-16 range containing a letter/number. Protected-range
overlap and surrogate splits fail. Strict JSON and role/status consistency distinguish
`language_mismatch` from `language_check_failed`; there is no binary fallback or retry. The serialized
24,000-unit limit includes occurrence data and references, and the checker cap remains 1,024.

`contextual_name` and the actual target/foreign classification remain model judgments. Syntactic
quotation ranges also do not prove that text was copied exactly from source; the source/semantic
paths must retain that authority. The new audit should not be described as provenance proof. This is
an explicit practical limit rather than an additional structural bypass introduced by this patch;
the complete excerpt still goes to the checker, and the prior checker already lacked source bytes.

### Negative retention evidence

Apart from the punctuation anchor above, the three null patterns are correctly disjoint:
unsupported content has no source witness, omitted scope has no candidate witness, and changed
meaning has both. Metadata IDs address a closed candidate-local catalog and omit null, undefined,
empty-string, and empty-array values. Page routing, comparison prose, and repair drafts are absent.
`changed_repair_proposition` is candidate-specific to an actual repair obligation. Exact frame/current
containment, polarity-evidence equality rules, mismatch consistency, and atomic batch failure are
wired after strict parsing. Negative outcomes remain final and cannot relabel immutable metadata.

The exact anchors improve ownership and diagnostics; even after the punctuation fix, a substring is
not deterministic proof of semantic attachment. The unchanged model comparison and three mandatory
dimensions still own that judgment.

### Clock transaction and retention integration

Eligibility is generated-only and deferred until all per-candidate attribution, discourse, agency,
time-envelope, page/schema, source-scope, fiction, and report checks have run. Report plus clock uses
full repair, and raw relations must be literally empty because relation validation occurs after the
candidate loop. Exact clock dimensions come from one uniquely validated complete frame span and are
never assembled from siblings/items/model prose.

The two fixed allocations remain exactly 400 normalized UTF-16 units including server-owned spaces.
Any report/clock text branch switches the whole transaction to strict `JSON.parse`; no truncated or
trailing salvage occurs. The server clones original nontext fields and changes only `text`, then
re-cleans the complete vector, checks joined language, compares admitted siblings by position and
deep value, rejects lost positions, supplies the original repair obligation, and invokes the full
semantic verifier. A negative verdict is final. One repair call and its existing 3,200 requested
ceiling remain.

### Counterfactual and scanner changes

The Russian nominal addition requires the unrealized scenario, conditional repair consequence,
personal nonpurchase, and inactive-coverage closure in one bounded unit. Quote masking, clause starts,
horizontal-space bounds, and unretracted endings prevent the tested borrowing/retraction forms.
Actor, object, year, and source identity remain semantic-verifier responsibilities.

The repository-safety exception is limited to JSON, the exact numeric `maximum` property on its own
line, and `Number.MAX_SAFE_INTEGER`. Strings, other keys/extensions, another sixteen-digit value, and
ordinary prose still fail without printing the sensitive number. It does not exempt benchmark or
fixture content.

## Disposition

**Changes requested.** Close the punctuation-only clock-segment and negative-evidence-witness
boundary, add the focused atomic controls, then rerun the affected tests/typecheck and final required
gates. I found no other production blocker. The prior high and medium findings and both clock
pre-review findings are resolved in the current staged design.
