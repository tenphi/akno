# V48 null-answer grading convention

The V48 receipt originally marked `qualificationPreserved: false` for every null answer. That conflated absence with a produced qualification error.

The prior full V39 `language-output-review-v2` receipt consistently uses `qualificationPreserved: true` for null answers, including unjustified writable misses and justified read-only abstentions. This is coherent with the schema’s separate dimensions: a null answer is never useful, and its abstention may be justified or unjustified, while no answer text exists that could mistranslate or strip a qualification. Qualification is therefore preserved vacuously. `languageCompliant` and `sourceEntailed` remain `null` exactly because those properties cannot be evaluated for absent text.

I changed only `qualificationPreserved` from `false` to `true` on the V48 null rows. All usefulness, retrieval, abstention, language, entailment, promotion, retention, and non-null answer judgments remain unchanged. The original receipt is preserved at `tmp/language-v19-output-review-v48-original.json`.
