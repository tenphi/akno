# V21 evaluation evidence

Runtime commit: `a7c3f65`. Corpus: v13. Runtime: GPT-5.6 Luna; independent input/output review: GPT-5.6 Sol.

The authoritative `gate.json` uses the corrected `output-review.json`: all four groups meet 90% useful-answer coverage, but the gate fails for five omitted source-relative time qualifications. Useful answers are 308/320 writable combinations; the 32 additional read-only combinations all abstain correctly. All 40 writable retentions are useful.

`output-review-initial.json` is the superseded initial judgment, preserved for audit. A consistency recheck against the unchanged source-relative-time contract corrected five answer judgments. The initial review missed these omissions and would have passed the gate. No source text, runtime output, threshold or expectation changed during that correction.

`built-reliability.json` and `built-output-review.json` cover a separate 16/16 passing deployment probe. `selected-diagnostic.json`, `question-diagnostic.json` and `diagnostic-output-review.json` cover a selected 29/32 useful-answer diagnostic, which independently exposed the same time-anchor omission. Neither probe replaces the repeated full trial.
