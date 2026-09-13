# Final release-profile smoke review

## Assessment

Clean, with the documented limits preserved.

The published evidence keeps the original live run and executed runner intact. `initial-run.json` remains `passed: false` with 33 of 38 assertions passing, and every hash listed in `validation.json` matches the corresponding evidence or active script. The validation does not rewrite the old pass flag or claim that the missed English malformed-verifier injection occurred.

The live positive outputs support the bounded operational claims. Under both `knowledge_language: null` and `knowledge_language: "en"`, the resolved answer role has the shipped 2,400-token ceiling and 60-second timeout, while derive has 2,400 tokens and 120 seconds. Both invented assistant reports were retained as qualified `source_report` records, exact source quotations and hashes survived rebuild/replay, and the Russian quotation remained byte-exact behind the English retained record. The four published answers preserve the selected invented source content, cite the expected records, contain one verified block each, and report no degradation. These observations remain separate from the frozen quality score.

The zero-egress supplement reaches the targeted production failure stage. It extracts and executes the corrected `phase` helper from the active live runner, and its four direct checks prove that a prepended language system message no longer hides extraction, generation, answer-verification, or retention-verification prompts. For each language profile, scripted generation and language-check results feed the real built `ModelClient` answer-verification transport. The fetch interceptor asserts that the resulting wire request is an answer-verification request before injecting incomplete JSON. Both operations return `verification_unavailable` with `answer_verification_failed`, preserve the source file and file set, and together record exactly two intended injections with zero foreign requests.

The supplement is correctly scoped as a generic ordinary-answer verifier control. It does not claim a retained-report-specific injection, model quality, deadline behavior, or a second live result. The README also accurately distinguishes the successful live positive observations from the failed initial harness, the unexecuted English injection, and the later offline correction.

Evidence privacy is appropriate for the stated boundary. Sources and outputs use the invented Zephyr fixture vocabulary. Reports contain hashes, public outputs, content-free stages, token ceilings, latency/usage receipts, and typed outcomes; they contain no provider URL, credential value, raw model message, or private knowledge-base content. The preserved runner necessarily contains environment-variable names and code that reads configured credentials, but no credential value is published.

`validation.json` records production code as unchanged from `c76c0a0`, and the current post-smoke diff contains no core or protocol change. Documentation now accurately states that null knowledge language preserves language targeting only, that discourse and verification behavior remains active, and that the 2,400-token release-profile smoke does not validate the full quality corpus. The fixed comparison's unsupported retained set, nine erroneous answers, failed quality gate, and open reliability work remain explicit.

## Disposition

No material issue found. The evidence closes the narrow release-default/profile validation gap without rerunning or rescoring the semantic benchmark, altering production behavior, or claiming reliability acceptance.
