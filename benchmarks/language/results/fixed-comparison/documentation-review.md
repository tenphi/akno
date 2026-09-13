# Documentation accuracy review

**Scope:** new behavior/current-evaluation text in `docs/language-and-discourse.md`, the dated correction in `benchmarks/language/results/v77/README.md`, and the condensed changeset, checked against frozen runtime `963bf68` and `tmp/akno-comparison/{comparison-final,comparison-case-deltas}.json`. Historical experiment sections were treated as historical records rather than regraded.

**Disposition:** two bounded wording fixes are needed before final publication. The fixed-comparison counts and the new detailed behavior paragraphs otherwise agree with the reviewed evidence. The pending integration is described as pending and is not credited with success.

## Findings

### 1. Medium — the V77 dated correction still contradicts the next paragraph

`benchmarks/language/results/v77/README.md:3-9`

The added correction correctly says the original project useful-answer target was 80% and that 90% belongs to later expanded corpora. The unchanged opening immediately below still says the terminal V22 trial failed “the original 90% useful-answer gate.” Calling the report historical does not remove the direct terminology contradiction the correction was added to resolve.

Smallest correction: change only that occurrence to “the predeclared 90% useful-answer gate” (or “the V22 90% useful-answer gate”). Preserve the grade, gate files, stopping decision, and all historical counts.

### 2. Low — the condensed changeset overstates both bounded mechanisms

`.changeset/knowledge-language-discourse.md:23-25`

The detailed documentation accurately states the activation boundaries, but the condensed changeset says generated reports with unfamiliar wording go directly to the verifier. Runtime `963bf68` admits this concern path only for an otherwise locally valid **generated** candidate with literal empty raw relations and no simultaneous unreadable-clock defect; public/model-free and caller-provided cleaning remain strict. “Otherwise-valid relation-free generated reports” would state the shipped boundary without reproducing implementation detail.

The next sentence says complete-record answers preserve the exact spelling of their named source. The local guard is narrower: it applies when the selected qualified readable record itself contains its non-generic `source_speaker`. Generic roles, metadata-only names, names found only in unselected source clauses, and ordinary focused composition do not gain this requirement. Suggested compact wording: “Complete-record answers preserve the exact spelling of a non-generic source speaker already named in the selected readable record.”

These are documentation-scope corrections; they do not imply a runtime defect.

## Verified claims

- The comparison table matches `comparison-final.json`: V17 **193/320, 56 errors**; V31 **216/320, 13 errors**; V77 **211/320, 11 errors**. Legacy V17/V77 totals are 139/160 and 122/160 respectively; V31 exceeds V77 by five useful answers overall while trailing it by five on legacy cases.
- Each arm has 32 justified read-only nulls, six ordinary Markdown mismatches, zero case-level availability failures, and preserved bytes/replay. Answer-level availability failures are V31 four, V17 one, V77 zero.
- No arm meets the per-block gate. The documentation does not pool totals to claim success or present the pending integration as measured improvement.
- Runtime `963bf68` contains the report-limit concern verifier, shared retrieval-unit contract, complete-record selected-speaker guard, balanced category-heading qualification, and derived prose-version migration described in the detailed behavior sections.
- The retrieval-unit text is explicitly labeled a model instruction rather than deterministic partition/source-coverage proof. The report-limit paragraph preserves source/current witness ownership, existing semantic verdicts, strict public/provided paths, and removal of the specialized report rewrite.
- The category-heading paragraph accurately limits normalization to category-shaped headings and records nested/sibling scope plus projection migration. Its examples and exclusions agree with the frozen implementation/tests.
- The current-evaluation section correctly says the 22-source comparison is exposed regression evidence, uses the fixed 2,400 retention/1,024 answer limits, and awaits independent results for the one integration.

The eventual integration-result paragraph can be updated from its completed artifacts. Nothing in this review supports changing the comparison grades or rewriting historical experiment sections.
