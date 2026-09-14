# V74 independent Sol code review — round 1

## Scope and evidence

I independently reviewed the complete staged diff against `048a743`, including the four runtime mechanisms, their integration tests and helpers, the changeset, `benchmarks/language/v74-trial-plan.md`, and the narrow repository-safety exception. I made no implementation edits, provider calls, GitHub changes, or fresh held-out reads.

Static review included strict-schema branch ownership, local witness validation, repair transaction reconstruction, source/metadata authority, full-vector verification flow, and the unchanged call/cap paths. `git diff --cached --check` is clean. The declared initial 3,640-test result is supporting evidence supplied by the plan; updated full gates remain pending after fixes.

## Findings

### High — oversized or expired language-check input dereferences `null` instead of returning the typed failure

Location: `packages/core/src/models/client.ts:546-572`.

The new code deliberately sets `audit` and `checkInput` to `null` when the excerpt size exceeds 24,000 units, references exceed 64, or the remaining timeout is exhausted. The next condition unconditionally evaluates `checkInput.length`, and the later request unconditionally reads `audit.schema`:

```ts
const audit = bounded ? languageAudit(...) : null;
const checkInput = audit ? JSON.stringify(audit.input) : null;
if (checkInput.length > 24000 || ...) { ... }
// later: schema: audit.schema
```

The intended fail-closed cases therefore throw a JavaScript `TypeError` before `reportInvalidResponse('language_check_failed')` and before the typed `ModelOutcome` is returned. This changes the established failure boundary and can escape the operation rather than report language verification unavailable.

Fix by testing `!audit || checkInput === null || checkInput.length > 24000` before dereferencing either value, then narrow them for the request. The initial precheck on `excerpts.join('').length` is useful to avoid constructing a large occurrence table, while the serialized `checkInput.length` check must remain because occurrence coordinates and references can push an otherwise-short excerpt request over the bound.

Required controls should independently exercise:

- excerpt prose over 24,000 units;
- 65 retained references;
- a short excerpt whose serialized occurrence/reference audit exceeds 24,000;
- zero/negative remaining timeout;
- the exact 24,000 boundary and an ordinary valid request.

Each rejected case must make no language-check transport call, invoke `reportInvalidResponse('language_check_failed')`, and return the existing typed failure rather than throw.

### Medium — a simultaneous report-uncertainty defect is suppressed from the ordinary full-repair diagnostic

Location: `packages/core/src/write/retain.ts:1742-1761`.

The clock issue is correctly deferred through the later candidate guards, and `!unreadableReportUncertainty` prevents a mixed report/clock candidate from entering the specialized clock arm. But the code pushes the clock hold and `continue`s before the report hold is pushed. Such a candidate correctly falls into `fullPositions`, yet its `validation_issues` contains only `time_unresolved`; the already-computed `report_uncertainty_unreadable` issue is lost.

This does not weaken admission because the repaired candidate is fully recleaned and semantically verified. It does undermine the stated ordinary-full-repair boundary: the one allowed repair is not told about a known second defect, making a repeated report failure more likely. The existing negative test only checks absence of `repair_contract`, so it does not catch the incomplete issue list.

When `unreadableClock` and `unreadableReportUncertainty` are both true, retain both typed holds for that original position before continuing, while keeping the position out of both text-only maps. The repair transaction already deduplicates `failedPositions` and collects every hold at that position, so this should preserve one repair call and ordinary full-candidate branch ownership. Add an integration assertion that the mixed target has both validation issues, no specialized contract, and that a repair fixing only one defect remains held on full reclean.

## Reviewed mechanisms without additional blockers

### Grouped language audit

The earlier protected-range overlap defect is fixed: a range witness overlapping any exact protected span is invalid. Hint surfaces remain capped at 32 distinct tokens, all occurrences are supplied, and an exempt classification requires compatible coverage for every occurrence. Strict JSON parsing distinguishes coherent `language_mismatch` from malformed/inconsistent `language_check_failed`; there is no binary fallback, retry, or extra call. Surrogate-boundary and exact-range checks are present. `contextual_name` remains explicitly fallible, so the mechanism does not claim identifier proof from spelling.

The maximum response is 32 compact role objects plus one witness under the unchanged 1,024-token call. The planned maximum-shape Chat and Responses echoes are necessary observed-fit evidence; they cannot establish universal fit when reasoning and tokenizer behavior vary.

### Owned negative retention evidence

Negative mismatch arms encode the required null patterns: unsupported additions have no source witness, omissions have no candidate witness, and changes require both. Source excerpts are exact candidate-frame substrings; candidate text excerpts are exact current-text substrings; metadata references come from a closed candidate-local catalog that excludes absent/empty values, page routing, comparison prose, and repair drafts. `changed_repair_proposition` exists only for actual repair-obligation candidates. Polarity disagreements require an exact candidate-owned source excerpt plus the immutable polarity pointer; equality requires null evidence.

Strict parsing and `semanticVerdictConsistent` keep one mismatch per false dimension, and invalid evidence invalidates the batch rather than being discarded to accept. Valid negative verdicts remain final. These exact witnesses improve auditability but remain fallible evidence selection: an exact substring alone does not prove semantic attachment, so the full source comparison and three mandatory booleans remain necessary as documented.

### Clock text-only repair

The two clock shapes use disjoint source-derived index sets and fixed per-field UTF-16 limits totaling 400 with server-owned spaces. The source witness requires one complete exact frame span and distinguishes an explicit processing-clock exclusion from no exclusion. Text-only replacement clones the original nontext fields, and mixed report/clock/full transactions use strict parsing, duplicate/foreign index rejection, immutable-sibling checks, lost-position checks, full reclean, language checking, original repair obligations, and full semantic verification. Caller-provided candidates do not enter the generated repair path.

The source grammar is intentionally finite; unfamiliar faithful clocks use ordinary full repair. Structurally complete prose is not semantic approval. The mixed-diagnostic finding above is the only issue I found in this mechanism.

### Russian counterfactual floor

The new nominal order remains inside the complete unrealized unit: an affirmative unrealized scenario, bounded purchase antecedent and conditional repair consequence, followed by personal nonpurchase and inactive-coverage closure. Quotation masking and unretracted clause-end checking remain. Actor/object/year/source identity are still owned by mandatory semantic verification, so the finite floor does not itself approve them.

### Repository-safety exception and compatibility

The safety exception is restricted to `.json`, the exact numeric `maximum` property on its own line, and `Number.MAX_SAFE_INTEGER`. Tests retain failures for strings, other keys, other extensions, and another sixteen-digit value. It does not create a prose/corpus exemption.

The staged plan preserves the existing models, public protocols, pass count, semantic gates, retry policy, 400-unit candidate cap, 1,024-token language cap, and configured role ceilings. Provided/automatic attestation paths are not routed through the new generated-only repair logic. Version and trial declarations identify the internal schema changes and preserve fresh V21 as unexecuted.

## Disposition

**Changes requested.** Fix the high-severity null dereference before any freeze or protocol execution. Preserve both typed issues for mixed clock/report failures so the sole ordinary repair receives the complete known diagnosis. After those changes, run focused boundary tests plus the declared full repository gates and proceed to the second independent review.
