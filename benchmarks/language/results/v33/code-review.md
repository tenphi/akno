# V33 code review

Reviewer: GPT-5.6 Sol, separate read-only code reviewer. This review covers the V33 generic-role language boundary, neutral open-question generation guidance, protocol/test updates, documentation, and the frozen-trial plan. It is not an independent semantic output grade.

## Review rounds

1. The first implementation correctly limited the deterministic language floor to answers citing qualified page evidence whose typed source is a generic assistant. It preserved actual named speakers and source-exact quotation/code, kept the shared model language check, and did not relax semantic verification or add retries. I found one bypass: masking a source-exact bare role token let `according to \`assistant\`` and its quoted equivalent act as untranslated Russian attribution.
2. The revision unwrapped a quotation/code span only when its entire content was the foreign generic role, then evaluated that token in grammatical context. Longer source-exact quotations and code remain masked. Regressions distinguish bound quoted/backtick reporters from a quoted role used as a literal object. This closes the bypass without treating names, identifiers, or quoted source passages as translatable prose.
3. The final policy regressions cover configured-English fallback and an explicit Russian answer-language override. The test stub now examines all system messages, which is necessary because configured language adds a system instruction before verifier prompts; language-check requests remain dispatched to the compliance stub. The production runtime is unchanged by that test-helper correction.

## Final assessment

No actionable findings remain in the reviewed boundary.

The implementation reports a typed `language` rejection before semantic verification for a foreign generic assistant label used as a bound reporter. Unset policy preserves legacy behavior. Explicit answer language takes precedence over configured knowledge language, while configured language supplies the fallback. Named speakers, identifiers, literal quoted-role objects, and longer exact source quotation/code are covered by paired regressions.

The V33 validation plan accurately preserves the V31 full failure and V32 probe-only evidence, states that no V32 full trial started, binds V33 to the unchanged independently approved v18 fingerprint `bbd6def51d25ea19f7fd273a95174e321b9789914ce288091e56d10e98a64866`, and retains the same models, repeated runs, thresholds, zero-error dimensions, no-retry policy, and freeze-before-fresh-output procedure. Its scope caveat correctly limits the evidence to finite invented English/Russian trials.

The remaining limitation is explicit and appropriately bounded: this deterministic floor targets known generic assistant attribution constructions. The shared language model check remains responsible for other generated prose and generic-role forms, and semantic verification remains responsible for source entailment and attribution meaning.
