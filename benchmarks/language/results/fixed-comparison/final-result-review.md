# Final result and claims review

**Disposition:** **clear for publication preparation**. I found no count, gate, causal, or reliability overclaim requiring correction in the reviewed result JSON, README draft, current evaluated-scope documentation, or final PR text. The evidence-link check remains an expected publication dependency until the bundle is written; it is not a result defect.

## Reconciled result

- Frozen Integration (`963bf68`) has **249/320** useful writable answers versus V77's **211/320**.
- Legacy/original blocks total **142/160**, versus V77 **122/160** and V17 **139/160**. Recent/newer blocks total **107/160**.
- Per block/run Integration useful answers are **76, 66, 53, 54 / 80**; complete retained sets are **10, 9, 7, 8 / 10**; useful retrievals are **40, 36, 34, 33 / 40**.
- Totals are **34/40** complete retained sets and **143/160** useful retrievals.
- Integration has **9 accepted answer errors**: 7 unsupported-answer errors and 2 qualification errors. V77 has 11: 3 unsupported and 8 qualification errors. Both have zero accepted answer-language violations and zero unsafe answer promotions.
- The requested-answer-language slices are **131/160 English with 4 accepted errors** and **118/160 Russian with 5 accepted errors**. `language-breakdown.json` labels these descriptive slices and does not use them as an alternate gate.
- Integration has **4 case-level availability failures** and **5 answer-level availability diagnostics**. The texts keep those denominators separate.
- All 32 read-only nulls are justified; all 44 case-runs preserve source bytes and replay; Integration ordinary Markdown mismatches are **0**, versus six for each historical comparison arm.

## New retained error

The statement that Integration introduces one unsupported retained set while V77 has none is supported. In recent run 2, the competing-hypotheses source concerns `дребезг` (rattle), while the retained candidate changes the tested symptom to “vibration.” The final source grade marks this retained set non-entailed and carries the resulting answer/retrieval errors. The README, docs, and PR text disclose this regression alongside the coverage gain; they do not hide it inside the lower aggregate answer-error count.

## Gate and claim boundaries

The fixed gate remains **FAIL**. Recent run 1 has only 66.25% useful answers and 70% complete retention; other block/run dimensions also miss the required 80%, and accepted errors plus the unsupported retained set independently prevent acceptance. The 90% answer target also fails. Each text correctly says pooled totals cannot rescue a block/run.

The claims describe a bounded recovery rather than reliability. They explicitly preserve run variance, exposed-case limits, model-grader fallibility, missing source coverage, false holds, view-selection failures, semantic-verification failures, and the open status of issues #61/#62. They do not approve merge or reliable automatic retention.

The mechanism claims are appropriately limited. The frozen trace exercises direct report verification and a complete open-question retrieval unit, but the text says this does not prove that every stochastic difference was caused by the new instructions. The source-name and report paths are described as bounded; the retrieval-unit contract remains a model instruction rather than a completeness proof.

## Deterministic correction and iteration closure

The measured score is consistently attributed to frozen `963bf68`. The later `9045eda` clock correction is described as a deterministic consistency fix for the exact Russian phrase already prescribed by generation. No live coordinate was rerun or credited, and no hypothetical answer was added. The separate test/review/deployment evidence supports the code-level claim only.

The accounting is consistent: the three comparison arms plus one integration, together with the two previously charged iterations, used six; the later deterministic clock correction brings closure to **7/10**. The texts state that no further tuning cycle follows.

## Artifact consistency

`comparison-final.json`, `integration-final.json`, `integration-case-deltas.json`, and `language-breakdown.json` agree with the narrative totals above. `README-draft.md`, `docs/language-and-discourse.md`, and `tmp/akno-pr70-final.md` use the same result and failure language. The final validation claim of **3,986 tests across 154 files** is supported by `tmp/akno-clock-contract-suite.log`; deployment and public source-preservation evidence are referenced separately rather than inferred from the suite.

Grades remain unchanged by this review.
