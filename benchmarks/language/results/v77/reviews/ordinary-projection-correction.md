# V77 ordinary-projection forensic correction

The prior held-out and combined finals are preserved at:

- `tmp/language-v77-full-held-out-forensics-final-before-ordinary-correction.md`
- `tmp/language-v77-full-forensics-before-ordinary-correction.md`

I independently replayed frozen `tmp/core-v77/src/kb/prose.ts#proseQualifications` against exactly `# Zephyr QX-100\n\n${source.ordinary}\n` for both runs of held-out nested report, assistant speculation, and competing hypotheses. The machine-readable result is `tmp/v77-ordinary-projection-replay.json`.

For every case, headings at lines 1 and 3 are in the discussion view and `answer_eligible:false`, but the prose body at line 4 is classified `{view:"factual", status:"qualified", reason:"asserted", answer_eligible:true}`. The corpus expectation is `ordinaryFactual:false`; therefore the exact metric at `packages/core/src/bench/language.ts:483` correctly reports all six as `ordinaryCorrect:false`.

This is factual-admission leakage into the eligible source pool. My earlier claim that the two competing-hypothesis mismatches were merely projection/classification differences without admission leakage was wrong. Source-faithful managed retained records and the absence of an observed generated-answer promotion do not repair or negate this independent ordinary-source eligibility defect.

The distinction remains important: I found zero unsafe promotions among the 221 generated public answers, while the ordinary source projection incorrectly makes six nonfactual bodies answer-eligible. Those are different paths and denominators. Development remains 22/22 ordinary-correct; held-out is 16/22; combined is 38/44.
