# V22 evaluation evidence

Runtime commit: `4f893b4`. Corpus: v14. Runtime: GPT-5.6 Luna; independent input/output review: GPT-5.6 Sol.

The authoritative `gate.json` fails held-out answer coverage and one source-entailment check. Useful answers are 279/320 writable combinations: development 77/80 and 72/80, held-out 69/80 and 61/80. There are 40 unjustified nulls and one unsupported Russian translation from service collection to data collection. Useful retention is 37/40; all 32 read-only abstentions are justified. No accepted qualification, language or promotion error, source-byte change or availability failure was found.

`output-review-initial.json` is preserved as a superseded review. A consistency recheck against the unchanged source-entailment contract corrected one translation judgment; sources, runtime outputs, expectations and thresholds did not change.

The selected and clock diagnostics together yielded 23/24 independently useful, qualified, source-entailed answers. The separate built-package probe yielded 14/16. Their reports and independent reviews preserve the nulls; these probes do not replace the repeated full trial.
